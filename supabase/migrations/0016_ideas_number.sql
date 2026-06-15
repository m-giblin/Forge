-- 0016_ideas_number.sql
-- Adds a sequential display number to the ideas table (e.g. TT-1, TT-2).
-- Same pattern as set_issue_number() in 0002_issues.sql, scoped per think_tank.
-- Purely additive: new column on a new table with zero existing rows.

alter table public.ideas
  add column if not exists number integer;

-- Sequential number per think_tank: idea 1, 2, 3... within each think tank.
create or replace function public.set_idea_number()
returns trigger language plpgsql as $$
begin
  if new.number is null or new.number = 0 then
    select coalesce(max(number), 0) + 1
      into new.number
      from public.ideas
     where think_tank_id = new.think_tank_id;
  end if;
  return new;
end;
$$;

create trigger trg_ideas_number
  before insert on public.ideas
  for each row execute function public.set_idea_number();

-- Enforce uniqueness: no two ideas in the same think tank share a number.
alter table public.ideas
  add constraint ideas_think_tank_number_unique unique (think_tank_id, number);

-- schema_migrations tracking
insert into public.schema_migrations (filename, notes) values
  ('0016_ideas_number.sql', 'ideas: add sequential number column + trigger (per think_tank)')
on conflict (filename) do nothing;
