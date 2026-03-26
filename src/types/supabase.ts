export type Profile = {
  id: string;
  email: string | null;
  entitlement_status: "free" | "pro" | "cancelled" | null;
  created_at: string | null;
};
