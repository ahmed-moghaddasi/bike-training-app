-- Run this once if you already ran the first authenticated-only schema.
-- It switches the prototype to no-login anonymous saving.

alter table public.sessions
  alter column user_id drop not null;

alter table public.sessions
  add column if not exists client_id text;

create index if not exists sessions_client_date_idx on public.sessions(client_id, date desc);

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
