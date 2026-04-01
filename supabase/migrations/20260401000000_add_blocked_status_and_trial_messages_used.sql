-- Migration: add_blocked_status_and_trial_messages_used
-- Aligns entitlement_status enum and profiles table with MVP v1 access model.
--
-- Target access model: trial | paid | beta | blocked
-- Note: 'guest' is kept in the enum at DB level (deprecated, no app logic relies on it).
--       Removing an enum value in Postgres requires full type recreation — deferred as unnecessary.

-- Add 'blocked' value to entitlement_status enum
ALTER TYPE entitlement_status ADD VALUE IF NOT EXISTS 'blocked';

-- Add trial_messages_used to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_messages_used integer NOT NULL DEFAULT 0
    CONSTRAINT trial_messages_used_non_negative CHECK (trial_messages_used >= 0);
