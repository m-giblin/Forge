-- Run AFTER the data migration script (npm run migrate:webhook-secrets) has
-- encrypted all existing rows into secret_enc/nonce/tag.
-- Drops the old plaintext column and enforces NOT NULL on the new ones.

alter table public.webhook_endpoints
  alter column secret_enc   set not null,
  alter column secret_nonce set not null,
  alter column secret_tag   set not null,
  drop column if exists secret;
