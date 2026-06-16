-- Migration 0027: project wiki pages (one overview page per project)

create table if not exists public.project_wiki_pages (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null default 'Overview',
  body         text not null default '',
  created_by   uuid references public.users(id) on delete set null,
  updated_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint project_wiki_pages_one_per_project unique (project_id)
);

create index idx_project_wiki_pages_project on public.project_wiki_pages(project_id);

create trigger trg_project_wiki_pages_updated
  before update on public.project_wiki_pages
  for each row execute function public.set_updated_at();

alter table public.project_wiki_pages enable row level security;

-- All tenant members can read
create policy project_wiki_pages_select on public.project_wiki_pages
  for select using (tenant_id in (select public.current_tenant_ids()));

-- All non-viewer members can write (last-write-wins, no locking for MVP)
create policy project_wiki_pages_insert on public.project_wiki_pages
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
  );

create policy project_wiki_pages_update on public.project_wiki_pages
  for update using (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
  );

notify pgrst, 'reload schema';

insert into public.schema_migrations (filename, notes)
  values ('0027_project_wiki_pages.sql', 'Project wiki overview page per project')
  on conflict (filename) do nothing;
