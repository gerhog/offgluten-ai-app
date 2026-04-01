export type Profile = {
  id: string;
  email: string | null;
  entitlement_status: "trial" | "paid" | "beta" | "blocked" | null;
  created_at: string | null;
};
