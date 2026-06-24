import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ElevenLabs post-call webhook — fires after every voice conversation ends.
// Receives transcript + extracted data, creates a lead in FGOS dashboard
// exactly like the chat widget does.

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log("[Voice Webhook] Received:", JSON.stringify(body, null, 2));

    // Extract the data collection fields ElevenLabs extracted from the call
    const analysis = body?.data?.analysis || {};
    const dataCollection = analysis?.data_collection_results || {};
    const transcript = body?.data?.transcript || [];
    const metadata = body?.data?.metadata || {};
    const conversationId = body?.data?.conversation_id || `voice_${Date.now()}`;

    // Pull extracted lead fields
    const callerName = dataCollection?.caller_name?.value || null;
    const callerPhone = dataCollection?.caller_phone?.value || null;
    const callerEmail = dataCollection?.caller_email?.value || null;
    const serviceNeeded = dataCollection?.service_needed?.value || null;
    const isEmergency = dataCollection?.is_emergency?.value === true;
    const preferredCallTime = dataCollection?.preferred_call_time?.value || null;
    const propertyType = dataCollection?.property_type?.value || null;

    // Build conversation summary from transcript
    const conversationText = transcript
      .map((t: { role: string; message: string }) =>
        `${t.role === "agent" ? "AI" : "Caller"}: ${t.message}`
      )
      .join("\n");

    // We need a client_id to store the lead against.
    // ElevenLabs passes agent_id in the webhook — we map agent_id to client_id
    // in the clients table via the elevenlabs_agent_id column we'll add.
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

    // If no client found for this agent, log and return
    // This prevents orphaned leads with no client association
    if (!clientId) {
      console.log(
        `[Voice Webhook] No client found for agent_id: ${agentId} — skipping lead creation`
      );
      return NextResponse.json({
        message: "No client mapped to this agent",
        agentId,
      });
    }

    // Determine lead status based on what was collected
    let status = "New";
    if (callerPhone || callerEmail) status = "Qualified";
    if (preferredCallTime && (callerPhone || callerEmail)) status = "Callback Requested";
    if (isEmergency) status = "Hot";

    const serviceLabel = serviceNeeded
      ? serviceNeeded
      : propertyType
      ? `HVAC service (${propertyType})`
      : "HVAC service";

    // Upsert lead — use voice_ prefix on conversationId to distinguish
    // voice leads from chat widget leads in the dashboard
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