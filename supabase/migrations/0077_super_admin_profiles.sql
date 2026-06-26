-- Platform admin extended profiles
-- Keeps admin contact data self-contained on super_admins rather than polluting users.

alter table public.super_admins
  add column if not exists display_name  text,
  add column if not exists phone         text,
  add column if not exists cell          text,
  add column if not exists alt_email     text,
  add column if not exists notes         text,
  add column if not exists updated_at    timestamptz not null default now();

-- Keep updated_at current on any profile edit
create or replace function public.set_super_admin_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_super_admins_updated on public.super_admins;
create trigger trg_super_admins_updated
  before update on public.super_admins
  for each row execute function public.set_super_admin_updated_at();
