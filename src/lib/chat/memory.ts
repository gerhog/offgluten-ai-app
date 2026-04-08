import { createClient } from "@/lib/supabase/server";
import type { MemoryFact } from "@/types/supabase";

export type UserMemoryPayload = {
  summary: string | null;
  facts: MemoryFact[] | null;
};

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
