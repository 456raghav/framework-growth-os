import { NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";

// TEST ONLY — remove this file before going live with real clients
// This endpoint lets you manually trigger a test SMS to verify
// Twilio integration is working end to end
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json(
      { error: "Add ?phone=+91XXXXXXXXXX to the URL" },
      { status: 400 }
    );
  }

  const result = await sendSMS({
    toPhone: phone,
    message:
      "Hi! This is a test message from FGOS. If you received this, SMS integration is working correctly.",
  });

  return NextResponse.json({
    success: result.success,
    error: result.error || null,
    note: "Using Twilio test credentials — no real SMS is sent. Success response confirms the integration is wired correctly.",
  });
}