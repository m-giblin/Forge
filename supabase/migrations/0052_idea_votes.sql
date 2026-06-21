-- Migration 0052: Think Tank idea voting
-- Adds `idea_votes` table so team members can upvote ideas before
-- they reach sign-off. One vote per user per idea. The idea list
-- sorts by vote count to surface the strongest ideas.

create table if not exists public.idea_votes (
  id          uuid primary key default gen_random_uuid(),
  idea_id     uuid not null references public.ideas(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (idea_id, user_id)
);

create index if not exists idx_idea_votes_idea   on public.idea_votes(idea_id);
create index if not exists idx_idea_votes_tenant on public.idea_votes(tenant_id);

alter table public.idea_votes enable row level security;

-- Members can read votes for ideas in their tenant
create policy idea_votes_select on public.idea_votes
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_votes.tenant_id
        and m.user_id = auth.uid()
    )
  );

-- Members can insert their own vote
create policy idea_votes_insert on public.idea_votes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_votes.tenant_id
        and m.user_id = auth.uid()
    )
  );

-- Members can delete their own vote (unvote)
create policy idea_votes_delete on public.idea_votes
  for delete using (user_id = auth.uid());

-- Denormalized vote count on ideas table for fast sorting
alter table public.ideas
  add column if not exists vote_count integer not null default 0;

-- Keep vote_count in sync
create or replace function public.sync_idea_vote_count()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.ideas set vote_count = vote_count + 1 where id = new.idea_id;
  elsif (tg_op = 'DELETE') then
    update public.ideas set vote_count = greatest(0, vote_count - 1) where id = old.idea_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_idea_vote_count on public.idea_votes;
create trigger trg_idea_vote_count
  after insert or delete on public.idea_votes
  for each row execute function public.sync_idea_vote_count();

insert into public.schema_migrations (filename)
  values ('0052_idea_votes.sql')
  on conflict (filename) do nothing;
