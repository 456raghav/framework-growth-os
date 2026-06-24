import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendNurtureEmail } from "@/lib/nurtureEmail";
import { sendSMS, sendWhatsApp } from "@/lib/sms";

const COLD_THRESHOLD_HOURS = 24;

function buildNurtureMessage(
  leadName: string,
  businessName: string,
  serviceNeeded: string | null
): string {
  const name = leadName || "there";
  const service = serviceNeeded ? ` about ${serviceNeeded}` : "";
  return `Hi ${name}, you reached out to ${businessName}${service} a little while back. Still interested? Reply YES and we'll get you sorted — no pressure.`;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

  console.log("=== NURTURE AUTH CHECK ===");
  console.log("Received header:", authHeader);
  console.log("Expected:", expectedSecret);
  console.log("CRON_SECRET loaded?", Boolean(process.env.CRON_SECRET));
  console.log("=== END AUTH CHECK ===");

  if (!process.env.CRON_SECRET || authHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoffTime = new Date(
    Date.now() - COLD_THRESHOLD_HOURS * 60 * 60 * 1000
  ).toISOString();

  // Fetch cold leads — same criteria as before but now also pull phone
  // so we can SMS/WhatsApp leads that have a phone but no email
  const { data: coldLeads, error: queryError } = await supabaseAdmin
    .from("leads")
    .select("id, client_id, name, email, phone, service_needed")
    .not("status", "in", "(Booked,Lost)")
    .lt("last_message_at", cutoffTime)
    .is("nurture_sent_at", null)
    .or("email.not.is.null,phone.not.is.null");

  if (queryError) {
    console.error("Nurture query failed:", queryError);
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  if (!coldLeads || coldLeads.length === 0) {
    return NextResponse.json({ message: "No cold leads found", sent: 0 });
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const lead of coldLeads) {
    // Fetch client with followup_channel so we know which channel to use
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("name, followup_channel, owner_phone")
      .eq("id", lead.client_id)
      .single();

    if (!client) continue;

    const channel = client.followup_channel || "email";
    const nurtureMessage = buildNurtureMessage(
      lead.name,
      client.name,
      lead.service_needed
    );

    let result: { success: boolean; error?: string };

    if (channel === "sms" && lead.phone) {
      // US client — send SMS via Twilio
      result = await sendSMS({
        toPhone: lead.phone,
        message: nurtureMessage,
      });

      // Fallback to email if SMS fails and email exists
      if (!result.success && lead.email) {
        console.log(
          `[Nurture] SMS failed for lead ${lead.id}, falling back to email`
        );
        result = await sendNurtureEmail({
          toEmail: lead.email,
          leadName: lead.name || "",
          businessName: client.name,
          serviceNeeded: lead.service_needed,
        });
      }
    } else if (channel === "whatsapp" && lead.phone) {
      // India client — send WhatsApp
      // Currently returns error until Meta verification clears.
      // Falls back to email automatically.
      result = await sendWhatsApp({
        toPhone: lead.phone,
        message: nurtureMessage,
      });

      if (!result.success && lead.email) {
        console.log(
          `[Nurture] WhatsApp failed for lead ${lead.id}, falling back to email`
        );
        result = await sendNurtureEmail({
          toEmail: lead.email,
          leadName: lead.name || "",
          businessName: client.name,
          serviceNeeded: lead.service_needed,
        });
      }
    } else if (lead.email) {
      // Default — email only
      result = await sendNurtureEmail({
        toEmail: lead.email,
        leadName: lead.name || "",
        businessName: client.name,
        serviceNeeded: lead.service_needed,
      });
    } else {
      // No contact method available
      console.log(
        `[Nurture] Lead ${lead.id} has no email or phone — skipping`
      );
      continue;
    }

    if (result.success) {
      sentCount++;
      await supabaseAdmin
        .from("leads")
        .update({ nurture_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
    } else {
      failedCount++;
      console.error(
        `[Nurture] All channels failed for lead ${lead.id}:`,
        result.error
      );
    }
  }

  return NextResponse.json({
    message: "Nurture check complete",
    coldLeadsFound: coldLeads.length,
    sent: sentCount,
    failed: failedCount,
  });
}