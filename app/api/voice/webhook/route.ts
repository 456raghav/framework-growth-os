import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createHmac } from "crypto";

export async function GET() {
  return NextResponse.json({ status: "FGOS voice webhook active" });
}

function verifyElevenLabsSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  try {
    const parts = signature.split(",");
    const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
    const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

    if (!timestamp || !v1) return false;

    const age = Date.now() / 1000 - parseInt(timestamp);
    if (age > 300) {
      console.log("[Voice Webhook] Rejected stale request, age:", age);
      return false;
    }

    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    return expected === v1;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("ElevenLabs-Signature");
    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET || "";

    if (secret && !verifyElevenLabsSignature(rawBody, signature, secret)) {
      console.log("[Voice Webhook] Invalid signature — rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const data = (body?.data as Record<string, unknown>) || {};
    const analysis = (data?.analysis as Record<string, unknown>) || {};
    const dataCollection = (analysis?.data_collection_results as Record<string, unknown>) || {};
    const transcript = (data?.transcript as Array<{ role: string; message: string }>) || [];
    const conversationId = (data?.conversation_id as string) || `voice_${Date.now()}`;
    const agentId = (data?.agent_id as string) || null;

    const callerName = (dataCollection?.caller_name as { value?: string })?.value || null;
    const callerPhone = (dataCollection?.caller_phone as { value?: string })?.value || null;
    const callerEmail = (dataCollection?.caller_email as { value?: string })?.value || null;
    const serviceNeeded = (dataCollection?.service_needed as { value?: string })?.value || null;
    const isEmergency = (dataCollection?.is_emergency as { value?: boolean })?.value === true;
    const preferredCallTime = (dataCollection?.preferred_call_time as { value?: string })?.value || null;
    const propertyType = (dataCollection?.property_type as { value?: string })?.value || null;

    // Build transcript as stored messages so the dashboard
    // transcript view works for voice leads exactly like chat leads
    const conversationText = transcript
      .map((t) => `${t.role === "agent" ? "AI" : "Caller"}: ${t.message}`)
      .join("\n");

    let clientId: string | null = null;

    if (agentId) {
      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("id, name")
        .eq("elevenlabs_agent_id", agentId)
        .maybeSingle();

      if (clientError) {
        console.error("[Voice Webhook] Client lookup error:", clientError);
      }

      clientId = client?.id || null;
    }

    if (!clientId) {
      console.log(`[Voice Webhook] No client found for agent_id: ${agentId}`);
      return NextResponse.json({
        message: "No client mapped to this agent",
        agentId,
      });
    }

    let status = "New";
    if (callerPhone || callerEmail) status = "Qualified";
    if (preferredCallTime && (callerPhone || callerEmail)) status = "Callback Requested";
    if (isEmergency) status = "Hot";

    const serviceLabel = serviceNeeded
      ? serviceNeeded
      : propertyType
      ? `HVAC service (${propertyType})`
      : "HVAC service";

    const voiceConversationId = `voice_${conversationId}`;

    // Upsert the lead
    const { error: upsertError } = await supabaseAdmin
      .from("leads")
      .upsert(
        {
          client_id: clientId,
          conversation_id: voiceConversationId,
          name: callerName,
          email: callerEmail,
          phone: callerPhone,
          service_needed: serviceLabel,
          preferred_call_time: preferredCallTime,
          status,
          is_emergency: isEmergency,
          emergency_description: isEmergency
            ? `Emergency call: ${serviceLabel}`
            : null,
          conversation_summary: conversationText.slice(0, 2000),
          last_message_at: new Date().toISOString(),
          qualification_score: callerPhone || callerEmail ? 50 : 10,
        },
        { onConflict: "client_id,conversation_id" }
      );

    if (upsertError) {
      console.error("[Voice Webhook] Lead upsert failed:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Store transcript as individual messages so the dashboard
    // transcript view works — same messages table as chat widget
    if (transcript.length > 0) {
      const messages = transcript.map((t) => ({
        client_id: clientId,
        conversation_id: voiceConversationId,
        role: t.role === "agent" ? "assistant" : "user",
        content: t.message,
        created_at: new Date().toISOString(),
      }));

      const { error: msgError } = await supabaseAdmin
        .from("messages")
        .upsert(messages, { onConflict: "conversation_id,role,content" });

      if (msgError) {
        console.error("[Voice Webhook] Messages insert failed:", msgError);
      }
    }

    console.log(`[Voice Webhook] ✅ Lead + transcript saved: ${callerName} — ${serviceLabel}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Voice Webhook] Unexpected error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}