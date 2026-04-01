-- Atomic trial usage increment via Postgres-side SQL.
-- Replaces read-then-write pattern in app code to eliminate race condition.
CREATE OR REPLACE FUNCTION increment_trial_usage(user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET trial_messages_used = trial_messages_used + 1
  WHERE id = user_id;
$$;
