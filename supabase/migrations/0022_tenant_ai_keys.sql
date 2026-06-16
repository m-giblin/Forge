-- Encrypted BYO LLM key storage. Keys are AES-256-GCM encrypted server-side
-- (FORGE_AI_KEY_SECRET env var). The ciphertext, nonce, and auth tag are stored
-- in separate columns. Decryption happens only in server actions via the
-- service-role client — ciphertext never leaves the server.
--
-- UI and provider-switching logic are Phase 3. This migration just creates the
-- schema so no future migration rework is required.

create table if not exists public.tenant_ai_keys (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  provider    text not null check (provider in ('openai', 'anthropic', 'xai', 'gemini')),
  key_enc     text not null,   -- AES-256-GCM ciphertext, base64
  key_nonce   text not null,   -- 12-byte IV, base64
  key_tag     text not null,   -- 16-byte auth tag, base64
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, provider)
);

alter table public.tenant_ai_keys enable row level security;

-- No SELECT RLS policy: all reads go through service-role server actions.
-- This prevents any client from ever fetching ciphertext, even accidentally.

-- updated_at trigger (reuse the standard helper if already defined, else inline).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger tenant_ai_keys_updated_at
  before update on public.tenant_ai_keys
  for each row execute procedure public.set_updated_at();

insert into public.schema_migrations (filename)
values ('0022_tenant_ai_keys.sql')
on conflict do nothing;
