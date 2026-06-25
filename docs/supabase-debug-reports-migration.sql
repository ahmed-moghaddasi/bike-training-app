-- Apex Lab / Bike Training: lap-detector debug reports
-- Run this in Supabase Studio: SQL Editor -> New query -> Run.
-- Dev-only tooling: lets the app upload lapDetector diagnostics (frame signal,
-- candidate accept/reject log) so they can be queried directly instead of
-- pasted by hand after every test recording.

create table if not exists public.debug_reports (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  drill_id text not null,
  started_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists debug_reports_created_idx on public.debug_reports(created_at desc);

grant select, insert on public.debug_reports to anon, authenticated;

alter table public.debug_reports enable row level security;

drop policy if exists "Anyone can insert debug reports" on public.debug_reports;
create policy "Anyone can insert debug reports"
on public.debug_reports for insert
to authenticated, anon
with check (true);

drop policy if exists "Anyone can read debug reports" on public.debug_reports;
create policy "Anyone can read debug reports"
on public.debug_reports for select
to authenticated, anon
using (true);
