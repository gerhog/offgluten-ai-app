export type EntitlementStatus = "trial" | "paid" | "beta" | "blocked";

// A single structured fact about the user stored in durable memory.
// key: what the fact is about (e.g. "diagnosed_with", "avoids", "prefers")
// value: the content of the fact (e.g. "celiac disease", "oats")
// category: optional grouping (e.g. "medical", "dietary", "preference")
export type MemoryFact = {
  key: string;
  value: string;
  category?: string;
};

// Durable memory v1 — one row per user, owned by app/Supabase.
// n8n consumes memory.summary and memory.facts for prompt assembly.
export type UserMemory = {
  user_id: string;
  summary: string | null;
  facts: MemoryFact[] | null;
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
