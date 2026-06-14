-- ---------------------------------------------------------------------------
-- Platform-level key-value settings (not tenant-scoped).
-- Holds things like the Resend API key. Service-role only — no RLS policies
-- means only BYPASSRLS callers (service role) can read/write.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
-- No policies — service-role only.

-- ---------------------------------------------------------------------------
-- Per-tenant key-value settings (email branding, etc.).
-- Admins configure these via the Notifications admin page.
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_settings (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create index if not exists idx_tenant_settings_tenant on public.tenant_settings(tenant_id);

alter table public.tenant_settings enable row level security;

-- Tenant members can read their own workspace settings (e.g. display name for UI).
create policy "members read tenant settings"
  on public.tenant_settings for select
  using ( tenant_id in (select public.current_tenant_ids()) );

-- ---------------------------------------------------------------------------
-- Per-user in-app notifications.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references public.users(id)   on delete cascade,
  type       text not null,        -- 'assigned' | 'sla_breach' | 'mentioned'
  title      text not null,
  body       text,
  issue_id   uuid references public.issues(id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user   on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_tenant on public.notifications(tenant_id);
create index if not exists idx_notifications_unread on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Users see only their own notifications.
create policy "users read own notifications"
  on public.notifications for select
  using ( user_id = public.current_app_user_id() );

-- Users can mark their own notifications as read (update read_at only).
create policy "users update own notifications"
  on public.notifications for update
  using ( user_id = public.current_app_user_id() )
  with check ( user_id = public.current_app_user_id() );
