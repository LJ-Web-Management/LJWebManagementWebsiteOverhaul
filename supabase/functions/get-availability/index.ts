// GET /get-availability?type=quick-chat&date=2026-07-20
// Returns the open slot start-times (minutes after midnight, Central time)
// for the given appointment type + date, so the booking widget can grey out
// times that are already taken. Read-only, no AI.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  APPOINTMENT_TYPES,
  chicagoNowMinutes,
  chicagoTodayStr,
  generateSlotStarts,
  isValidDateStr,
  isWeekday,
} from "../_shared/appointment-rules.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const typeId = url.searchParams.get("type") ?? "";
  const dateStr = url.searchParams.get("date") ?? "";

  const type = APPOINTMENT_TYPES[typeId];
  if (!type) return jsonResponse({ error: "Unknown appointment type." }, 400);
  if (!isValidDateStr(dateStr)) return jsonResponse({ error: "Invalid date." }, 400);
  if (!isWeekday(dateStr)) return jsonResponse({ slots: [] });

  let candidates = generateSlotStarts(type.duration);

  // Don't offer times that have already passed today.
  if (dateStr === chicagoTodayStr()) {
    const nowMin = chicagoNowMinutes();
    candidates = candidates.filter((m) => m > nowMin);
  }

  const { data: existing, error } = await supabase
    .from("appointments")
    .select("start_minutes, duration_minutes")
    .eq("appointment_date", dateStr);

  if (error) {
    console.error("query error:", error);
    return jsonResponse({ error: "Could not load availability." }, 500);
  }

  const booked = existing ?? [];
  const openSlots = candidates.filter((start) => {
    const end = start + type.duration;
    return !booked.some((b) => {
      const bStart = b.start_minutes as number;
      const bEnd = bStart + (b.duration_minutes as number);
      return start < bEnd && bStart < end; // overlap check
    });
  });

  return jsonResponse({ slots: openSlots });
});
