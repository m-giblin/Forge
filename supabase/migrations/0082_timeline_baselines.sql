-- Timeline baselines: save a snapshot of issue dates to compare plan vs. actual drift.

create table public.timeline_baselines (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.timeline_baseline_items (
  id           uuid primary key default gen_random_uuid(),
  baseline_id  uuid not null references public.timeline_baselines(id) on delete cascade,
  issue_id     uuid not null references public.issues(id) on delete cascade,
  start_date   date,
  due_date     date,
  unique(baseline_id, issue_id)
);

alter table public.timeline_baselines      enable row level security;
alter table public.timeline_baseline_items enable row level security;

create policy "members_read_baselines" on public.timeline_baselines
  for select using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create policy "members_insert_baselines" on public.timeline_baselines
  for insert with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
  );

create policy "members_read_baseline_items" on public.timeline_baseline_items
  for select using (
    baseline_id in (
      select id from public.timeline_baselines
      where tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
    )
  );

create policy "members_insert_baseline_items" on public.timeline_baseline_items
  for insert with check (
    baseline_id in (
      select id from public.timeline_baselines
      where tenant_id in (select tenant_id from public.tenant_members where user_id = auth.uid())
    )
  );

create index on public.timeline_baselines (tenant_id);
create index on public.timeline_baseline_items (baseline_id);
create index on public.timeline_baseline_items (issue_id);
