import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { MemoryFact } from "@/types/supabase";

// Allowed schema values — must match the n8n workflow and spec.
const ALLOWED_CATEGORIES = new Set<string>(["medical", "dietary", "preference"]);
const ALLOWED_KEYS = new Set<string>(["diagnosed_with", "avoids", "includes", "prefers", "diet_type"]);
const MAX_FACTS = 7;
const MAX_SUMMARY = 300;

// Keys that can hold multiple distinct values (e.g. avoids: oats AND avoids: barley).
// All other keys are treated as single-value and replaced by key on update.
const MULTI_VALUE_KEYS = new Set<string>(["avoids", "includes"]);

// Merges incoming facts from n8n into the existing fact list.
// Rules:
//   - Multi-value keys (avoids, includes): add if (key, value) pair not already present.
//   - Single-value keys (diagnosed_with, prefers, diet_type): replace the existing fact
//     with the same key; add if none exists.
//   - Existing facts always keep their slots; new facts are added only when MAX_FACTS allows.
function mergeFacts(existing: MemoryFact[], incoming: MemoryFact[]): MemoryFact[] {
  const result: MemoryFact[] = [...existing];

  for (const newFact of incoming) {
    if (MULTI_VALUE_KEYS.has(newFact.key)) {
      const duplicate = result.some(
        (f) => f.key === newFact.key && f.value.toLowerCase() === newFact.value.toLowerCase()
      );
      if (!duplicate && result.length < MAX_FACTS) {
        result.push(newFact);
      }
    } else {
      const idx = result.findIndex((f) => f.key === newFact.key);
      if (idx !== -1) {
        result[idx] = newFact; // replace in place — no size change
      } else if (result.length < MAX_FACTS) {
        result.push(newFact);
      }
    }
  }

  return result;
}

// Validates and cleans the n8n response. Returns null if the shape is invalid.
function validateN8nResponse(
  raw: unknown
): { summary: string | null; facts: MemoryFact[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;

  if (!("summary" in d) || !("facts" in d)) return null;

  const rawSummary = d.summary;
  let summary: string | null = null;
  if (typeof rawSummary === "string") {
    const trimmed = rawSummary.trim();
    summary = trimmed.length > 0 ? trimmed.slice(0, MAX_SUMMARY) : null;
  } else if (rawSummary !== null && rawSummary !== undefined) {
    return null; // unexpected type
  }

  if (!Array.isArray(d.facts)) return null;

  const facts: MemoryFact[] = [];
  for (const f of d.facts) {
    if (!f || typeof f !== "object") continue;
    const fact = f as Record<string, unknown>;
    const key = fact.key;
    const value = fact.value;
    const category = fact.category;
    if (
      typeof key === "string" &&
      typeof value === "string" &&
      typeof category === "string" &&
      ALLOWED_KEYS.has(key) &&
      ALLOWED_CATEGORIES.has(category) &&
      value.trim().length > 0
    ) {
      facts.push({
        key: key as MemoryFact["key"],
        value: value.trim(),
        category: category as MemoryFact["category"],
      });
      if (facts.length === MAX_FACTS) break;
    }
  }

  return { summary, facts };
}

// POST /api/internal/memory-update
// Internal endpoint — called fire-and-forget by /api/chat when a memory update is due.
// Uses service role client (bypasses RLS) because this is a server-to-server call
// with no user session cookies. Errors here must never affect the chat response.
export async function POST(req: NextRequest) {
  // 1. Parse request body
  let userId: string;
  let lastUserMessage: string;
  let lastAssistantAnswer: string;
  let recentTurns: Array<{ role: string; text: string }> = [];

  try {
    const body = await req.json();
    userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    lastUserMessage =
      typeof body?.last_user_message === "string" ? body.last_user_message.trim() : "";
    lastAssistantAnswer =
      typeof body?.last_assistant_answer === "string"
        ? body.last_assistant_answer.trim()
        : "";
    if (Array.isArray(body?.recent_turns)) {
      recentTurns = (body.recent_turns as unknown[])
        .filter((t): t is { role: string; text: string } => {
          if (!t || typeof t !== "object") return false;
          const r = (t as Record<string, unknown>).role;
          const x = (t as Record<string, unknown>).text;
          return (r === "user" || r === "assistant") && typeof x === "string" && x.trim().length > 0;
        })
        .slice(-5)
        .map((t) => ({ role: t.role, text: t.text.slice(0, 500) }));
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  if (!userId || !lastUserMessage || !lastAssistantAnswer) {
    return NextResponse.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  // 2. Check env
  const webhookUrl = process.env.N8N_MEMORY_UPDATE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("[memory-update] N8N_MEMORY_UPDATE_WEBHOOK_URL is not set");
    return NextResponse.json({ ok: false, error: "misconfigured" }, { status: 500 });
  }

  // 3. Load current durable memory via service client (no user session in this context)
  const supabase = createServiceClient();

  const { data: memoryRow } = await supabase
    .from("user_memory")
    .select("summary, facts")
    .eq("user_id", userId)
    .maybeSingle();

  const currentSummary = memoryRow?.summary ?? null;
  const currentFacts = (memoryRow?.facts as MemoryFact[] | null) ?? [];

  // 4. Call n8n memory-update workflow
  let n8nRaw: unknown;
  try {
    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        latest_turn: {
          user_message: lastUserMessage,
          assistant_answer: lastAssistantAnswer,
        },
        recent_turns: recentTurns,
        existing_memory: {
          summary: currentSummary,
          facts: currentFacts,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!n8nResponse.ok) {
      console.error("[memory-update] n8n returned HTTP", n8nResponse.status, "for user", userId);
      return NextResponse.json({ ok: false, error: "n8n_error" }, { status: 502 });
    }

    n8nRaw = await n8nResponse.json();
  } catch (e) {
    console.error("[memory-update] n8n call failed for user", userId, e);
    return NextResponse.json({ ok: false, error: "n8n_unavailable" }, { status: 503 });
  }

  // 5. Validate response shape
  const validated = validateN8nResponse(n8nRaw);
  if (!validated) {
    console.error(
      "[memory-update] n8n response failed validation for user",
      userId,
      JSON.stringify(n8nRaw)
    );
    return NextResponse.json({ ok: false, error: "n8n_validation_failed" }, { status: 502 });
  }

  // 6. Merge new facts into existing, then write back to Supabase via service client.
  // summary is replaced outright; facts are merged to avoid losing existing entries.
  const mergedFacts = mergeFacts(currentFacts, validated.facts);

  const { error: upsertError } = await supabase.from("user_memory").upsert(
    { user_id: userId, summary: validated.summary, facts: mergedFacts },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    console.error("[memory-update] Supabase write failed for user", userId, upsertError.message);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }

  // 7. Reset counter only after successful write
  // A failure here is non-critical: memory is already written, counter will retry on next trigger.
  const { error: resetError } = await supabase
    .from("user_memory")
    .update({
      answered_since_last_memory_update: 0,
      last_memory_update_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (resetError) {
    console.error("[memory-update] Counter reset failed for user", userId, "(memory was written)");
  }

  return NextResponse.json({ ok: true });
}
