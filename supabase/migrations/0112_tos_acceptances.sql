-- Migration 0112: record real Terms of Service / Privacy Policy acceptance
--
-- Gap found during the design review: self-serve signup only ever showed a
-- passive "by signing up you agree to..." link — no checkbox, no record of
-- who accepted what, when. For a B2B product this is a real compliance gap
-- (no evidence of consent), inconsistent with how seriously this codebase
-- already treats compliance elsewhere (see compliance_requests, 0055).
--
-- Same convention as compliance_requests: service-role only, no RLS policies,
-- RLS enabled purely to block accidental direct access.

create table public.tos_acceptances (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  tenant_id    uuid references public.tenants(id) on delete set null,
  version      text not null,           -- e.g. '2026-07-28' — the terms version shown at accept time
  accepted_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index idx_tos_acceptances_user on public.tos_acceptances(user_id);
create index idx_tos_acceptances_tenant on public.tos_acceptances(tenant_id);

alter table public.tos_acceptances enable row level security;

insert into public.schema_migrations (filename) values ('0112_tos_acceptances.sql')
on conflict do nothing;
