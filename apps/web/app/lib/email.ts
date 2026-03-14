/**
 * Email sending abstraction.
 *
 * Uses Resend when RESEND_API_KEY is set, otherwise logs to console (dev mode).
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(env: Cloudflare.Env, options: SendEmailOptions): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const fromAddress = env.EMAIL_FROM ?? "noreply@example.com";

  if (!apiKey) {
    console.log("[email] No RESEND_API_KEY set — logging email instead of sending");
    console.log(`[email] To: ${options.to}`);
    console.log(`[email] Subject: ${options.subject}`);
    console.log(`[email] Body:\n${options.html}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[email] Resend API error (${response.status}): ${body}`);
    throw new Error(`Failed to send email: ${response.status}`);
  }
}
