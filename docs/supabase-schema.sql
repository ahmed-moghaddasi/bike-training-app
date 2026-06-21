-- Apex Lab / Bike Training backend setup
-- Run this in Supabase Studio: SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  client_id text,
  date timestamptz not null,
  bike_id text not null,
  drill_id text not null,
  setup_variant_id text not null,
  video_path text,
  video_saved boolean not null default false,
  notes text,
  best_lap numeric,
  average_lap numeric,
  spread numeric,
  lap_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.laps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  lap_number integer not null,
  time numeric not null,
  timestamp_in_video numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.detection_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  event_type text not null check (event_type in ('sessionStart', 'lapDetected')),
  detected_at timestamptz not null,
  video_timestamp numeric not null,
  lap_number integer,
  score numeric,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_date_idx on public.sessions(user_id, date desc);
create index if not exists sessions_client_date_idx on public.sessions(client_id, date desc);
create index if not exists laps_session_idx on public.laps(session_id, lap_number);
create index if not exists detection_events_session_idx on public.detection_events(session_id, detected_at);

grant select, insert, update, delete on public.sessions to anon, authenticated;
grant select, insert on public.laps to anon, authenticated;
grant select, insert on public.detection_events to anon, authenticated;

alter table public.sessions enable row level security;
alter table public.laps enable row level security;
alter table public.detection_events enable row level security;

drop policy if exists "Users can read own sessions" on public.sessions;
create policy "Users can read own sessions"
on public.sessions for select
to authenticated, anon
using (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can insert own sessions" on public.sessions;
create policy "Users can insert own sessions"
on public.sessions for insert
to authenticated, anon
with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can update own sessions" on public.sessions;
create policy "Users can update own sessions"
on public.sessions for update
to authenticated, anon
using (
  auth.uid() = user_id
  or (user_id is null and client_id is not null)
)
with check (
  auth.uid() = user_id
  or (user_id is null and client_id is not null)
);

drop policy if exists "Users can delete own sessions" on public.sessions;
create policy "Users can delete own sessions"
on public.sessions for delete
to authenticated, anon
using (
  auth.uid() = user_id
  or (user_id is null and client_id is not null)
);

drop policy if exists "Users can read own laps" on public.laps;
create policy "Users can read own laps"
on public.laps for select
to authenticated, anon
using (
  exists (
    select 1 from public.sessions
    where sessions.id = laps.session_id
      and (sessions.user_id = auth.uid() or sessions.user_id is null)
  )
);

drop policy if exists "Users can insert own laps" on public.laps;
create policy "Users can insert own laps"
on public.laps for insert
to authenticated, anon
with check (
  exists (
    select 1 from public.sessions
    where sessions.id = laps.session_id
      and (sessions.user_id = auth.uid() or sessions.user_id is null)
  )
);

drop policy if exists "Users can read own detection events" on public.detection_events;
create policy "Users can read own detection events"
on public.detection_events for select
to authenticated, anon
using (
  exists (
    select 1 from public.sessions
    where sessions.id = detection_events.session_id
      and (sessions.user_id = auth.uid() or sessions.user_id is null)
  )
);

drop policy if exists "Users can insert own detection events" on public.detection_events;
create policy "Users can insert own detection events"
on public.detection_events for insert
to authenticated, anon
with check (
  exists (
    select 1 from public.sessions
    where sessions.id = detection_events.session_id
      and (sessions.user_id = auth.uid() or sessions.user_id is null)
  )
);

insert into storage.buckets (id, name, public)
values ('session-videos', 'session-videos', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload own session videos" on storage.objects;
create policy "Users can upload own session videos"
on storage.objects for insert
to authenticated, anon
with check (
  bucket_id = 'session-videos'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or split_part(name, '/', 1) = 'anonymous'
  )
);

drop policy if exists "Users can read own session videos" on storage.objects;
create policy "Users can read own session videos"
on storage.objects for select
to authenticated, anon
using (
  bucket_id = 'session-videos'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or split_part(name, '/', 1) = 'anonymous'
  )
);

drop policy if exists "Users can update own session videos" on storage.objects;
create policy "Users can update own session videos"
on storage.objects for update
to authenticated, anon
using (
  bucket_id = 'session-videos'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or split_part(name, '/', 1) = 'anonymous'
  )
)
with check (
  bucket_id = 'session-videos'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or split_part(name, '/', 1) = 'anonymous'
  )
);

drop policy if exists "Users can delete own session videos" on storage.objects;
create policy "Users can delete own session videos"
on storage.objects for delete
to authenticated, anon
using (
  bucket_id = 'session-videos'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or split_part(name, '/', 1) = 'anonymous'
  )
);
