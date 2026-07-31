-- 0115_project_guest_links.sql — "Guest & Client Access": a per-project,
-- unauthenticated, tokenized, view-only public link to that project's Board
-- and Roadmap, for sharing with external clients (no login required).
--
-- Deliberately NOT the email-gated magic-link model spaces guest sharing uses
-- (page_shares/guest_tokens/guest_sessions, migration 0083) — the design spec
-- for this feature calls for a plain "anyone with the link can view" URL, so
-- the token itself is the credential. Storage/revocation pattern (opaque
-- random token, sha256-hashed at rest, is_active flag) follows that same
-- precedent; the domain-verification/email/session layers are intentionally
-- skipped as unnecessary complexity for this simpler use case.

create table public.project_guest_links (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  token_hash  text not null,
  created_by  uuid references public.users(id) on delete set null,
  is_active   boolean not null default true,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint project_guest_links_one_per_project unique (project_id)
);

create unique index idx_pgl_token_hash on public.project_guest_links(token_hash);
create index idx_pgl_tenant on public.project_guest_links(tenant_id);

create trigger trg_pgl_updated
  before update on public.project_guest_links
  for each row execute function public.set_updated_at();

alter table public.project_guest_links enable row level security;

-- Tenant-authenticated admin/owner UI: read and manage.
create policy pgl_select on public.project_guest_links
  for select using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );
create policy pgl_write on public.project_guest_links
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

-- The public /shared/project route resolves a link by token_hash with NO
-- session — it must use the service-role client (RLS gives it zero rows,
-- same deny-by-default posture as guest_tokens/guest_sessions in 0083).

insert into public.schema_migrations (filename)
values ('0115_project_guest_links.sql') on conflict do nothing;
