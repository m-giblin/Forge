-- Tracks file attachments on idea comments. Uploads go through the server
-- which validates type, size, and monthly quota before generating a signed
-- upload URL. comment_id is null until the comment is created.

-- ===== Metadata table =====

create table if not exists public.idea_comment_attachments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  idea_id      uuid not null references public.ideas(id) on delete cascade,
  comment_id   uuid references public.idea_comments(id) on delete cascade,
  storage_path text not null,
  filename     text not null,
  content_type text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at   timestamptz not null default now()
);

alter table public.idea_comment_attachments enable row level security;

-- Tenant members can read attachments on ideas they can see.
create policy "tenant members read attachments"
  on public.idea_comment_attachments for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

-- Service role inserts (upload happens via server action with service client).
-- No INSERT policy for regular users — all writes go through server actions.

-- ===== Storage bucket =====

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'idea-attachments',
  'idea-attachments',
  false,
  10485760,  -- 10 MB
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do nothing;

-- Storage RLS: members can read signed URLs; uploads go via service role.
create policy "tenant members read idea attachments"
  on storage.objects for select
  using (
    bucket_id = 'idea-attachments'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.memberships where user_id = auth.uid()
    )
  );

insert into public.schema_migrations (filename)
values ('0021_idea_comment_attachments.sql')
on conflict do nothing;
