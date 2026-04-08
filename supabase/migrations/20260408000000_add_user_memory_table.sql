-- Durable memory v1: compact summary + structured facts, keyed by user_id.
-- Owned by the app/Supabase layer; consumed by n8n for prompt assembly.
-- One row per user, upserted on write.

create table if not exists public.user_memory (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  summary   text,
  facts     jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on every write.
create or replace function public.handle_user_memory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_user_memory_updated
  before update on public.user_memory
  for each row execute procedure public.handle_user_memory_updated_at();

-- RLS: users can only read and write their own memory row.
alter table public.user_memory enable row level security;

create policy "user can read own memory"
  on public.user_memory for select
  using (auth.uid() = user_id);

create policy "user can upsert own memory"
  on public.user_memory for insert
  with check (auth.uid() = user_id);

create policy "user can update own memory"
  on public.user_memory for update
  using (auth.uid() = user_id);
