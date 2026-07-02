-- Straight Line drill: per-rep braking metrics stored alongside standard lap fields.
alter table public.laps
  add column if not exists entry_speed_kph numeric,
  add column if not exists stopping_distance_meters numeric,
  add column if not exists braking_duration_ms integer,
  add column if not exists speed_method text check (speed_method in ('direct', 'kinematic'));
