-- 0004_issue_idempotency.sql — optional external_id for idempotent creates.
--
-- Lets an API client (e.g. a Travli outbox worker) pass an Idempotency-Key so
-- a retried request maps to the SAME issue instead of creating duplicates.
-- Partial unique index: many NULLs allowed, but a given external_id is unique
-- within a tenant.

alter table public.issues add column external_id text;

create unique index idx_issues_tenant_external
  on public.issues(tenant_id, external_id)
  where external_id is not null;
