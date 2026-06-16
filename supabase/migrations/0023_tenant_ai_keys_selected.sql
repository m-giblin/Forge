-- Extends tenant_ai_keys from P2-11.
-- is_selected: which provider is currently active for the sounding board.
-- key_hint: last 4 chars of plaintext key so admins can confirm identity
--   without the server decrypting just for the UI.

alter table public.tenant_ai_keys
  add column if not exists is_selected boolean not null default false,
  add column if not exists key_hint    text;

insert into public.schema_migrations (filename)
values ('0023_tenant_ai_keys_selected.sql')
on conflict do nothing;
