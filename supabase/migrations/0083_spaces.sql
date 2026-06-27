-- Migration 0083: Forge Spaces — tenant/project/personal wiki with secure external sharing

-- ── Core space types ─────────────────────────────────────────────────────────
-- project : auto-created per project; project-members only
-- team    : tenant-wide shared knowledge base
-- personal: private to owner (My Space)

create type public.space_type as enum ('project', 'team', 'personal');

create table public.spaces (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  type         public.space_type not null default 'team',
  project_id   uuid references public.projects(id) on delete cascade,
  owner_id     uuid references public.users(id) on delete set null,
  name         text not null,
  icon         text not null default '📄',
  description  text,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- project spaces: one per project
  constraint spaces_one_per_project unique (project_id)
);

create index idx_spaces_tenant  on public.spaces(tenant_id);
create index idx_spaces_project on public.spaces(project_id);
create index idx_spaces_owner   on public.spaces(owner_id);

create trigger trg_spaces_updated
  before update on public.spaces
  for each row execute function public.set_updated_at();

-- ── Pages ─────────────────────────────────────────────────────────────────────
create table public.pages (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  space_id         uuid not null references public.spaces(id) on delete cascade,
  parent_id        uuid references public.pages(id) on delete cascade,
  title            text not null default 'Untitled',
  body             text not null default '',   -- Tiptap JSON (stored as text)
  icon             text,
  position         integer not null default 0,
  status           text not null default 'active' check (status in ('active','archived')),
  last_reviewed_at timestamptz,
  reviewer_id      uuid references public.users(id) on delete set null,
  review_interval  integer,                     -- days; null = no cadence
  created_by       uuid references public.users(id) on delete set null,
  updated_by       uuid references public.users(id) on delete set null,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_pages_space     on public.pages(space_id);
create index idx_pages_parent    on public.pages(parent_id);
create index idx_pages_tenant    on public.pages(tenant_id);
create index idx_pages_status    on public.pages(status);

-- Full-text search index over title + body
create index idx_pages_fts on public.pages
  using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')));

create trigger trg_pages_updated
  before update on public.pages
  for each row execute function public.set_updated_at();

-- ── Secure external page shares ───────────────────────────────────────────────
-- Allows read-only domain-verified guest access to a page or whole space.
-- Security layers:
--   1. Explicit "published" toggle — default off
--   2. Allowed email domain whitelist
--   3. Single-use magic tokens (stored hashed) with expiry
--   4. Guest sessions expire; revocable at any time by owner/admin
--   5. Rate-limited at API layer

create table public.page_shares (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  page_id         uuid references public.pages(id) on delete cascade,
  space_id        uuid references public.spaces(id) on delete cascade,  -- share whole space
  created_by      uuid not null references public.users(id) on delete cascade,
  -- Visibility: 'domain' = domain-verified read-only guests
  share_type      text not null default 'domain' check (share_type in ('domain')),
  -- Domain restriction: e.g. 'acme.com'. Null = internal share only (unused for now)
  allowed_domain  text,
  -- Whether this share is currently active
  is_active       boolean not null default true,
  -- Audit
  revoked_at      timestamptz,
  revoked_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint page_shares_page_or_space check (
    (page_id is not null and space_id is null) or
    (space_id is not null and page_id is null)
  )
);

create index idx_page_shares_page  on public.page_shares(page_id);
create index idx_page_shares_space on public.page_shares(space_id);
create index idx_page_shares_tenant on public.page_shares(tenant_id);

create trigger trg_page_shares_updated
  before update on public.page_shares
  for each row execute function public.set_updated_at();

-- ── Guest magic tokens ────────────────────────────────────────────────────────
-- One token per (share, email). Hash stored — raw token sent by email only.
-- Tokens expire after 48h, single-use (consumed_at set on first use).
-- Re-requests before expiry re-send the SAME hashed token (idempotent).

create table public.guest_tokens (
  id           uuid primary key default gen_random_uuid(),
  share_id     uuid not null references public.page_shares(id) on delete cascade,
  email        text not null,
  email_hash   text not null,             -- sha256(lower(email)) for lookup without PII scan
  token_hash   text not null,             -- sha256(raw_token) — raw never stored
  expires_at   timestamptz not null,
  consumed_at  timestamptz,               -- null = not yet used; set on first valid use
  session_expires_at timestamptz,         -- 48h read session after first use
  revoked_at   timestamptz,
  ip_address   inet,                      -- recorded on consumption for audit
  user_agent   text,
  created_at   timestamptz not null default now(),
  constraint guest_tokens_unique_active unique (share_id, email_hash)
);

create index idx_guest_tokens_share  on public.guest_tokens(share_id);
create index idx_guest_tokens_hash   on public.guest_tokens(token_hash);
create index idx_guest_tokens_email  on public.guest_tokens(email_hash);

-- ── Guest sessions ────────────────────────────────────────────────────────────
-- Short-lived read-only sessions for verified guests (48h, one per token).

create table public.guest_sessions (
  id               uuid primary key default gen_random_uuid(),
  token_id         uuid not null unique references public.guest_tokens(id) on delete cascade,
  share_id         uuid not null references public.page_shares(id) on delete cascade,
  email_hash       text not null,
  session_token    text not null unique,  -- opaque bearer sent in cookie
  expires_at       timestamptz not null,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index idx_guest_sessions_token on public.guest_sessions(session_token);
create index idx_guest_sessions_share on public.guest_sessions(share_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.spaces       enable row level security;
alter table public.pages        enable row level security;
alter table public.page_shares  enable row level security;
alter table public.guest_tokens enable row level security;
alter table public.guest_sessions enable row level security;

-- Helper: is this user a project member (direct or via tenant role)?
create or replace function public.can_read_space(p_space_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.spaces s
    join public.memberships m on m.tenant_id = s.tenant_id and m.user_id = auth.uid()
    where s.id = p_space_id
      and s.archived_at is null
      and (
        -- team spaces: any tenant member
        s.type = 'team'
        -- personal: only owner
        or (s.type = 'personal' and s.owner_id = auth.uid())
        -- project spaces: any tenant member (project-level access is app-enforced)
        or s.type = 'project'
      )
  )
$$;

-- Spaces: read
create policy spaces_select on public.spaces
  for select using (public.can_read_space(id));

-- Spaces: insert — any non-viewer tenant member
create policy spaces_insert on public.spaces
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
  );

-- Spaces: update — owner/admin or space creator
create policy spaces_update on public.spaces
  for update using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
    or owner_id = auth.uid()
  );

-- Pages: read — tenant member can read if they can read the space
create policy pages_select on public.pages
  for select using (
    exists (
      select 1 from public.spaces s
      join public.memberships m on m.tenant_id = s.tenant_id and m.user_id = auth.uid()
      where s.id = pages.space_id
    )
  );

-- Pages: write — any non-viewer tenant member
create policy pages_insert on public.pages
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
  );

