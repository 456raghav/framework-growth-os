import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS || "onboarding@resend.dev";

type NurtureEmailParams = {
  toEmail: string;
  leadName: string;
  businessName: string;
  serviceNeeded: string | null;
};

export async function sendNurtureEmail({
  toEmail,
  leadName,
  businessName,
  serviceNeeded,
}: NurtureEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, error: "Invalid or missing email address" };
  }

  try {
    const result = await resend.emails.send({
      from: `${businessName} <${FROM_ADDRESS}>`,
      to: toEmail,
      subject: `Still thinking about ${serviceNeeded || "your project"}?`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #0D0D0D;">Hi ${leadName || "there"},</h2>
          <p style="color: #333; line-height: 1.6;">
            You reached out to <strong>${businessName}</strong>
            ${serviceNeeded ? `about <strong>${serviceNeeded}</strong>` : ""}
            a little while back — wanted to check in and see if you still
            had questions or wanted to chat.
          </p>
          <p style="color: #333; line-height: 1.6;">
            No pressure at all — just reply to this email if you'd like
            to continue, or let us know if now isn't the right time.
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
