-- Adds a `phase` column to issues for tracking which development phase
-- an issue belongs to (Discovery, Design, Development, Testing, Deployment).
-- Nullable; null means no phase set. Fixed vocabulary enforced in application code.

alter table public.issues
  add column if not exists phase text;

comment on column public.issues.phase is 'Development phase: discovery | design | development | testing | deployment';
