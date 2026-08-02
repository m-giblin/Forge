-- 0128_git_merge_workflow.sql
-- Tenant-configurable policy for what a merged PR does to its linked ticket(s).
-- Previously hardcoded in app code (gitWebhook.ts): auto-close on a closing
-- keyword ("Fixes TRAV2-66") OR when exactly one ticket is linked with no
-- keyword at all. Different orgs want different rigor here, so this becomes
-- a per-connection setting instead of one fixed rule for every tenant.
--
--   keyword_or_solo  — current behavior (default, no behavior change on rollout)
--   always_close     — any ticket linked to a merged PR closes, keyword or not
--   link_only        — merge just links the PR; ticket status is never touched

alter table public.git_connections
  add column if not exists merge_workflow text not null default 'keyword_or_solo'
    check (merge_workflow in ('keyword_or_solo', 'always_close', 'link_only'));

insert into public.schema_migrations (filename)
values ('0128_git_merge_workflow.sql')
on conflict do nothing;
