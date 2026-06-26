-- Migration 0061: OKRs (Objectives & Key Results)
-- Lets teams define company/team OKRs and link Think Tank ideas to them.
-- Issues can also reference an OKR via okr_id for alignment tracking.

create table if not exists public.okrs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  title        text not null,
  description  text,
  owner_id     uuid references public.users(id) on delete set null,
  quarter      text,               -- e.g. "Q3 2026"
  status       text not null default 'active' check (status in ('draft','active','achieved','missed')),
  progress     smallint not null default 0 check (progress between 0 and 100),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Link ideas to OKRs (many-to-many)
create table if not exists public.idea_okr_links (
  id        uuid primary key default gen_random_uuid(),
  idea_id   uuid not null references public.ideas(id) on delete cascade,
  okr_id    uuid not null references public.okrs(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unique (idea_id, okr_id)
);

create index if not exists idx_okrs_tenant       on public.okrs(tenant_id);
create index if not exists idx_idea_okr_tenant   on public.idea_okr_links(tenant_id);
create index if not exists idx_idea_okr_idea     on public.idea_okr_links(idea_id);
create index if not exists idx_idea_okr_okr      on public.idea_okr_links(okr_id);

alter table public.okrs enable row level security;
alter table public.idea_okr_links enable row level security;

-- Members can read OKRs for their tenant
create policy okrs_select on public.okrs
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = okrs.tenant_id and m.user_id = auth.uid()
    )
  );

-- Admins and owners can manage OKRs
create policy okrs_insert on public.okrs
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = okrs.tenant_id and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create policy okrs_update on public.okrs
  for update using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = okrs.tenant_id and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create policy okrs_delete on public.okrs
  for delete using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = okrs.tenant_id and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- Members can read idea-OKR links
create policy idea_okr_select on public.idea_okr_links
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_okr_links.tenant_id and m.user_id = auth.uid()
    )
  );

-- Members can create links (link their ideas to OKRs)
create policy idea_okr_insert on public.idea_okr_links
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_okr_links.tenant_id and m.user_id = auth.uid()
    )
  );

create policy idea_okr_delete on public.idea_okr_links
  for delete using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_okr_links.tenant_id and m.user_id = auth.uid()
    )
  );

insert into public.schema_migrations (filename)
  values ('0061_okrs.sql')
  on conflict (filename) do nothing;
