-- Support ticket attachments (stored as JSONB array of {name, type, size, data})
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';

-- Member job titles (display-only label, Option A roles)
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Feature flag: job_titles (default off — AI/Enterprise tier)
INSERT INTO public.feature_flags (key, label, enabled, description)
VALUES ('job_titles', 'Job Titles', false, 'Member job title labels — visible on cards, assignments, and member list. AI/Enterprise tier.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.schema_migrations (filename)
VALUES ('0056_support_attachments_job_titles.sql')
ON CONFLICT DO NOTHING;
