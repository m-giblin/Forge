-- Migration 0110: file-path-to-bug-history correlation
--
-- Records which files a commit linked to an issue actually touched, so a
-- new PR/commit can be checked against "has this file been part of a bug
-- fix before, and how often?" — the missing signal PR Impact Prediction
-- never had (confirmed: it only looked at the current issue's own text and
-- its own linked PR titles, nothing cross-issue).
--
-- No new GitHub API call or token needed — GitHub's `push` webhook payload
-- (already handled in gitWebhook.ts) includes each commit's added/removed/
-- modified file arrays natively. This table just persists what's already
-- arriving over the existing webhook.

create table if not exists public.issue_code_link_files (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  code_link_id    uuid not null references public.issue_code_links(id) on delete cascade,
  issue_id        uuid not null references public.issues(id) on delete cascade,
  file_path       text not null,
  created_at      timestamptz not null default now(),
  unique (code_link_id, file_path)
);

-- The correlation query filters by tenant_id + file_path, then joins back to
-- issues — this composite index is what makes that cheap at scale.
create index if not exists idx_issue_code_link_files_tenant_path
  on public.issue_code_link_files(tenant_id, file_path);
create index if not exists idx_issue_code_link_files_issue
  on public.issue_code_link_files(issue_id);

alter table public.issue_code_link_files enable row level security;

create policy issue_code_link_files_select on public.issue_code_link_files
  for select using ( tenant_id in (select public.current_tenant_ids()) );

create policy issue_code_link_files_insert on public.issue_code_link_files
  for insert with check ( tenant_id in (select public.current_tenant_ids()) );