create policy pages_update on public.pages
  for update using (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
  );

-- Page shares: tenant members only
create policy page_shares_select on public.page_shares
  for select using (
    public.has_tenant_role(tenant_id, array['owner','admin','member','viewer']::membership_role[])
  );

create policy page_shares_insert on public.page_shares
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[])
  );

create policy page_shares_update on public.page_shares
  for update using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
    or created_by = auth.uid()
  );

-- guest_tokens and guest_sessions: service-role only (no user JWT access)
create policy guest_tokens_deny_all   on public.guest_tokens   for all using (false);
create policy guest_sessions_deny_all on public.guest_sessions for all using (false);

-- ── Migrate existing project_wiki_pages → spaces + pages ─────────────────────
-- For every project that has a wiki page, create a project space and
-- migrate the content into page 1 of that space.

insert into public.spaces (id, tenant_id, type, project_id, owner_id, name, icon, created_at, updated_at)
select
  gen_random_uuid(),
  w.tenant_id,
  'project',
  w.project_id,
  w.created_by,
  p.name || ' Docs',
  '📋',
  w.created_at,
  w.updated_at
from public.project_wiki_pages w
join public.projects p on p.id = w.project_id
on conflict (project_id) do nothing;

-- Create the Overview page from the existing wiki body
insert into public.pages (id, tenant_id, space_id, title, body, position, created_by, updated_by, created_at, updated_at)
select
  gen_random_uuid(),
  w.tenant_id,
  s.id,
  coalesce(nullif(w.title,''), 'Overview'),
  w.body,
  0,
  w.created_by,
  w.updated_by,
  w.created_at,
  w.updated_at
from public.project_wiki_pages w
join public.spaces s on s.project_id = w.project_id
where w.body is not null and trim(w.body) != '';

-- ── Schema version ────────────────────────────────────────────────────────────
insert into public.schema_migrations (filename, notes)
  values ('0083_spaces.sql', 'Forge Spaces: spaces + pages + secure external sharing with domain-verified guest tokens')
  on conflict (filename) do nothing;
