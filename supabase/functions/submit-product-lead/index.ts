// Receives the lead form embedded on every /pre-made-automations/* product
// page: name, phone, email, and the page's own URL (auto-filled client-side
// into a hidden field). Saves to Postgres, emails info@ljwebmanagement.com.
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

/** Best-effort product slug from a page URL like .../pre-made-automations/customer-support */
function productFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);
    return segments.length ? segments[segments.length - 1] : null;
  } catch {
    return null;
  }
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

  if (typeof body.company_hp === "string" && body.company_hp.trim() !== "") {
    return jsonResponse({ ok: true });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const pageUrl = String(body.page_url ?? "").trim();

  if (!name || name.length > 200) return jsonResponse({ error: "Please enter your name." }, 400);
  if (!isValidEmail(email)) return jsonResponse({ error: "Please enter a valid email address." }, 400);
  if (!pageUrl || pageUrl.length > 2000) return jsonResponse({ error: "Missing page link." }, 400);

  const product = productFromUrl(pageUrl);

  const { data, error } = await supabase
    .from("product_leads")
    .insert({
      name,
      phone: phone || null,
      email,
      page_url: pageUrl,
      product,
    })
    .select("id")
    .single();

  if (error) {
    console.error("insert error:", error);
    return jsonResponse({ error: "Could not save your submission. Please try again." }, 500);
  }

  await sendNotificationEmail(
    `New product lead: ${product ?? "unknown page"}`,
    `<h2>New product page lead</h2>
     <p><strong>Name:</strong> ${escapeHtml(name)}</p>
     <p><strong>Email:</strong> ${escapeHtml(email)}</p>
     <p><strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
     <p><strong>Page:</strong> <a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></p>`,
  );

  return jsonResponse({ ok: true, id: data.id });
});
