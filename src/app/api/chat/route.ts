import { NextResponse } from "next/server";
import { checkChatAccess } from "@/lib/chat/access";

// POST /api/chat
// Entry point for all chat requests.
// Phase 1: access gate only. n8n integration and message handling come next.
export async function POST() {
  const access = await checkChatAccess();

  if (!access.allowed) {
    return NextResponse.json(
      { allowed: false, reason: access.reason },
      { status: 403 }
    );
  }

  // Access granted — n8n integration goes here in the next phase
  return NextResponse.json({
    allowed: true,
    entitlement_status: access.profile.entitlement_status,
    trial_messages_used: access.profile.trial_messages_used,
  });
}
