import { createClient } from "@/lib/supabase/server";
import type { MemoryFact } from "@/types/supabase";

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
