// Twilio SMS sender for US client follow-ups.
// WhatsApp stub is also here — same function signature,
// just swap the Twilio API endpoint when Meta verification clears.
// This way the nurture cron doesn't change when WhatsApp goes live —
// just the channel-specific function gets updated here.

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

type SMSParams = {
  toPhone: string;
  message: string;
};

export async function sendSMS({
  toPhone,
  message,
}: SMSParams): Promise<{ success: boolean; error?: string }> {
  if (!toPhone) {
    return { success: false, error: "No phone number provided" };
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  // Normalize phone number — ensure it has + prefix
  const normalizedPhone = toPhone.startsWith("+")
    ? toPhone
    : `+${toPhone.replace(/\D/g, "")}`;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const body = new URLSearchParams({
      From: TWILIO_PHONE_NUMBER,
      To: normalizedPhone,
      Body: message,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString(
            "base64"
          ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Twilio error ${response.status}`,
      };
    }

    console.log(`[SMS] Sent to ${normalizedPhone}, SID: ${data.sid}`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// WhatsApp sender — same as SMS but through WhatsApp Business API.
// Currently stubbed — Meta business verification is pending.
// When verification clears:
// 1. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to Vercel env
// 2. Replace the stub below with the real Meta Cloud API call
// 3. The nurture cron will automatically start using it for 'whatsapp' clients
export async function sendWhatsApp({
  toPhone,
  message,
}: SMSParams): Promise<{ success: boolean; error?: string }> {
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log(
      "[WhatsApp] Credentials not configured yet — Meta verification pending"
    );
    return {
      success: false,
      error: "WhatsApp credentials not configured yet",
    };
  }

  // Normalize phone — WhatsApp needs country code without +
  const normalizedPhone = toPhone.replace(/\D/g, "");

  try {
    const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "text",
        text: { body: message },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || `WhatsApp API error ${response.status}`,
      };
    }

    console.log(`[WhatsApp] Sent to ${normalizedPhone}`);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}