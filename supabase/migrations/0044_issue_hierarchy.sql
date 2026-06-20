-- Issue hierarchy: parent/child sub-issues + horizontal links.

-- parent_id: nullable FK to same table (one level deep — no recursive nesting)
alter table public.issues add column if not exists parent_id uuid references public.issues(id) on delete set null;
create index if not exists issues_parent_id on public.issues (parent_id);

-- Issue links: blocks / relates_to / duplicates
create table if not exists public.issue_links (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  source_issue_id uuid not null references public.issues(id) on delete cascade,
  target_issue_id uuid not null references public.issues(id) on delete cascade,
  link_type       text not null check (link_type in ('blocks', 'relates_to', 'duplicates')),
  created_at      timestamptz not null default now(),
  unique (source_issue_id, target_issue_id, link_type)
);

create index if not exists issue_links_tenant on public.issue_links (tenant_id);
create index if not exists issue_links_source on public.issue_links (source_issue_id);
create index if not exists issue_links_target on public.issue_links (target_issue_id);

alter table public.issue_links enable row level security;

create policy issue_links_select on public.issue_links
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = issue_links.tenant_id
        and m.user_id = (select id from public.users where auth_id = auth.uid())
    )
  );

insert into public.schema_migrations (filename) values ('0044_issue_hierarchy.sql') on conflict do nothing;
