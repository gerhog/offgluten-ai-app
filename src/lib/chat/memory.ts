import { createClient } from "@/lib/supabase/server";
import type { MemoryFact } from "@/types/supabase";

// Memory update fires after this many answered messages for paid/beta users.
export const MEMORY_UPDATE_THRESHOLD = 5;

// Returns true when the answered counter has reached the update threshold.
export function isMemoryUpdateDue(answeredSinceLastUpdate: number): boolean {
  return answeredSinceLastUpdate >= MEMORY_UPDATE_THRESHOLD;
}

// Atomically increments the answered counter for a paid/beta user.
// Initializes the user_memory row if it does not yet exist.
// Designed for fire-and-forget use — logs errors, does not throw.
export async function incrementAnsweredCounter(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("increment_answered_counter", {
    p_user_id: userId,
  });
  if (error) {
    console.error("[memory] incrementAnsweredCounter failed:", error.message);
  }
}

export type UserMemoryPayload = {
  summary: string | null;
  facts: MemoryFact[] | null;
};

// Upserts durable memory for a user. Overwrites summary and facts if the row
// already exists; inserts a new row if it does not. Returns true on success.
export async function upsertUserMemory(
  userId: string,
  payload: UserMemoryPayload
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase.from("user_memory").upsert(
    {
      user_id: userId,
      summary: payload.summary,
      facts: payload.facts,
    },
    { onConflict: "user_id" }
  );

  return !error;
}

// Reads durable memory for a user. Returns null if no row exists — callers
// must treat null as "no memory yet" and continue normally.
export async function loadUserMemory(userId: string): Promise<UserMemoryPayload | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_memory")
    .select("summary, facts")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    summary: data.summary ?? null,
    facts: (data.facts as MemoryFact[] | null) ?? null,
  };
}
