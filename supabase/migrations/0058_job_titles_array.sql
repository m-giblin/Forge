-- Convert job_title (TEXT, single value) → job_titles (TEXT[], multi-select)
-- Migration 0056 added job_title TEXT; this widens it to an array so members
-- can carry multiple titles (e.g. "Team Lead" + "Developer" in small shops).

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS job_titles TEXT[] NOT NULL DEFAULT '{}';

-- Preserve any existing single-value data
UPDATE public.memberships
  SET job_titles = ARRAY[job_title]
  WHERE job_title IS NOT NULL AND job_title <> '';

ALTER TABLE public.memberships
  DROP COLUMN IF EXISTS job_title;

INSERT INTO public.schema_migrations (filename)
VALUES ('0058_job_titles_array.sql')
ON CONFLICT DO NOTHING;
