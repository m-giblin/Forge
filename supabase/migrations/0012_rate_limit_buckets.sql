-- 0012_rate_limit_buckets.sql
-- Shared rate-limit scoreboard for serverless deployments.
-- All Vercel instances read/write the same rows so tallies are accurate
-- across the fleet. No RLS — service-role only (BYPASSRLS).

create table if not exists public.rate_limit_buckets (
  key        text        primary key,
  count      integer     not null default 0,
  reset_at   timestamptz not null
);

comment on table public.rate_limit_buckets is
  'Shared rate-limit counters. One row per key+window. Stale rows are harmless and cleaned up on next hit.';

-- Atomic upsert + increment in a single round-trip.
-- Returns the NEW count after incrementing, and the reset_at timestamp.
-- If the window has expired, resets to count=1 with a fresh window.
create or replace function public.rl_increment(
  p_key       text,
  p_window_ms bigint
) returns table (new_count integer, reset_at timestamptz)
language plpgsql
as $$
declare
  v_now       timestamptz := now();
  v_reset_at  timestamptz;
  v_count     integer;
begin
  -- Try to find an existing, non-expired bucket.
  select b.count, b.reset_at
    into v_count, v_reset_at
    from public.rate_limit_buckets b
   where b.key = p_key
     and b.reset_at > v_now
   for update;

  if found then
    -- Window still open — increment.
    v_count := v_count + 1;
    update public.rate_limit_buckets
       set count = v_count
     where rate_limit_buckets.key = p_key;
  else
    -- Window expired or no row — start fresh.
    v_count    := 1;
    v_reset_at := v_now + (p_window_ms || ' milliseconds')::interval;
    insert into public.rate_limit_buckets (key, count, reset_at)
      values (p_key, v_count, v_reset_at)
      on conflict (key) do update
        set count    = 1,
            reset_at = excluded.reset_at;
  end if;

  return query select v_count, v_reset_at;
end;
$$;

insert into public.schema_migrations (filename) values ('0012_rate_limit_buckets.sql') on conflict do nothing;
