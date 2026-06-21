import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// The "from" address must use a domain you've verified in Resend.
// Until you verify your own domain, Resend provides a test sending
// address (onboarding@resend.dev) that works for development but
// should NOT be used for real client emails — it's rate-limited and
// clearly marked as a test sender to recipients.
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
  // Defensive check — don't attempt to send to an empty/invalid address.
  // The AI extraction isn't guaranteed perfect (see earlier discussion on
  // extraction confidence), so a basic shape check here prevents wasted
  // API calls and confusing Resend errors for obviously-bad input.
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
