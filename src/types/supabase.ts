export type EntitlementStatus = "trial" | "paid" | "beta" | "blocked";

// Durable memory v1 — one row per user, owned by app/Supabase.
// n8n consumes memory.summary and memory.facts for prompt assembly.
export type UserMemory = {
  user_id: string;
  summary: string | null;
  facts: unknown[] | null; // structured fact objects, shape TBD in v1 impl
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  entitlement_status: EntitlementStatus | null;
  trial_messages_used: number;
  created_at: string | null;
  updated_at: string | null;
};
