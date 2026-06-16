-- One upvote per user per idea. Used to surface popular ideas in the listing.
create table if not exists public.idea_votes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  idea_id     uuid not null references public.ideas(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (idea_id, user_id)
);

alter table public.idea_votes enable row level security;

-- Any tenant member can read votes (so counts render for everyone).
create policy "tenant members read idea_votes"
  on public.idea_votes for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

-- Any tenant member can vote.
create policy "tenant members vote"
  on public.idea_votes for insert
  with check (
    user_id = auth.uid()
    and tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

-- Members can only delete their own vote.
create policy "members unvote"
  on public.idea_votes for delete
  using (user_id = auth.uid());

insert into public.schema_migrations (filename)
values ('0017_idea_votes.sql')
on conflict do nothing;
