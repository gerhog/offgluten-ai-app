import { createClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS entirely.
// Use only in trusted server-side contexts (e.g. internal server-to-server endpoints).
// Never expose to the client. Never use for user-facing requests.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
