-- Migration 0064: Think Tank anonymous voting + anonymous idea submission
-- Adds idea_votes table and is_anonymous flag on ideas

-- Anonymous submission toggle on ideas
alter table public.ideas add column if not exists is_anonymous boolean not null default false;

-- Voting table: one vote per user per idea, value: 1 (up) or -1 (down)
create table if not exists public.idea_votes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  idea_id     uuid not null references public.ideas(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  value       smallint not null check (value in (1, -1)),
  created_at  timestamptz not null default now(),
  unique (idea_id, user_id)
);

create index if not exists idea_votes_idea_id_idx on public.idea_votes(idea_id);
create index if not exists idea_votes_tenant_id_idx on public.idea_votes(tenant_id);

-- RLS
alter table public.idea_votes enable row level security;

-- Members can read all votes for ideas in their tenant
create policy "idea_votes_select"
  on public.idea_votes for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_votes.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

-- Users can insert their own vote
create policy "idea_votes_insert"
  on public.idea_votes for insert
  with check (
    user_id = public.current_app_user_id()
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_votes.tenant_id
        and m.user_id = public.current_app_user_id()
    )
  );

-- Users can update (change) their own vote
create policy "idea_votes_update"
  on public.idea_votes for update
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

-- Users can delete (retract) their own vote
create policy "idea_votes_delete"
  on public.idea_votes for delete
  using (user_id = public.current_app_user_id());

insert into public.schema_migrations (filename)
  values ('0064_idea_votes_anonymous.sql')
  on conflict (filename) do nothing;
