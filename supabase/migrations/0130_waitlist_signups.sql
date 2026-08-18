-- Migration 0130: pre-launch waitlist signups (public marketing site "Notify me" form).
-- Not tenant-scoped — collected before any tenant/account exists. Service-role only;
-- no public RLS policy since the only writer is the /api/waitlist route (service client).

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;
-- No policies: service-role client bypasses RLS entirely; this deliberately
-- blocks all anon/authenticated access, including re-reading emails client-side.

insert into public.schema_migrations (filename)
  values ('0130_waitlist_signups.sql')
  on conflict (filename) do nothing;
