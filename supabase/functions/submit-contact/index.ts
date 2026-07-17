// Receives Contact Us form submissions: name, phone, email, subject, message.
// Saves to Postgres, emails info@ljwebmanagement.com. No AI involved.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml, sendNotificationEmail } from "../_shared/email.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  // Honeypot: bots fill every field, including this one, which is hidden
  // from real users via CSS. Pretend success so they don't learn to skip it.
  if (typeof body.company_hp === "string" && body.company_hp.trim() !== "") {
    return jsonResponse({ ok: true });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const sourceUrl = String(body.source_url ?? "").trim();

  if (!name || name.length > 200) return jsonResponse({ error: "Please enter your name." }, 400);
  if (!isValidEmail(email)) return jsonResponse({ error: "Please enter a valid email address." }, 400);
  if (!subject || subject.length > 300) return jsonResponse({ error: "Please enter a subject." }, 400);
  if (!message || message.length > 5000) return jsonResponse({ error: "Please enter a message." }, 400);

  const { data, error } = await supabase
    .from("contact_submissions")
    .insert({
      name,
      phone: phone || null,
      email,
      subject,
      message,
      source_url: sourceUrl || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("insert error:", error);
    return jsonResponse({ error: "Could not save your submission. Please try again." }, 500);
  }

  await sendNotificationEmail(
    `New Contact Us message: ${subject}`,
    `<h2>New Contact Us submission</h2>
     <p><strong>Name:</strong> ${escapeHtml(name)}</p>
     <p><strong>Email:</strong> ${escapeHtml(email)}</p>
     <p><strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
     <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
     <p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
  );

  return jsonResponse({ ok: true, id: data.id });
});
