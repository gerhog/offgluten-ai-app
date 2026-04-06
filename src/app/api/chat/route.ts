import { NextRequest, NextResponse } from "next/server";
import { checkChatAccess, incrementTrialUsage } from "@/lib/chat/access";

type ChatStatus =
  | "success"
  | "unauthenticated"
  | "profile_missing"
  | "trial_exhausted"
  | "blocked"
  | "invalid_status"
  | "invalid_request"
  | "temporary_error";

function deny(status: ChatStatus, httpStatus: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ status, ...extra }, { status: httpStatus });
}

// POST /api/chat
// Accepts message + optional session_id, runs access gate, calls n8n webhook.
export async function POST(req: NextRequest) {
  // 1. Parse and validate request body
  let message: string;
  let sessionId: string | undefined;
  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message.trim() : "";
    sessionId = typeof body?.session_id === "string" ? body.session_id : undefined;
  } catch {
    return deny("invalid_request", 400);
  }

  if (!message) {
    return deny("invalid_request", 400, { error: "message is required" });
  }

  // 2. Access gate
  const access = await checkChatAccess();

  if (!access.allowed) {
    const httpStatus = access.reason === "unauthenticated" ? 401 : 403;
    return deny(access.reason, httpStatus);
  }

  // 3. Increment trial counter (trial users only, after validation + access check)
  const isTrial = access.profile.entitlement_status === "trial";
  if (isTrial) {
    const ok = await incrementTrialUsage(access.profile.id);
    if (!ok) {
      return deny("temporary_error", 500);
    }
  }

  // 4. Call n8n webhook
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return deny("temporary_error", 500, { error: "service_misconfigured" });
  }

  const n8nPayload: Record<string, unknown> = {
    user_id: access.profile.id,
    message,
    entitlement_status: access.profile.entitlement_status,
  };
  if (sessionId) {
    n8nPayload.session_id = sessionId;
  }

  let n8nResponse: Response;
  try {
    n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
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

  return NextResponse.json(n8nData);
}
