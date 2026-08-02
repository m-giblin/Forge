-- Migration 0127: add the unique constraint the deployment_status webhook
-- handler's upsert has always assumed exists — src/lib/services/gitWebhook.ts
-- upserts on { onConflict: "tenant_id,environment,version,repo_full_name" },
-- but migration 0091 never actually created a matching unique constraint or
-- index. Every deployment_status event (the ones Vercel's own GitHub
-- integration posts on every deploy) has therefore always failed with
-- Postgres error 42P10 ("no unique or exclusion constraint matching the ON
-- CONFLICT specification") and silently written nothing — confirmed live
-- against a real tenant.

alter table public.deployments
  add constraint deployments_tenant_env_version_repo_key
  unique (tenant_id, environment, version, repo_full_name);
