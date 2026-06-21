import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendNurtureEmail } from "@/lib/nurtureEmail";

const COLD_THRESHOLD_HOURS = 24;

export async function POST(request: Request) {
  // Verify this request actually came from our own cron job, not a
  // stranger who found the URL. Without this check, anyone could hit
  // this endpoint repeatedly and trigger mass emails to every cold lead
  // on demand — this is the one route in the app that runs with no
  // human in the loop, so it needs its own gate.
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

  // Find leads that are:
  // - Not already Booked (they're handled by the confirmation email)
  // - Not Lost (don't nurture leads you've marked as dead ends)
  // - Have an email (nothing to nurture without a way to reach them)
  // - Last activity was MORE than 24 hours ago (genuinely gone cold)
  // - Have NEVER been nudged before (the anti-spam guard)
  const { data: coldLeads, error: queryError } = await supabaseAdmin
    .from("leads")
    .select("id, client_id, name, email, service_needed")
    .not("status", "in", "(Booked,Lost)")
    .not("email", "is", null)
    .lt("last_message_at", cutoffTime)
    .is("nurture_sent_at", null);

  if (queryError) {
    console.error("Nurture query failed:", queryError);
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  if (!coldLeads || coldLeads.length === 0) {
    return NextResponse.json({ message: "No cold leads found", sent: 0 });
  }

  // We need each lead's business name, which means fetching the
  // associated client. Doing this per-lead is simple and fine at MVP
  // volume — would batch this if lead counts grew large.
  let sentCount = 0;
  let failedCount = 0;

  for (const lead of coldLeads) {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("name")
      .eq("id", lead.client_id)
      .single();

    if (!client) continue;

    const result = await sendNurtureEmail({
      toEmail: lead.email,
      leadName: lead.name || "",
      businessName: client.name,
      serviceNeeded: lead.service_needed,
    });

    if (result.success) {
      sentCount++;
      // Mark this lead as nudged so it's never emailed again by this job
      await supabaseAdmin
        .from("leads")
        .update({ nurture_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
    } else {
      failedCount++;
      console.error(`Nurture email failed for lead ${lead.id}:`, result.error);
    }
  }

  return NextResponse.json({
    message: "Nurture check complete",
    coldLeadsFound: coldLeads.length,
    sent: sentCount,
    failed: failedCount,
  });
}