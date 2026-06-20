-- 0037: issue attachments
-- File attachments on issues (top-level, not comment-scoped).
-- Mirrors idea_comment_attachments pattern. Bucket already exists (created manually).

create table if not exists public.issue_attachments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  issue_id     uuid not null references public.issues(id) on delete cascade,
  storage_path text not null,
  filename     text not null,
  content_type text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by  uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_issue_attachments_issue on public.issue_attachments(issue_id);

alter table public.issue_attachments enable row level security;

-- Tenant members can read attachments on issues they can see.
create policy "tenant members read issue attachments"
  on public.issue_attachments for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

-- All writes go through service-role server actions (no direct user insert).

-- Storage RLS: members can read objects in their tenant's folder.
create policy "tenant members read issue attachment objects"
  on storage.objects for select
  using (
    bucket_id = 'issue-attachments'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.memberships where user_id = auth.uid()
    )
  );

insert into public.schema_migrations (filename)
values ('0037_issue_attachments.sql') on conflict do nothing;
