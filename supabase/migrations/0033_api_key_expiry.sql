-- 0033_api_key_expiry.sql (SEC-11)
-- Add optional expiry to API keys. A null expires_at means the key never
-- expires (current behaviour preserved for all existing keys).
-- Enforcement happens in src/lib/api/auth.ts — the DB column is the record of
-- truth; the middleware rejects expired keys at request time.

alter table public.api_keys
  add column if not exists expires_at timestamptz;

comment on column public.api_keys.expires_at is
  'If set, requests using this key are rejected after this timestamp. Null = never expires.';

insert into public.schema_migrations (filename)
values ('0033_api_key_expiry.sql')
on conflict do nothing;
