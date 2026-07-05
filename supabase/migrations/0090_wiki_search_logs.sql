-- 0090_wiki_search_logs.sql
-- Track wiki searches that returned zero results so admins can spot content gaps.
-- Intentionally lightweight: no PK index on (tenant_id, term) to avoid write contention;
-- the admin query groups by term in application code.

create table if not exists public.wiki_search_logs (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  search_term text        not null check (char_length(search_term) <= 500),
  searched_at timestamptz not null default now()
);

-- Fast lookup for admin dashboard grouped queries
create index if not exists wiki_search_logs_tenant_term
  on public.wiki_search_logs (tenant_id, search_term);

create index if not exists wiki_search_logs_tenant_at
  on public.wiki_search_logs (tenant_id, searched_at desc);

-- RLS: admins/owners read; service-role inserts
alter table public.wiki_search_logs enable row level security;

create policy "admins_read_search_logs"
  on public.wiki_search_logs for select
  using (public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]));

-- No user-facing insert policy — inserts use the service-role client only
