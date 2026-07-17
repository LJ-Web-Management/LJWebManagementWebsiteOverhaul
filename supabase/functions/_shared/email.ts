// Sends a notification email via the Resend API.
//
// No AI involved anywhere in this file — it just formats a string and
// makes one HTTP POST to Resend. Requires the RESEND_API_KEY secret
// (see SETUP.md for how to get one and set it).
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL") ?? "info@ljwebmanagement.com";
// Resend lets you send from their shared domain without verifying your own
// domain's DNS — good enough since we only need mail to land in your inbox.
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "LJ Web Notifications <onboarding@resend.dev>";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendNotificationEmail(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set — skipping email send.");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFY_EMAIL],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("Resend API error:", res.status, await res.text());
    }
  } catch (err) {
    // Never let an email failure block the form submission from being saved.
    console.error("Failed to send notification email:", err);
  }
}
