-- Server-side lap processing: lets a session row exist before laps are known.
-- Run this in Supabase Studio: SQL Editor -> New query -> Run.
-- (One-time migration, run after docs/supabase-schema.sql has already been applied.)

alter table public.sessions
  add column if not exists status text not null default 'ready'
    check (status in ('ready', 'queued', 'processing', 'error')),
  add column if not exists video_storage_path text,
  add column if not exists error_message text,
  -- Recording start time, needed by the server-side worker to compute
  -- accurate wall-clock detection-event timestamps (date/endedAt alone isn't
  -- enough — that's when recording stopped, not started).
  add column if not exists started_at timestamptz;

-- Existing rows (saved before this migration) are all fully-processed already.
update public.sessions set status = 'ready' where status is null;
