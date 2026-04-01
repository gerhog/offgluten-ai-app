export type EntitlementStatus = "trial" | "paid" | "beta" | "blocked";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  entitlement_status: EntitlementStatus | null;
  trial_messages_used: number;
  created_at: string | null;
  updated_at: string | null;
};
