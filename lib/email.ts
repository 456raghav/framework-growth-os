import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS || "onboarding@resend.dev";

type BookingConfirmationParams = {
  toEmail: string;
  leadName: string;
  businessName: string;
  preferredCallTime: string;
  serviceNeeded: string | null;
};

export async function sendBookingConfirmation({
  toEmail,
  leadName,
  businessName,
  preferredCallTime,
  serviceNeeded,
}: BookingConfirmationParams): Promise<{ success: boolean; error?: string }> {
  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, error: "Invalid or missing email address" };
  }

  try {
    const result = await resend.emails.send({
      from: `${businessName} <${FROM_ADDRESS}>`,
      to: toEmail,
      subject: `You're booked with ${businessName}!`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #0D0D0D;">Hi ${leadName || "there"},</h2>
          <p style="color: #333; line-height: 1.6;">
            Thanks for reaching out to <strong>${businessName}</strong>!
            ${serviceNeeded ? `We've got your request for <strong>${serviceNeeded}</strong> noted.` : ""}
          </p>
          <p style="color: #333; line-height: 1.6;">
            Our team will call you <strong>${preferredCallTime}</strong>.
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            If that time no longer works, just reply to this email and we'll sort out a better one.
          </p>
        </div>
      `,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// GAP 4 — Emergency alert sent to the business owner the moment
// an emergency lead is detected. Fires instantly, not on a schedule.
// The owner gets this on their phone so they can act immediately
// instead of finding out the next morning.
type EmergencyAlertParams = {
  toEmail: string;
  businessName: string;
  emergencyDescription: string;
  visitorName: string | null;
  visitorPhone: string | null;
  visitorEmail: string | null;
  serviceNeeded: string | null;
};

export async function sendEmergencyAlert({
  toEmail,
  businessName,
  emergencyDescription,
  visitorName,
  visitorPhone,
  visitorEmail,
  serviceNeeded,
}: EmergencyAlertParams): Promise<{ success: boolean; error?: string }> {
  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, error: "Invalid or missing owner email" };
  }

  const contactLine = visitorPhone
    ? `Phone: ${visitorPhone}`
    : visitorEmail
    ? `Email: ${visitorEmail}`
    : "No contact info captured yet — check dashboard";

  try {
    const result = await resend.emails.send({
      from: `FGOS Alerts <${FROM_ADDRESS}>`,
      to: toEmail,
      subject: `🚨 Emergency lead on ${businessName} — respond now`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #dc2626; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">
              🚨 Emergency lead detected
            </h2>
            <p style="color: #fecaca; margin: 4px 0 0; font-size: 14px;">
              Someone on ${businessName}'s website needs urgent help
            </p>
          </div>

          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 120px;">Situation</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">
                  ${emergencyDescription}
                </td>
              </tr>
              ${serviceNeeded ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Service</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px;">${serviceNeeded}</td>
              </tr>` : ""}
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Visitor</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px;">
                  ${visitorName || "Name not captured yet"}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Contact</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">
                  ${contactLine}
                </td>
              </tr>
            </table>

            <p style="margin: 20px 0 0; font-size: 13px; color: #6b7280;">
              This visitor is currently active on the website. Check the dashboard for the full conversation.
            </p>
          </div>
        </div>
      `,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}