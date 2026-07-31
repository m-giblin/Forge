-- 0121_pi_planning.sql — PI Planning: cross-team Program Increment objective
-- list, each with a 5-dot confidence vote, scoped to a fixed planning window
-- (not to a jsonb array of specific sprint ids — real PI planning
-- synchronizes teams on a shared calendar window, and this codebase's
-- sprints don't align across projects anyway, so a date range is the
-- honest way to express "scoped to a set of sprints" here).
--
-- Deliberately NOT /admin/okrs — that's Objectives/Key Results linked to
-- Think Tank ideas, a different shape (no team/project grouping, no
-- confidence voting). Kept separate per explicit user decision; see
-- Docs/design-gaps.md for the naming-confusion note this migration's UI
-- copy is written to address.

create table public.pi_cycles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'planning' check (status in ('planning','active','completed')),
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create index idx_pi_cycles_tenant on public.pi_cycles(tenant_id);

-- "Team" = project — this codebase has no separate team entity, and
-- projects already carry their own member roster (project team, used
-- throughout Sprint Planning/Board/etc.), so objectives group by project
-- rather than inventing a new organizational concept. Nullable for a
-- cross-cutting objective that isn't one team's alone.
create table public.pi_objectives (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  pi_id       uuid not null references public.pi_cycles(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete set null,
  title       text not null,
  description text,
  position    int not null default 0,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_pi_objectives_pi on public.pi_objectives(pi_id);

create table public.pi_confidence_votes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  objective_id uuid not null references public.pi_objectives(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  score        int not null check (score >= 1 and score <= 5),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (objective_id, user_id)
);

create index idx_pi_votes_objective on public.pi_confidence_votes(objective_id);

create trigger trg_pi_votes_updated
  before update on public.pi_confidence_votes
  for each row execute function public.set_updated_at();

alter table public.pi_cycles           enable row level security;
alter table public.pi_objectives       enable row level security;
alter table public.pi_confidence_votes enable row level security;

-- Same bar as every other ceremony tool built this session (Estimation
-- Poker, Backlog Refinement): any active tenant member can read/participate;
-- viewers are excluded at the application layer, not by a separate role
-- check here, matching that same precedent.
create policy pi_cycles_select on public.pi_cycles
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy pi_cycles_write on public.pi_cycles
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy pi_objectives_select on public.pi_objectives
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy pi_objectives_write on public.pi_objectives
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy pi_votes_select on public.pi_confidence_votes
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy pi_votes_write on public.pi_confidence_votes
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

insert into public.schema_migrations (filename)
values ('0121_pi_planning.sql') on conflict do nothing;
