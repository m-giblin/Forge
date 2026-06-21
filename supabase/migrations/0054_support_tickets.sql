-- Migration 0054: Platform support ticket system
-- Tenant admins/owners submit support requests to the platform.
-- Grok auto-triages each ticket on submission.
-- After 24h unresolved, an escalation email is sent.

create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  submitted_by    uuid references public.users(id) on delete set null,
  actor_label     text,                        -- email snapshot (durable across deletes)
  title           text not null,
  body            text not null,
  status          text not null default 'open', -- open | in_progress | resolved | closed
  priority        text not null default 'medium',
  ai_triage_summary text,
  ai_guidance     text,
  platform_notes  text,                        -- super-admin internal notes
  escalation_email_sent_at timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_support_tickets_tenant on public.support_tickets(tenant_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_tickets_created on public.support_tickets(created_at desc);

alter table public.support_tickets enable row level security;

-- Tenant owners/admins can read and insert their own tickets
create policy support_tickets_select on public.support_tickets
  for select using (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

create policy support_tickets_insert on public.support_tickets
  for insert with check (
    public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

-- Super-admin reads all via service-role (BYPASSRLS) — no extra policy needed.

insert into public.schema_migrations (filename)
  values ('0054_support_tickets.sql')
  on conflict (filename) do nothing;
