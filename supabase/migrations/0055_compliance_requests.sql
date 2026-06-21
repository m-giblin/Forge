-- Migration 0055: GDPR & compliance request queue
-- Tracks deletion requests (GDPR Art. 17) and export requests (GDPR Art. 20).
-- Managed exclusively by super-admins via service-role.

create table if not exists public.compliance_requests (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid references public.tenants(id) on delete set null,
  request_type     text not null check (request_type in ('deletion','export','correction')),
  requester_email  text not null,
  requester_user_id uuid references public.users(id) on delete set null,
  status           text not null default 'pending'
                     check (status in ('pending','in_progress','completed','denied')),
  regulation       text not null default 'GDPR',   -- GDPR | CCPA | other
  notes            text,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_compliance_tenant  on public.compliance_requests(tenant_id);
create index if not exists idx_compliance_status  on public.compliance_requests(status);
create index if not exists idx_compliance_created on public.compliance_requests(created_at desc);

-- No RLS needed — service-role only. Enable RLS to prevent accidental direct access.
alter table public.compliance_requests enable row level security;

insert into public.schema_migrations (filename)
  values ('0055_compliance_requests.sql')
  on conflict (filename) do nothing;
