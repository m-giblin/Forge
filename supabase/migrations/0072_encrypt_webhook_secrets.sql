-- Encrypt webhook endpoint signing secrets at rest.
-- Replaces the plaintext `secret` column with enc/nonce/tag triple (AES-256-GCM).
-- Existing rows: the old plaintext secret is moved into the new columns by the
-- application migration script (see docs). After migration, drop the old column.

alter table public.webhook_endpoints
  add column if not exists secret_enc   text,
  add column if not exists secret_nonce text,
  add column if not exists secret_tag   text;

-- NOTE: After running this migration, run the one-time data migration script:
--   npm run migrate:webhook-secrets
-- Then run the follow-up migration to drop the old column and add NOT NULL:
--   0073_webhook_secrets_cleanup.sql
