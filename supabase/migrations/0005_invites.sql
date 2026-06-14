-- 0005_invites.sql — single-use invite links for adding users to a tenant.
--
-- Only a HASH of the token is stored; the link is shown once at creation.
-- Acceptance is validated server-side via the service-role path (the joiner
-- isn't a member yet, so RLS can't authorize them — possession of the
-- single-use token is the authorization). RLS below governs the admin
-- management UI (owner/admin list & revoke pending invites).

create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  email        text,                                   -- optional: bind to one email
  role         membership_role not null default 'member',
  token_hash   text not null unique,                   -- sha-256 hex of the raw token
  created_by   uuid references public.users(id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_invites_tenant on public.invites(tenant_id);

alter table public.invites enable row level security;

-- Management is owner/admin only. The accept flow does NOT use these policies
-- (it goes through the service-role client after validating the token).
create policy invites_select on public.invites
  for select using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
create policy invites_insert on public.invites
  for insert with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
create policy invites_delete on public.invites
  for delete using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
