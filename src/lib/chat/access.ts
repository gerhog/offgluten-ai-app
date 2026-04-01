import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/supabase";

export const TRIAL_LIMIT = 3;

export type ChatAccessDeniedReason =
  | "unauthenticated"
  | "profile_missing"
  | "trial_exhausted"
  | "blocked"
  | "invalid_status";

export type ChatAccessResult =
  | { allowed: true; profile: Profile }
  | { allowed: false; reason: ChatAccessDeniedReason };

export async function incrementTrialUsage(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("increment_trial_usage", { user_id: userId });
  return !error;
}

export async function checkChatAccess(): Promise<ChatAccessResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, reason: "unauthenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, entitlement_status, trial_messages_used, created_at, updated_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    return { allowed: false, reason: "profile_missing" };
  }

  const status = profile.entitlement_status;

  switch (status) {
    case "paid":
    case "beta":
      return { allowed: true, profile };

    case "trial":
      if (profile.trial_messages_used < TRIAL_LIMIT) {
        return { allowed: true, profile };
      }
      return { allowed: false, reason: "trial_exhausted" };

    case "blocked":
      return { allowed: false, reason: "blocked" };

    default:
      // Handles legacy 'guest' or any unknown value from DB
      return { allowed: false, reason: "invalid_status" };
  }
}
