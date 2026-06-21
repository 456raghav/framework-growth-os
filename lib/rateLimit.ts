import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 20; // max 20 messages per minute per IP/conversation

export async function checkRateLimit(identifier: string): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  // Get current count for this identifier in the window
  const { data: existing } = await supabaseAdmin
    .from("rate_limits")
    .select("id, request_count")
    .eq("identifier", identifier)
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .limit(1)
    .single();

  if (!existing) {
    // First request in this window — create record
    await supabaseAdmin.from("rate_limits").insert({
      identifier,
      window_start: new Date().toISOString(),
      request_count: 1,
    });

    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (existing.request_count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  // Increment counter
  await supabaseAdmin
    .from("rate_limits")
    .update({ request_count: existing.request_count + 1 })
    .eq("id", existing.id);

  return {
    allowed: true,
    remaining: MAX_REQUESTS - existing.request_count - 1,
  };
}
