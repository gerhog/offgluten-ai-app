import { NextRequest, NextResponse } from "next/server";
import { checkChatAccess, incrementTrialUsage, TRIAL_LIMIT } from "@/lib/chat/access";

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
// Phase 2: accepts message body, access gate, trial increment, stub reply.
// n8n integration replaces stub reply in the next phase.
export async function POST(req: NextRequest) {
  // 1. Parse and validate request body
  let message: string;
  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message.trim() : "";
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

  // 4. Stub success response — replaced by n8n call in next phase
  return NextResponse.json({
    status: "success" as ChatStatus,
    reply: "AI response coming soon.",
    ...(isTrial && {
      trial_messages_used: access.profile.trial_messages_used + 1,
      trial_limit: TRIAL_LIMIT,
    }),
  });
}
