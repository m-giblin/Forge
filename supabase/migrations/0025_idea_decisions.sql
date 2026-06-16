-- Migration 0025: formal decisions linked to Think Tank ideas

create table if not exists public.idea_decisions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  idea_id      uuid not null references public.ideas(id) on delete cascade,
  title        text not null,
  body         text,
  decided_by   uuid references public.users(id) on delete set null,
  is_deleted   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_idea_decisions_idea   on public.idea_decisions(idea_id);
create index idx_idea_decisions_tenant on public.idea_decisions(tenant_id);

create trigger trg_idea_decisions_updated
  before update on public.idea_decisions
  for each row execute function public.set_updated_at();

alter table public.idea_decisions enable row level security;

-- Members can read decisions for ideas in their tenant
create policy idea_decisions_select on public.idea_decisions
  for select using (
    tenant_id in (select public.current_tenant_ids())
    and is_deleted = false
  );

-- Admins/owners can insert decisions
create policy idea_decisions_insert on public.idea_decisions
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

-- Admins/owners can soft-delete
create policy idea_decisions_update on public.idea_decisions
  for update using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

notify pgrst, 'reload schema';

insert into public.schema_migrations (filename, notes)
  values ('0025_idea_decisions.sql', 'Formal decisions table linked to Think Tank ideas')
  on conflict (filename) do nothing;
