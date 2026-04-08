export type EntitlementStatus = "trial" | "paid" | "beta" | "blocked";

// Controlled v1 set of fact keys for Offgluten user memory.
export type MemoryFactKey =
  | "diagnosed_with"  // confirmed diagnosis (e.g. "celiac disease", "gluten sensitivity")
  | "avoids"          // ingredients/foods the user avoids (e.g. "oats", "barley")
  | "tolerates"       // foods confirmed safe for this user (e.g. "certified gluten-free oats")
  | "prefers"         // dietary lifestyle preferences (e.g. "vegan", "lactose-free")
  | "diet_type";      // overall diet pattern (e.g. "strict gluten-free", "low-FODMAP")

// Controlled v1 set of fact categories.
export type MemoryFactCategory =
  | "medical"         // diagnosis, symptoms, test context
  | "dietary"         // what to eat or avoid
  | "preference";     // lifestyle or cooking preferences

// A single structured fact about the user stored in durable memory.
export type MemoryFact = {
  key: MemoryFactKey;
  value: string;
  category?: MemoryFactCategory;
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
