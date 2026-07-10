-- 0101: AI usage metering across every Grok call site, plus the data needed to
-- actually bill for platform-key usage (vs. BYO, which is free to Forge).
--
-- Before this, only Think Tank's Sounding Board was tracked (idea_ai_turns).
-- The other 14 AI features had no usage record at all, and 11 of the 15
-- bypassed the tenant's BYO key entirely — see grokAi.ts's grokComplete(),
-- now the single instrumented choke point every caller goes through.

create table if not exists public.ai_usage_events (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  feature        text not null,        -- e.g. 'pr_impact', 'standup_digest', 'sounding_board'
  model          text not null,
  key_source     text not null check (key_source in ('platform', 'byo')),
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  -- Estimated cost in hundredths of a cent (i.e. 1 = $0.0001), computed at
  -- write time from the pricing table below — avoids re-deriving historical
  -- cost if pricing changes later.
  est_cost_hundredth_cents integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_tenant on public.ai_usage_events (tenant_id, created_at);
create index if not exists idx_ai_usage_events_feature on public.ai_usage_events (feature, created_at);

alter table public.ai_usage_events enable row level security;
-- Service-role only — written by the server-side grokComplete() wrapper,
-- read by the admin billing/usage pages via service client.

insert into public.schema_migrations (filename)
values ('0101_ai_usage_metering.sql')
on conflict do nothing;
