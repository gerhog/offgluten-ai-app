import { NextRequest, NextResponse } from "next/server";
import { checkChatAccess, incrementTrialUsage } from "@/lib/chat/access";
import { loadUserMemoryForChat, incrementAnsweredCounter } from "@/lib/chat/memory";
import {
  validatePendingAttachment,
  confirmAttachment,
  revertAttachmentToPending,
  generateAttachmentSignedUrl,
  classifyAttachment,
  persistAttachmentMode,
  type AttachmentMode,
} from "@/lib/chat/attachments";

export const maxDuration = 60;

type ChatStatus =
  | "success"
  | "unauthenticated"
  | "profile_missing"
  | "trial_exhausted"
  | "blocked"
  | "invalid_status"
  | "invalid_request"
  | "temporary_error"
  | "attachment_not_found"
  | "attachment_not_owned"
  | "attachment_not_pending"
  | "attachment_invalid"
  | "attachment_unavailable";

function deny(status: ChatStatus, httpStatus: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ status, ...extra }, { status: httpStatus });
}

// POST /api/chat
// Accepts message + optional session_id, runs access gate, calls n8n webhook.
export async function POST(req: NextRequest) {
  // 1. Parse and validate request body
  let message: string;
  let sessionId: string | undefined;
  let attachmentId: string | undefined;
  let recentTurns: Array<{ role: string; text: string }> = [];
  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message.trim() : "";
    sessionId = typeof body?.session_id === "string" ? body.session_id : undefined;
    // attachment_id: the id returned by POST /api/attachments/upload.
    // Ownership is verified server-side — do not trust any other client-supplied attachment fields.
    attachmentId =
      typeof body?.attachment_id === "string" && body.attachment_id.trim()
        ? body.attachment_id.trim()
        : undefined;
    // Sanitize recent_turns: only user/assistant roles, plain text, hard limits.
    // Never used for access or billing — memory context only.
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
    return deny("invalid_request", 400);
  }

  if (!message) {
    return deny("invalid_request", 400, { error: "message is required" });
  }

  // 2. Access gate
  // Trial enforcement: trial users may use attachments only within the same 3-message budget.
  // No separate attachment quota exists. If access is denied here, the attachment is never confirmed.
  const access = await checkChatAccess();

  if (!access.allowed) {
    const httpStatus = access.reason === "unauthenticated" ? 401 : 403;
    return deny(access.reason, httpStatus);
  }

  // 3. Validate attachment before spending a trial credit.
  // Checks: exists, belongs to this user, status=pending, MIME in allowlist.
  // Pending accumulation abuse (uploading many files without sending) is bounded by the
  // 15-minute pg_cron cleanup; no separate per-user limit is enforced here (deferred).
  let attachmentMeta: { storagePath: string; mimeType: string; fileName: string } | null = null;
  if (attachmentId) {
    const validation = await validatePendingAttachment(attachmentId, access.profile.id);
    if (!validation.ok) {
      return deny(validation.reason, validation.httpStatus);
    }
    attachmentMeta = {
      storagePath: validation.storagePath,
      mimeType: validation.mimeType,
      fileName: validation.fileName,
    };
  }

  // 4. Increment trial counter (trial users only, after access check + attachment validation)
  const isTrial = access.profile.entitlement_status === "trial";
  if (isTrial) {
    const ok = await incrementTrialUsage(access.profile.id);
    if (!ok) {
      return deny("temporary_error", 500);
    }
  }

  // 5. Confirm attachment and generate signed URL now that the request is fully admitted.
  // Ordering: confirm only after trial increment — ensures a trial credit is spent before
  // the attachment transitions to confirmed. If confirm or signed URL fails, the attachment
  // remains pending and will be cleaned up by cron; the trial counter increment is not reversed
  // (consistent with existing behavior for downstream failures such as n8n errors).
  let attachmentPayload: {
    id: string;
    mime_type: string;
    file_name: string;
    signed_url: string;
    attachment_mode: AttachmentMode;
  } | null = null;

  if (attachmentId && attachmentMeta) {
    const confirm = await confirmAttachment(attachmentId, access.profile.id);
    if (!confirm.ok) {
      return deny("attachment_unavailable", 409);
    }

    const signedUrl = await generateAttachmentSignedUrl(confirm.storagePath);
    if (!signedUrl) {
      // Compensate: revert to pending so the user can retry.
      await revertAttachmentToPending(attachmentId, access.profile.id);
      return deny("attachment_unavailable", 500);
    }

    // Classify (pure, no I/O) then persist. Revert to pending if persist fails —
    // avoids leaving a confirmed row without a mode.
    const mode = classifyAttachment(attachmentMeta.mimeType, attachmentMeta.fileName);
    const modeOk = await persistAttachmentMode(attachmentId, access.profile.id, mode);
    if (!modeOk) {
      await revertAttachmentToPending(attachmentId, access.profile.id);
      return deny("attachment_unavailable", 500);
    }

    attachmentPayload = {
      id: attachmentId,
      mime_type: attachmentMeta.mimeType,
      file_name: attachmentMeta.fileName,
      signed_url: signedUrl,
      attachment_mode: mode,
    };
  }

  // 6. Load durable memory + check update due (paid / beta only; missing row is not an error)
  const isDurable =
    access.profile.entitlement_status === "paid" ||
    access.profile.entitlement_status === "beta";
  const { memory, updateDue } = isDurable
    ? await loadUserMemoryForChat(access.profile.id)
    : { memory: null, updateDue: false };

  // 7. Call n8n webhook
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return deny("temporary_error", 500, { error: "service_misconfigured" });
  }

  const n8nPayload: Record<string, unknown> = {
    user_id: access.profile.id,
    message,
    entitlement_status: access.profile.entitlement_status,
    has_attachment: attachmentPayload !== null,
  };
  if (attachmentPayload) {
    n8nPayload.attachment_mode = attachmentPayload.attachment_mode;
    n8nPayload.attachment = attachmentPayload;
  }
  if (sessionId) {
    n8nPayload.session_id = sessionId;
  }
  if (memory) {
    n8nPayload.memory = memory;
  }
  if (recentTurns.length > 0) {
    n8nPayload.recent_turns = recentTurns;
  }

  let n8nResponse: Response;
  try {
    n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
      signal: AbortSignal.timeout(35000),
    });
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === "AbortError";
    console.error("[chat] n8n fetch failed:", isTimeout ? "timeout (35s)" : e);
    return deny("temporary_error", 503, { error: "service_unavailable" });
  }

  if (!n8nResponse.ok) {
    return deny("temporary_error", 503, { error: "service_unavailable" });
  }

  let n8nData: unknown;
  try {
    n8nData = await n8nResponse.json();
  } catch {
    return deny("temporary_error", 503, { error: "service_unavailable" });
  }

  // 8. Post-response side effects (paid/beta, answered only — fire-and-forget, do not block).
  const n8n = n8nData as Record<string, unknown>;
  if (isDurable && n8n.status === "answered") {
    // Increment the answered counter. Awaited so Vercel doesn't kill the promise before it completes.
    await incrementAnsweredCounter(access.profile.id);

    // Trigger memory update when due. Extract assistant answer from the n8n response.
    if (updateDue) {
      const lastAnswer =
        (typeof n8n.answer === "string" ? n8n.answer : "") ||
        (typeof n8n.message === "string" ? n8n.message : "");

      if (lastAnswer.trim()) {
        const internalUrl = new URL("/api/internal/memory-update", req.url).href;
        // Awaited so Vercel doesn't kill the request before it reaches /api/internal/memory-update.
        // Adds latency only on trigger messages (every ~5 answered turns).
        try {
          const triggerRes = await fetch(internalUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: access.profile.id,
              last_user_message: message,
              last_assistant_answer: lastAnswer.trim(),
              recent_turns: recentTurns,
            }),
            // Cap wait time so a slow memory-update pipeline doesn't block the chat response.
            // Memory counter is not reset on timeout — the trigger will retry on the next turn.
            signal: AbortSignal.timeout(20000),
          });
          if (!triggerRes.ok) {
            console.error("[chat] memory-update trigger HTTP error:", triggerRes.status);
          }
        } catch (e) {
          const isTimeout = e instanceof Error && e.name === "AbortError";
          console.error("[chat] memory-update trigger failed:", isTimeout ? "timeout (20s)" : e);
        }
      }
    }
  }

  return NextResponse.json(n8nData);
}
