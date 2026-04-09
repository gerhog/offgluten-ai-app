import { NextRequest, NextResponse } from "next/server";
import {
  loadUserMemory,
  upsertUserMemory,
  resetMemoryUpdateCounter,
} from "@/lib/chat/memory";
import type { MemoryFact } from "@/types/supabase";

// Allowed schema values — must match the n8n workflow and spec.
const ALLOWED_CATEGORIES = new Set<string>(["medical", "dietary", "preference"]);
const ALLOWED_KEYS = new Set<string>(["diagnosed_with", "avoids", "includes", "prefers", "diet_type"]);
const MAX_FACTS = 7;
const MAX_SUMMARY = 300;

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
// Not exposed to clients. Errors here must never affect the chat response.
export async function POST(req: NextRequest) {
  // 1. Parse request body
  let userId: string;
  let lastUserMessage: string;
  let lastAssistantAnswer: string;

  try {
    const body = await req.json();
    userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    lastUserMessage =
      typeof body?.last_user_message === "string" ? body.last_user_message.trim() : "";
    lastAssistantAnswer =
      typeof body?.last_assistant_answer === "string"
        ? body.last_assistant_answer.trim()
        : "";
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

  // 3. Load current durable memory (null = no row yet, acceptable)
  const currentMemory = await loadUserMemory(userId);

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
        existing_memory: {
          summary: currentMemory?.summary ?? null,
          facts: currentMemory?.facts ?? [],
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

  // 6. Write back to Supabase
  const writeOk = await upsertUserMemory(userId, validated);
  if (!writeOk) {
    console.error("[memory-update] Supabase write failed for user", userId);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }

  // 7. Reset counter only after successful write
  // A failure here is non-critical: memory is already written, counter will retry on next trigger.
  const resetOk = await resetMemoryUpdateCounter(userId);
  if (!resetOk) {
    console.error("[memory-update] Counter reset failed for user", userId, "(memory was written)");
  }

  return NextResponse.json({ ok: true });
}
