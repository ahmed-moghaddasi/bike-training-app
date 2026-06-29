-- The service_role Postgres role bypasses RLS but still needs ordinary
-- table-level GRANTs — confirmed missing by a real failed worker run
-- ("permission denied for table sessions") even with a valid service-role
-- key, because the original schema only granted to authenticated/anon.
grant select, insert, update, delete on public.sessions to service_role;
grant select, insert, update, delete on public.laps to service_role;
grant select, insert, update, delete on public.detection_events to service_role;
