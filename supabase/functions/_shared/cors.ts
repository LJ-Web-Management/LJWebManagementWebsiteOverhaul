// Shared CORS headers for all Edge Functions.
//
// This is wide open (Access-Control-Allow-Origin: *) because these
// endpoints only accept form submissions — there is nothing behind them
// worth protecting with origin checks, and the honeypot + server-side
// validation in each function is the actual spam defense. If you want to
// lock it down to just your domain later, replace "*" with your site's
// origin (e.g. "https://ljwebmanagement.com").
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
