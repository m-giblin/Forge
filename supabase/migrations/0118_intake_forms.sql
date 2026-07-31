-- 0118_intake_forms.sql — admin-built public intake forms: title + field
-- list, a public unauthenticated link, submissions land in a review list,
-- "Convert to ticket" turns one into a real issue. Each form targets one
-- project (where converted issues land) — same per-project scoping call
-- already made for Guest & Client Access (0115), for the same reason: a
-- single tenant-wide public link would blur which project a submission was
-- even about.
--
-- Token scheme follows the same precedent as project_guest_links (0115):
-- opaque random token, sha256-hashed at rest, is_active flag, service-role-
-- only resolution, deny-by-default RLS. Field definitions follow the same
-- relational-table shape as tenant_custom_fields (0008) rather than a jsonb
-- blob, for consistency with how "list of typed fields" is already modeled
-- in this codebase. Submission answers ARE stored as jsonb keyed by field id
-- — that mirrors issues.custom_values, the existing precedent for "answers
-- to a tenant-defined field list."

create table public.intake_forms (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  name         text not null,
  description  text,
  is_active    boolean not null default true,
  token_hash   text not null,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, name)
);

create unique index idx_intake_forms_token_hash on public.intake_forms(token_hash);
create index idx_intake_forms_tenant on public.intake_forms(tenant_id);

create trigger trg_intake_forms_updated
  before update on public.intake_forms
  for each row execute function public.set_updated_at();

create table public.intake_form_fields (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  form_id   uuid not null references public.intake_forms(id) on delete cascade,
  label     text not null,
  type      text not null default 'text' check (type in ('text','textarea','select')),
  options   text[] not null default '{}',
  required  boolean not null default false,
  position  int not null default 0
);

create index idx_intake_fields_form on public.intake_form_fields(form_id);

create table public.intake_submissions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  form_id            uuid not null references public.intake_forms(id) on delete cascade,
  -- "Summary" is always collected, independent of the admin-configured field
  -- list, so every submission has a usable issue title on conversion — no
  -- fragile guessing which configured field should become the title.
  summary            text not null,
  answers            jsonb not null default '{}',  -- { field_id: answer }
  submitter_email     text,
  status             text not null default 'new' check (status in ('new','converted','dismissed')),
  converted_issue_id uuid references public.issues(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index idx_intake_submissions_form on public.intake_submissions(form_id, status);
create index idx_intake_submissions_tenant on public.intake_submissions(tenant_id);

alter table public.intake_forms         enable row level security;
alter table public.intake_form_fields   enable row level security;
alter table public.intake_submissions   enable row level security;

-- Forms: owner/admin manage (create/edit/regenerate link) — same bar as
-- Guest Access. Any active member can read (needed to review submissions).
create policy intake_forms_select on public.intake_forms
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy intake_forms_write on public.intake_forms
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

create policy intake_fields_select on public.intake_form_fields
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy intake_fields_write on public.intake_form_fields
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[]) );

-- Submissions: reviewing/converting is a triage action, same bar as creating
-- an issue (any active member, not just owner/admin). Public submission
-- itself goes through the service-role client only — no anon INSERT policy,
-- same deny-by-default posture as guest_tokens/guest_sessions (0083) and
-- project_guest_links (0115).
create policy intake_submissions_select on public.intake_submissions
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy intake_submissions_write on public.intake_submissions
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

insert into public.schema_migrations (filename)
values ('0118_intake_forms.sql') on conflict do nothing;
