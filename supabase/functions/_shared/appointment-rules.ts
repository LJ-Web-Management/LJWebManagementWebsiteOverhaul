// Business rules for appointment booking — shared by submit-appointment and
// get-availability so the two functions can never disagree about what a
// "valid slot" is. Plain date/time arithmetic, no AI.

export const TIMEZONE = "America/Chicago";
export const WORK_START_MIN = 8 * 60; // 8:00 AM Central
export const WORK_END_MIN = 17 * 60; // 5:00 PM Central

export const APPOINTMENT_TYPES: Record<string, { label: string; duration: number }> = {
  "quick-chat": { label: "Quick Chat", duration: 15 },
  "initial-consult": { label: "Initial Consult", duration: 45 },
  "30-min-consult": { label: "30 Min Consult", duration: 30 },
};

/** "9:00" -> minutes label helper used for admin/email display. */
export function minutesToLabel(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m === 0 ? "" : ":" + String(m).padStart(2, "0")} ${ampm}`;
}

/** Every valid slot start-minute for a given duration, 8am-5pm Central. */
export function generateSlotStarts(durationMin: number): number[] {
  const slots: number[] = [];
  for (let m = WORK_START_MIN; m + durationMin <= WORK_END_MIN; m += durationMin) {
    slots.push(m);
  }
  return slots;
}

/** true if the given Y-M-D calendar date is a Mon-Fri date (weekday check is tz-agnostic). */
export function isWeekday(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** Basic sanity check that a string is a real YYYY-MM-DD date. */
export function isValidDateStr(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Returns the America/Chicago UTC offset (in minutes, e.g. -300 for CDT,
 * -360 for CST) that is in effect at the given instant. DST-correct because
 * it asks the JS/Deno ICU timezone database, not a hardcoded offset.
 */
function getChicagoOffsetMinutes(instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60000;
}

/**
 * Converts a Chicago wall-clock date + minutes-from-midnight into the
 * correct UTC instant, handling CST/CDT automatically.
 */
export function chicagoWallTimeToUtc(dateStr: string, minutesFromMidnight: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const hh = Math.floor(minutesFromMidnight / 60);
  const mm = minutesFromMidnight % 60;
  const naiveUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const offsetMin = getChicagoOffsetMinutes(naiveUtc);
  return new Date(naiveUtc.getTime() - offsetMin * 60000);
}

/** Today's calendar date in America/Chicago, as "YYYY-MM-DD". */
export function chicagoTodayStr(): string {
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }); // en-CA => YYYY-MM-DD
  return dtf.format(new Date());
}

/** Current minutes-from-midnight in America/Chicago right now. */
export function chicagoNowMinutes(): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date())) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const hour = Number(parts.hour) % 24;
  return hour * 60 + Number(parts.minute);
}
