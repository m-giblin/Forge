-- 0029_idea_signoffs.sql
-- Design C ("decision-driven idea → project"): cross-functional sign-offs on a
-- Think Tank idea. Discussion (idea_comments) and the decision log
-- (idea_decisions, migration 0025) already exist; this adds the missing piece —
-- Design / Product / Engineering each recording approval before an idea is
-- marked ready / converted to a project.
--
-- A row EXISTS only when a role has approved; absence = pending. To withdraw an
-- approval, delete the row. unique(idea_id, role) keeps it to one per role.
--
-- Founder decisions (2026-06-17): SOFT gate (UI warns but never blocks — no DB
-- enforcement here); roles fixed to design/product/engineering for v1; ANY
-- tenant member may sign (trust-based, small-team model), so insert/delete are
-- open to owner/admin/member (viewers excluded).

create table if not exists public.idea_signoffs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  idea_id      uuid not null references public.ideas(id)   on delete cascade,
  role         text not null check (role in ('design', 'product', 'engineering')),
  approved_by  uuid references public.users(id) on delete set null,
  note         text,
  created_at   timestamptz not null default now(),
  unique (idea_id, role)
);

create index if not exists idx_idea_signoffs_idea   on public.idea_signoffs(idea_id);
create index if not exists idx_idea_signoffs_tenant on public.idea_signoffs(tenant_id);

alter table public.idea_signoffs enable row level security;

-- Read: any member of the tenant.
create policy idea_signoffs_select on public.idea_signoffs
  for select using ( tenant_id in (select public.current_tenant_ids()) );

-- Sign / withdraw: any contributing member (owner/admin/member, not viewer).
create policy idea_signoffs_insert on public.idea_signoffs
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy idea_signoffs_delete on public.idea_signoffs
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

insert into public.schema_migrations (filename)
values ('0029_idea_signoffs.sql')
on conflict do nothing;
