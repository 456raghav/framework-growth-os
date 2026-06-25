import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ElevenLabs sends a GET request to verify the webhook endpoint
// exists before sending POST requests with actual call data
export async function GET() {
  return NextResponse.json({ status: "FGOS voice webhook active" });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("ElevenLabs-Signature");

    // DEBUG MODE: signature verification temporarily disabled
    // to confirm webhook is firing correctly.
    // Re-enable after confirming leads appear in dashboard.
    console.log("[Voice Webhook] Hit — signature:", signature);
    console.log("[Voice Webhook] Body length:", rawBody.length);

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("[Voice Webhook] Failed to parse body");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    console.log("[Voice Webhook] Full body:", JSON.stringify(body, null, 2));

    const data = (body?.data as Record<string, unknown>) || {};
    const analysis = (data?.analysis as Record<string, unknown>) || {};
    const dataCollection = (analysis?.data_collection_results as Record<string, unknown>) || {};
    const transcript = (data?.transcript as Array<{ role: string; message: string }>) || [];
    const conversationId = (data?.conversation_id as string) || `voice_${Date.now()}`;
    const agentId = (data?.agent_id as string) || null;

    console.log("[Voice Webhook] agent_id:", agentId);
    console.log("[Voice Webhook] conversation_id:", conversationId);
    console.log("[Voice Webhook] dataCollection:", JSON.stringify(dataCollection, null, 2));

    const callerName = (dataCollection?.caller_name as { value?: string })?.value || null;
    const callerPhone = (dataCollection?.caller_phone as { value?: string })?.value || null;
    const callerEmail = (dataCollection?.caller_email as { value?: string })?.value || null;
    const serviceNeeded = (dataCollection?.service_needed as { value?: string })?.value || null;
    const isEmergency = (dataCollection?.is_emergency as { value?: boolean })?.value === true;
    const preferredCallTime = (dataCollection?.preferred_call_time as { value?: string })?.value || null;
    const propertyType = (dataCollection?.property_type as { value?: string })?.value || null;

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

      console.log("[Voice Webhook] Client found:", client);
      clientId = client?.id || null;
    }

    if (!clientId) {
      console.log(`[Voice Webhook] No client found for agent_id: ${agentId}`);

      const { data: allClients } = await supabaseAdmin
        .from("clients")
        .select("id, name, elevenlabs_agent_id")
        .not("elevenlabs_agent_id", "is", null);

      console.log("[Voice Webhook] Clients with agent IDs:", JSON.stringify(allClients, null, 2));

      return NextResponse.json({
        message: "No client mapped to this agent",
        agentId,
        allClients,
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

    console.log(`[Voice Webhook] ✅ Lead created: ${callerName} — ${serviceLabel}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Voice Webhook] Unexpected error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}