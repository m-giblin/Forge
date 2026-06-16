-- Per-tenant custom AI sounding board pills (lenses).
-- Default pills live in code; only custom additions are stored here.
create table if not exists public.think_tank_pills (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  label        text not null check (char_length(label) between 1 and 60),
  instruction  text not null check (char_length(instruction) between 1 and 1000),
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.think_tank_pills enable row level security;

-- Tenant members can read their own pills.
create policy "tenant members read think_tank_pills"
  on public.think_tank_pills for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

-- Only admins/owners can insert.
create policy "tenant admins insert think_tank_pills"
  on public.think_tank_pills for insert
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Only admins/owners can update.
create policy "tenant admins update think_tank_pills"
  on public.think_tank_pills for update
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Only admins/owners can delete.
create policy "tenant admins delete think_tank_pills"
  on public.think_tank_pills for delete
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

insert into public.schema_migrations (filename)
values ('0020_think_tank_pills.sql')
on conflict do nothing;
