-- Atomic issue number allocator: locks the project row, reads max(number)+1,
-- returns it. Eliminates the TOCTOU race in createSubIssuesAction where two
-- concurrent inserts could read the same max and produce duplicate numbers.
create or replace function public.next_issue_number(p_tenant_id uuid, p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  -- Lock the project row for the duration of this transaction
  perform 1 from public.projects
    where id = p_project_id and tenant_id = p_tenant_id
    for update;

  select coalesce(max(number), 0) + 1
    into v_next
    from public.issues
    where project_id = p_project_id and tenant_id = p_tenant_id;

  return v_next;
end;
$$;

-- Only service-role and authenticated users who are members can call this
revoke all on function public.next_issue_number(uuid, uuid) from public;
grant execute on function public.next_issue_number(uuid, uuid) to authenticated;
grant execute on function public.next_issue_number(uuid, uuid) to service_role;

insert into public.schema_migrations (filename)
  values ('0062_next_issue_number.sql')
  on conflict (filename) do nothing;
