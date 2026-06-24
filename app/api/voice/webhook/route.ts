import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createHmac } from "crypto";

// Verify the request actually came from ElevenLabs using HMAC signature
function verifyElevenLabsSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  try {
    // ElevenLabs sends: t=timestamp,v1=signature
    const parts = signature.split(",");
    const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
    const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

    if (!timestamp || !v1) return false;

    // Reject requests older than 5 minutes
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

    // Verify signature in production
    if (secret && !verifyElevenLabsSignature(rawBody, signature, secret)) {
      console.log("[Voice Webhook] Invalid signature — rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    console.log("[Voice Webhook] Received:", JSON.stringify(body, null, 2));

    const analysis = body?.data?.analysis || {};
    const dataCollection = analysis?.data_collection_results || {};
    const transcript = body?.data?.transcript || [];
    const metadata = body?.data?.metadata || {};
    const conversationId = body?.data?.conversation_id || `voice_${Date.now()}`;

    const callerName = dataCollection?.caller_name?.value || null;
    const callerPhone = dataCollection?.caller_phone?.value || null;
    const callerEmail = dataCollection?.caller_email?.value || null;
    const serviceNeeded = dataCollection?.service_needed?.value || null;
    const isEmergency = dataCollection?.is_emergency?.value === true;
    const preferredCallTime = dataCollection?.preferred_call_time?.value || null;
    const propertyType = dataCollection?.property_type?.value || null;

    const conversationText = transcript
      .map((t: { role: string; message: string }) =>
        `${t.role === "agent" ? "AI" : "Caller"}: ${t.message}`
      )
      .join("\n");

    const agentId = body?.data?.agent_id || metadata?.agent_id || null;

    let clientId: string | null = null;

    if (agentId) {
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("elevenlabs_agent_id", agentId)
        .maybeSingle();

      clientId = client?.id || null;
    }

    if (!clientId) {
      console.log(
        `[Voice Webhook] No client found for agent_id: ${agentId} — skipping`
      );
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

    const { error: upsertError } = await supabaseAdmin
      .from("leads")
      .upsert(
        {
          client_id: clientId,
          conversation_id: `voice_${conversationId}`,
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
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      );
    }

    console.log(
      `[Voice Webhook] Lead created for client ${clientId}: ${callerName} — ${serviceLabel}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Voice Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}