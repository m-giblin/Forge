-- 0113_workflow_settings.sql — per-tenant toggle to restrict status changes to
-- adjacent workflow steps only (uses the existing tenant_field_options.position
-- ordering from migration 0007; no new ordering concept needed).

alter table public.tenants
  add column if not exists restrict_status_transitions boolean not null default false;

insert into public.schema_migrations (filename)
values ('0113_workflow_settings.sql') on conflict do nothing;
