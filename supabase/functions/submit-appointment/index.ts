// Receives appointment bookings from the booking embed. Re-validates the
// requested slot server-side (8am-5pm America/Chicago, weekdays only, must
// land on the type's own slot grid, must not already be booked) so nothing
// the client sends is trusted blindly. Saves to Postgres, emails
// info@ljwebmanagement.com. No AI involved.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml, sendNotificationEmail } from "../_shared/email.ts";
import {
  APPOINTMENT_TYPES,
  chicagoNowMinutes,
  chicagoTodayStr,
  chicagoWallTimeToUtc,
  generateSlotStarts,
  isValidDateStr,
  isWeekday,
  minutesToLabel,
} from "../_shared/appointment-rules.ts";

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

  if (typeof body.company_hp === "string" && body.company_hp.trim() !== "") {
    return jsonResponse({ ok: true });
  }

  const typeId = String(body.type ?? "");
  const dateStr = String(body.date ?? "");
  const startMinutes = Number(body.start_minutes);
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  const type = APPOINTMENT_TYPES[typeId];
  if (!type) return jsonResponse({ error: "Unknown appointment type." }, 400);
  if (!isValidDateStr(dateStr)) return jsonResponse({ error: "Invalid date." }, 400);
  if (!isWeekday(dateStr)) {
    return jsonResponse({ error: "That date is a weekend. Please choose a weekday." }, 400);
  }
  if (!Number.isInteger(startMinutes)) return jsonResponse({ error: "Invalid time." }, 400);
  if (!name || name.length > 200) return jsonResponse({ error: "Please enter your name." }, 400);
  if (!isValidEmail(email)) return jsonResponse({ error: "Please enter a valid email address." }, 400);

  const validStarts = generateSlotStarts(type.duration);
  if (!validStarts.includes(startMinutes)) {
    return jsonResponse({ error: "That time isn't a valid slot for this meeting type." }, 400);
  }

  if (dateStr === chicagoTodayStr() && startMinutes <= chicagoNowMinutes()) {
    return jsonResponse({ error: "That time has already passed. Please choose another." }, 400);
  }

  // Re-check availability right before writing, to close the race between a
  // client loading slots and actually submitting.
  const endMinutes = startMinutes + type.duration;
  const { data: existing, error: queryError } = await supabase
    .from("appointments")
    .select("start_minutes, duration_minutes")
    .eq("appointment_date", dateStr);

  if (queryError) {
    console.error("availability check error:", queryError);
    return jsonResponse({ error: "Could not verify availability. Please try again." }, 500);
  }

  const conflict = (existing ?? []).some((b) => {
    const bStart = b.start_minutes as number;
    const bEnd = bStart + (b.duration_minutes as number);
    return startMinutes < bEnd && bStart < endMinutes;
  });
  if (conflict) {
    return jsonResponse({ error: "That time was just booked. Please pick another slot." }, 409);
  }

  const datetimeUtc = chicagoWallTimeToUtc(dateStr, startMinutes);
  const timeLabel = minutesToLabel(startMinutes);

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      appointment_type: typeId,
      appointment_label: type.label,
      duration_minutes: type.duration,
      appointment_date: dateStr,
      start_minutes: startMinutes,
      appointment_time_label: timeLabel,
      appointment_datetime_utc: datetimeUtc.toISOString(),
      timezone: "America/Chicago",
      name,
      email,
      phone: phone || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("insert error:", error);
    return jsonResponse({ error: "Could not save your booking. Please try again." }, 500);
  }

  await sendNotificationEmail(
    `New appointment: ${type.label} on ${dateStr} at ${timeLabel} CT`,
    `<h2>New appointment booked</h2>
     <p><strong>Type:</strong> ${escapeHtml(type.label)} (${type.duration} min)</p>
     <p><strong>When:</strong> ${escapeHtml(dateStr)} at ${escapeHtml(timeLabel)} Central Time</p>
     <p><strong>Name:</strong> ${escapeHtml(name)}</p>
     <p><strong>Email:</strong> ${escapeHtml(email)}</p>
     <p><strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
     <p><strong>Notes:</strong><br>${escapeHtml(notes || "—").replace(/\n/g, "<br>")}</p>`,
  );

  return jsonResponse({
    ok: true,
    id: data.id,
    date: dateStr,
    time_label: timeLabel,
    type_label: type.label,
    duration: type.duration,
  });
});
