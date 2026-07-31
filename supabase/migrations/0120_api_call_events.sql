-- 0120_api_call_events.sql — lightweight per-call log for the public API
-- (/api/v1/*), needed for the "API calls (30 days)" stat on the new Usage &
-- Seats page. Mirrors ai_usage_events (0101) — same per-event-row shape,
-- same tenant-scoped read pattern — rather than inventing a new convention
-- for "count of something over a rolling window."
--
-- Design note: authenticateApiKey() (src/lib/api/auth.ts) is the ONE choke
-- point every /api/v1/* request already passes through — it already does a
-- best-effort last_used_at update there, so this just adds one more
-- fire-and-forget insert alongside it. No new middleware, no per-route wiring.

create table public.api_call_events (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  key_id     uuid not null references public.api_keys(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_api_call_events_tenant on public.api_call_events(tenant_id, created_at);

alter table public.api_call_events enable row level security;
-- Service-role only — written by authenticateApiKey(), read by the admin
-- Usage & Seats page via service client. No explicit policies, matching
-- ai_usage_events (0101): RLS enabled with zero policies is default-deny for
-- every role except service-role, which bypasses RLS entirely.

insert into public.schema_migrations (filename)
values ('0120_api_call_events.sql') on conflict do nothing;
