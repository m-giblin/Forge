-- 0030_issue_dates.sql
-- Timeline tab (Project Portal): give issues an optional start + due date so they
-- can be placed on a lightweight timeline track. Purely additive — nullable
-- columns, no RLS change, no effect on existing rows. Issues without dates simply
-- don't appear on the timeline.
--
-- (Deliberately NOT adding dependencies/estimates — Forge's timeline is the
-- lightweight "what's happening when," not an MS-Project dependency Gantt.)

alter table public.issues
  add column if not exists start_date date,
  add column if not exists due_date   date;

create index if not exists idx_issues_due_date on public.issues(tenant_id, due_date);

insert into public.schema_migrations (filename)
values ('0030_issue_dates.sql')
on conflict do nothing;
