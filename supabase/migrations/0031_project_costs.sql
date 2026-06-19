-- 0031_project_costs.sql
-- Costs tab (Project Portal): simple budget + spend, no time-tracking.
--   * projects.budget_cents      — the project's budget (integer cents, nullable)
--   * project_spend              — one row per logged spend entry
-- Money is stored in integer cents to avoid float rounding. Amounts are not
-- encrypted: a project budget/spend is operational data visible to the team,
-- not PII (contrast tenant_ai_keys). Tenant-scoped + RLS like every other table.

alter table public.projects
  add column if not exists budget_cents bigint;

create table if not exists public.project_spend (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id)  on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  item         text not null,
  category     text,
  amount_cents bigint not null,
  spent_on     date not null default current_date,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_project_spend_tenant  on public.project_spend(tenant_id);
create index if not exists idx_project_spend_project on public.project_spend(project_id);

alter table public.project_spend enable row level security;

-- Read: any member of the tenant.
create policy project_spend_select on public.project_spend
  for select using ( tenant_id in (select public.current_tenant_ids()) );

-- Log / edit / remove spend: contributing members (owner/admin/member, not viewer).
create policy project_spend_insert on public.project_spend
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy project_spend_update on public.project_spend
  for update using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy project_spend_delete on public.project_spend
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

insert into public.schema_migrations (filename)
values ('0031_project_costs.sql')
on conflict do nothing;
