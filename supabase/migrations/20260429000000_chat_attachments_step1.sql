-- ============================================================
-- Chat Attachments: Step 1
-- Private storage bucket, lifecycle table, RLS, cleanup cron
-- ============================================================

-- 1. Private storage bucket: chat-attachments
-- Not publicly accessible. All reads/writes go through server (service role) only.
-- File type and size limits here are a secondary enforcement layer;
-- primary validation happens in the upload API route (Step 2).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- 2. Attachments lifecycle table
-- Tracks files from pending upload through confirmation and eventual expiry.
-- Status flow: pending -> confirmed (on message send) -> orphaned (on expiry or abandonment)
-- Physical deletion of orphaned storage files is handled by a cleanup function (deferred to Step 2+).
--
-- attachment_mode is nullable: set to null while pending, populated at confirmation time (Step 3/4).
-- Including it here avoids a future ALTER TABLE and keeps all attachment state in one row.
create table public.attachments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  attachment_mode text check (attachment_mode in ('medical_document', 'generic_attachment')),
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'orphaned')),
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  expires_at      timestamptz
);

-- 3. Indexes for cleanup and ownership queries
create index attachments_user_status_idx
  on public.attachments (user_id, status);

-- Partial index: only pending rows need fast lookup by age for cleanup
create index attachments_pending_cleanup_idx
  on public.attachments (created_at)
  where status = 'pending';

-- Partial index: only confirmed rows need expiry scanning
create index attachments_expiry_idx
  on public.attachments (expires_at)
  where status = 'confirmed';

-- 4. RLS
-- Authenticated users can read their own records only.
-- All write operations (INSERT, UPDATE, DELETE) are performed by the server via service role,
-- which bypasses RLS. No user-accessible write policies are added intentionally.
alter table public.attachments enable row level security;

create policy "users can select own attachments"
  on public.attachments for select
  to authenticated
  using (auth.uid() = user_id);

-- 5. Cleanup cron jobs
-- pg_cron marks rows as 'orphaned'; physical storage deletion is handled separately (deferred).
-- Orphaned rows retain the storage_path so a cleanup function can locate and delete the files.
create extension if not exists pg_cron with schema pg_catalog;

-- Every 15 minutes: mark abandoned pending uploads as orphaned.
select cron.schedule(
  'mark-orphaned-pending-attachments',
  '*/15 * * * *',
  $$
    update public.attachments
    set status = 'orphaned'
    where status = 'pending'
      and created_at < now() - interval '15 minutes';
  $$
);

-- Daily at 03:00 UTC: mark confirmed attachments past their 30-day retention as orphaned.
select cron.schedule(
  'mark-expired-confirmed-attachments',
  '0 3 * * *',
  $$
    update public.attachments
    set status = 'orphaned'
    where status = 'confirmed'
      and expires_at is not null
      and expires_at < now();
  $$
);
