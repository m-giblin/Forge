-- 0119_attachment_pins.sql — Files & Proofing: click an attached image to
-- drop a numbered pin, leave feedback text at that pin, mark pins resolved.
-- Position is stored as a percentage of image width/height (not pixels), so
-- a pin renders in the right spot regardless of how large the image is
-- displayed on any given screen.

create table public.attachment_pins (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  attachment_id uuid not null references public.issue_attachments(id) on delete cascade,
  issue_id      uuid not null references public.issues(id) on delete cascade,
  x_pct         numeric(6,3) not null check (x_pct >= 0 and x_pct <= 100),
  y_pct         numeric(6,3) not null check (y_pct >= 0 and y_pct <= 100),
  number        int not null,
  comment       text not null,
  resolved      boolean not null default false,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.users(id) on delete set null
);

create index idx_attachment_pins_attachment on public.attachment_pins(attachment_id);
create index idx_attachment_pins_tenant on public.attachment_pins(tenant_id);

alter table public.attachment_pins enable row level security;

-- Same bar as the attachments themselves: any tenant member can read; write
-- (add/resolve/delete pins) excludes viewers, matching "Viewers cannot
-- upload files" / "Viewers cannot delete attachments" already enforced in
-- src/app/[tenant]/issues/[id]/actions.ts for the sibling attachment actions.
create policy attachment_pins_select on public.attachment_pins
  for select using ( tenant_id in (select public.current_tenant_ids()) );
create policy attachment_pins_write on public.attachment_pins
  for all using ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) )
  with check ( public.has_tenant_role(tenant_id, array['owner','admin','member']::membership_role[]) );

insert into public.schema_migrations (filename)
values ('0119_attachment_pins.sql') on conflict do nothing;
