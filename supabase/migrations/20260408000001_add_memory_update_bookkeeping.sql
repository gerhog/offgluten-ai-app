-- Bookkeeping fields for memory-update cadence.
-- Tracks how many answered messages have occurred since the last memory update.
-- Due condition: answered_since_last_memory_update >= 5 (MEMORY_UPDATE_THRESHOLD).

alter table public.user_memory
  add column answered_since_last_memory_update integer not null default 0,
  add column last_memory_update_at timestamptz;

-- Atomic counter increment via upsert.
-- Initializes the user_memory row if absent (handles new paid/beta users
-- who have not yet had any memory written).
create or replace function public.increment_answered_counter(p_user_id uuid)
returns void
language sql
security definer
as $$
  insert into public.user_memory (user_id, answered_since_last_memory_update)
  values (p_user_id, 1)
  on conflict (user_id) do update
    set answered_since_last_memory_update =
      public.user_memory.answered_since_last_memory_update + 1;
$$;
