-- 0117_estimation_poker.sql — real multiplayer Estimation Poker: a queue of
-- unestimated issues, a shared point-card deck, per-person votes hidden until
-- reveal, apply-to-story-points, skip/next. Built as genuine multiplayer (not
-- a single-reviewer rebadge of Backlog Refinement) because the design spec
-- explicitly calls for per-person votes + reveal, and this codebase already
-- has proven realtime infra (issues table is already on supabase_realtime,
-- see 0002_issues.sql) to build it on without inventing new infrastructure.

create table public.estimation_sessions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  project_id        uuid not null references public.projects(id) on delete cascade,
  created_by        uuid references public.users(id) on delete set null,
  status            text not null default 'active' check (status in ('active','completed')),
  current_issue_id  uuid references public.issues(id) on delete set null,
  revealed          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_est_sessions_tenant on public.estimation_sessions(tenant_id);
create index idx_est_sessions_project on public.estimation_sessions(project_id, status);

create trigger trg_est_sessions_updated
  before update on public.estimation_sessions
  for each row execute function public.set_updated_at();

create table public.estimation_votes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  session_id   uuid not null references public.estimation_sessions(id) on delete cascade,
  issue_id     uuid not null references public.issues(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  value        text not null,  -- '1','2','3','5','8','13','21','?'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (session_id, issue_id, user_id)
);

create index idx_est_votes_session_issue on public.estimation_votes(session_id, issue_id);

create trigger trg_est_votes_updated
  before update on public.estimation_votes
  for each row execute function public.set_updated_at();

-- RLS: any active tenant member (not viewers — same bar as editing issues)
-- can read/participate. Estimation Poker is a whole-team ceremony, not an
-- admin-only tool, so this deliberately matches issue-edit permissions
-- rather than requiring owner/admin.

alter table public.estimation_sessions enable row level security;
alter table public.estimation_votes    enable row level security;

create policy est_sessions_select on public.estimation_sessions
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy est_sessions_write on public.estimation_sessions
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

create policy est_votes_select on public.estimation_votes
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy est_votes_write on public.estimation_votes
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

alter publication supabase_realtime add table public.estimation_sessions;
alter publication supabase_realtime add table public.estimation_votes;

insert into public.schema_migrations (filename)
values ('0117_estimation_poker.sql') on conflict do nothing;
