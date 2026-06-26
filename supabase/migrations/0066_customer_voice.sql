-- Migration 0066: Customer Voice — CRM-lite
-- customer_accounts: named customer/company records per tenant
-- customer_issue_links: many-to-many between issues and customer accounts

create table if not exists public.customer_accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  domain      text,             -- e.g. "acme.com" for logo/favicon lookups
  tier        text,             -- e.g. "enterprise", "pro", "starter"
  arr_usd     integer,          -- annual recurring revenue in USD cents (optional)
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists customer_accounts_tenant_id_idx on public.customer_accounts(tenant_id);

alter table public.customer_accounts enable row level security;

create policy "customer_accounts_select"
  on public.customer_accounts for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = customer_accounts.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

create policy "customer_accounts_insert"
  on public.customer_accounts for insert
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = customer_accounts.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

create policy "customer_accounts_update"
  on public.customer_accounts for update
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = customer_accounts.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = customer_accounts.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

create policy "customer_accounts_delete"
  on public.customer_accounts for delete
  using (
    exists (
      select 1 from public.memberships m
        join public.memberships own on own.tenant_id = customer_accounts.tenant_id
          and own.user_id = public.current_app_user_id()
          and own.role in ('owner', 'admin')
      where m.tenant_id = customer_accounts.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

-- Links between issues and customer accounts (with optional weight = how many customers affected)
create table if not exists public.customer_issue_links (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  issue_id            uuid not null references public.issues(id) on delete cascade,
  customer_account_id uuid not null references public.customer_accounts(id) on delete cascade,
  affected_count      integer not null default 1,   -- number of seats/users affected at this account
  created_at          timestamptz not null default now(),
  unique (issue_id, customer_account_id)
);

create index if not exists customer_issue_links_issue_id_idx on public.customer_issue_links(issue_id);
create index if not exists customer_issue_links_customer_id_idx on public.customer_issue_links(customer_account_id);
create index if not exists customer_issue_links_tenant_id_idx on public.customer_issue_links(tenant_id);

alter table public.customer_issue_links enable row level security;

create policy "customer_issue_links_select"
  on public.customer_issue_links for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = customer_issue_links.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

create policy "customer_issue_links_insert"
  on public.customer_issue_links for insert
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = customer_issue_links.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

create policy "customer_issue_links_delete"
  on public.customer_issue_links for delete
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = customer_issue_links.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

insert into public.schema_migrations (filename)
  values ('0066_customer_voice.sql')
  on conflict (filename) do nothing;
