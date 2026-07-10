-- 0103_fix_rls_uuid_mismatch_sweep.sql
--
-- Sweep fix for the RLS bug pattern already corrected for spaces/pages/page_shares/
-- custom_roles (0089) and tenant_sso_config (0102, CIO audit F-04): policies were
-- comparing memberships.user_id (an app-level public.users.id) directly against
-- auth.uid() (the Supabase auth UUID) or joining through users.auth_id. These are
-- different ID spaces, so the comparison silently evaluates false — the policy is
-- either dead (if OR'd with a working permissive policy) or wrongly denies access.
--
-- Fix: replace with public.current_app_user_id(), the SECURITY DEFINER helper
-- (defined in 0001_init_multitenancy.sql) that correctly maps auth.uid() -> users.id.
--
-- Policies already using public.has_tenant_role() or public.current_tenant_ids()
-- are correct and are NOT touched here.

-- ============================================================
-- idea_votes (defined twice: 0017 + 0052, both policy sets may be live)
-- ============================================================
drop policy if exists "tenant members read idea_votes" on public.idea_votes;
drop policy if exists "tenant members vote" on public.idea_votes;
drop policy if exists "members unvote" on public.idea_votes;
drop policy if exists idea_votes_select on public.idea_votes;
drop policy if exists idea_votes_insert on public.idea_votes;
drop policy if exists idea_votes_delete on public.idea_votes;

create policy idea_votes_select on public.idea_votes
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_votes.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy idea_votes_insert on public.idea_votes
  for insert with check (
    user_id = public.current_app_user_id()
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_votes.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy idea_votes_delete on public.idea_votes
  for delete using (user_id = public.current_app_user_id());

-- ============================================================
-- think_tank_pills (0020)
-- ============================================================
drop policy if exists "tenant members read pills" on public.think_tank_pills;
drop policy if exists "tenant members create pills" on public.think_tank_pills;
drop policy if exists "tenant admins update pills" on public.think_tank_pills;
drop policy if exists "tenant admins delete pills" on public.think_tank_pills;

create policy "tenant members read pills" on public.think_tank_pills
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "tenant members create pills" on public.think_tank_pills
  for insert with check (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "tenant admins update pills" on public.think_tank_pills
  for update using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.current_app_user_id() and role in ('owner','admin')
    )
  );

create policy "tenant admins delete pills" on public.think_tank_pills
  for delete using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.current_app_user_id() and role in ('owner','admin')
    )
  );

-- ============================================================
-- idea_comment_attachments (0021) + idea-attachments storage bucket
-- ============================================================
drop policy if exists "tenant members read idea attachments" on public.idea_comment_attachments;

create policy "tenant members read idea attachments" on public.idea_comment_attachments
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

drop policy if exists "tenant members read idea attachment files" on storage.objects;

create policy "tenant members read idea attachment files" on storage.objects
  for select using (
    bucket_id = 'idea-attachments'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.memberships where user_id = public.current_app_user_id()
    )
  );

-- ============================================================
-- issue_attachments (0037) + issue-attachments storage bucket
-- ============================================================
drop policy if exists "tenant members read issue attachments" on public.issue_attachments;

create policy "tenant members read issue attachments" on public.issue_attachments
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

drop policy if exists "tenant members read issue attachment files" on storage.objects;

create policy "tenant members read issue attachment files" on storage.objects
  for select using (
    bucket_id = 'issue-attachments'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.memberships where user_id = public.current_app_user_id()
    )
  );

-- ============================================================
-- issue_saved_views (0040)
-- ============================================================
drop policy if exists "read saved views" on public.issue_saved_views;
drop policy if exists "insert own saved views" on public.issue_saved_views;
drop policy if exists "update own saved views" on public.issue_saved_views;
drop policy if exists "delete own saved views" on public.issue_saved_views;

create policy "read saved views" on public.issue_saved_views
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
    and (is_shared = true or user_id = public.current_app_user_id())
  );

create policy "insert own saved views" on public.issue_saved_views
  for insert with check (
    user_id = public.current_app_user_id()
    and tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "update own saved views" on public.issue_saved_views
  for update using (user_id = public.current_app_user_id());

create policy "delete own saved views" on public.issue_saved_views
  for delete using (user_id = public.current_app_user_id());

-- ============================================================
-- sprints (0043)
-- ============================================================
drop policy if exists sprints_select on public.sprints;

create policy sprints_select on public.sprints
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = sprints.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

-- ============================================================
-- issue_links (0044)
-- ============================================================
drop policy if exists issue_links_select on public.issue_links;

create policy issue_links_select on public.issue_links
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = issue_links.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

-- ============================================================
-- webhook_endpoints (0045)
-- ============================================================
drop policy if exists webhook_endpoints_admin on public.webhook_endpoints;

create policy webhook_endpoints_admin on public.webhook_endpoints
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = webhook_endpoints.tenant_id
        and m.user_id = public.current_app_user_id()
        and m.role in ('owner','admin')
    )
  );

-- ============================================================
-- automation_rules (0047)
-- ============================================================
drop policy if exists automation_rules_admin on public.automation_rules;

create policy automation_rules_admin on public.automation_rules
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = automation_rules.tenant_id
        and m.user_id = public.current_app_user_id()
        and m.role in ('owner','admin')
    )
  );

-- ============================================================
-- sla_policies / sla_events (0048)
-- "service role manage sla_events" (using(true)) is intentional, not touched.
-- ============================================================
drop policy if exists "admin manage sla_policies" on public.sla_policies;
drop policy if exists "members read sla_policies" on public.sla_policies;
drop policy if exists "members read sla_events" on public.sla_events;

create policy "admin manage sla_policies" on public.sla_policies
  for all using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.current_app_user_id() and role in ('owner','admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.current_app_user_id() and role in ('owner','admin')
    )
  );

create policy "members read sla_policies" on public.sla_policies
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "members read sla_events" on public.sla_events
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

-- ============================================================
-- project_dependencies (0053)
-- ============================================================
drop policy if exists project_deps_select on public.project_dependencies;
drop policy if exists project_deps_insert on public.project_dependencies;
drop policy if exists project_deps_delete on public.project_dependencies;

create policy project_deps_select on public.project_dependencies
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = project_dependencies.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy project_deps_insert on public.project_dependencies
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = project_dependencies.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy project_deps_delete on public.project_dependencies
  for delete using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = project_dependencies.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

-- ============================================================
-- issue_signoffs / roadmap_phases (0059)
-- ============================================================
drop policy if exists issue_signoffs_select on public.issue_signoffs;
drop policy if exists issue_signoffs_insert on public.issue_signoffs;
drop policy if exists issue_signoffs_update on public.issue_signoffs;
drop policy if exists issue_signoffs_delete on public.issue_signoffs;
drop policy if exists roadmap_phases_select on public.roadmap_phases;
drop policy if exists roadmap_phases_write on public.roadmap_phases;

create policy issue_signoffs_select on public.issue_signoffs
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = issue_signoffs.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy issue_signoffs_insert on public.issue_signoffs
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = issue_signoffs.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy issue_signoffs_update on public.issue_signoffs
  for update using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = issue_signoffs.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy issue_signoffs_delete on public.issue_signoffs
  for delete using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = issue_signoffs.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy roadmap_phases_select on public.roadmap_phases
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = roadmap_phases.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy roadmap_phases_write on public.roadmap_phases
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = roadmap_phases.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

-- ============================================================
-- okrs / idea_okr_links (0061)
-- ============================================================
drop policy if exists okrs_select on public.okrs;
drop policy if exists okrs_insert on public.okrs;
drop policy if exists okrs_update on public.okrs;
drop policy if exists okrs_delete on public.okrs;
drop policy if exists idea_okr_select on public.idea_okr_links;
drop policy if exists idea_okr_insert on public.idea_okr_links;
drop policy if exists idea_okr_delete on public.idea_okr_links;

create policy okrs_select on public.okrs
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = okrs.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy okrs_insert on public.okrs
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = okrs.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy okrs_update on public.okrs
  for update using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = okrs.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy okrs_delete on public.okrs
  for delete using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = okrs.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy idea_okr_select on public.idea_okr_links
  for select using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_okr_links.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy idea_okr_insert on public.idea_okr_links
  for insert with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_okr_links.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

create policy idea_okr_delete on public.idea_okr_links
  for delete using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = idea_okr_links.tenant_id and m.user_id = public.current_app_user_id()
    )
  );

-- ============================================================
-- issue_time_logs (0070)
-- ============================================================
drop policy if exists "members read time logs" on public.issue_time_logs;
drop policy if exists "members log time" on public.issue_time_logs;
drop policy if exists "members delete own logs" on public.issue_time_logs;

create policy "members read time logs" on public.issue_time_logs
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "members log time" on public.issue_time_logs
  for insert with check (
    user_id = public.current_app_user_id()
    and tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "members delete own logs" on public.issue_time_logs
  for delete using (user_id = public.current_app_user_id());

-- ============================================================
-- issue_risk_gates (0074) — writes are service-role only
-- ============================================================
drop policy if exists "risk_gates_tenant_read" on public.issue_risk_gates;

create policy "risk_gates_tenant_read" on public.issue_risk_gates
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

-- ============================================================
-- active_timers / member_availability / time_off_requests /
-- timesheet_submissions (0079) — mixed with already-correct
-- has_tenant_role()/current_tenant_ids() policies, not touched.
-- ============================================================
drop policy if exists "read own timer" on public.active_timers;
drop policy if exists "manage own timer" on public.active_timers;

create policy "read own timer" on public.active_timers
  for select using (user_id = public.current_app_user_id());

create policy "manage own timer" on public.active_timers
  for all using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

drop policy if exists "own availability manage" on public.member_availability;

create policy "own availability manage" on public.member_availability
  for all using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

drop policy if exists "members read own + admins read all" on public.time_off_requests;
drop policy if exists "create own" on public.time_off_requests;

create policy "members read own + admins read all" on public.time_off_requests
  for select using (
    user_id = public.current_app_user_id()
    or public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

create policy "create own" on public.time_off_requests
  for insert with check (user_id = public.current_app_user_id());

drop policy if exists "own submissions" on public.timesheet_submissions;

create policy "own submissions" on public.timesheet_submissions
  for all using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

-- ============================================================
-- recurring_time_entries / time_off_balances (0080)
-- ============================================================
drop policy if exists "own recurring entries" on public.recurring_time_entries;

create policy "own recurring entries" on public.recurring_time_entries
  for all using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

drop policy if exists "own or admin balance" on public.time_off_balances;

create policy "own or admin balance" on public.time_off_balances
  for select using (
    user_id = public.current_app_user_id()
    or public.has_tenant_role(tenant_id, array['owner','admin']::membership_role[])
  );

-- ============================================================
-- timeline_baselines / timeline_baseline_items (0082)
-- ============================================================
drop policy if exists "members_read_baselines" on public.timeline_baselines;
drop policy if exists "members_insert_baselines" on public.timeline_baselines;
drop policy if exists "members_read_baseline_items" on public.timeline_baseline_items;
drop policy if exists "members_insert_baseline_items" on public.timeline_baseline_items;

create policy "members_read_baselines" on public.timeline_baselines
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "members_insert_baselines" on public.timeline_baselines
  for insert with check (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "members_read_baseline_items" on public.timeline_baseline_items
  for select using (
    baseline_id in (
      select id from public.timeline_baselines
      where tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
    )
  );

create policy "members_insert_baseline_items" on public.timeline_baseline_items
  for insert with check (
    baseline_id in (
      select id from public.timeline_baselines
      where tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
    )
  );

-- ============================================================
-- scheduled_reports (0084)
-- ============================================================
drop policy if exists "scheduled_reports_tenant_isolation" on public.scheduled_reports;

create policy "scheduled_reports_tenant_isolation" on public.scheduled_reports
  using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

-- ============================================================
-- billing_requests / trial_lifecycle_emails (0085)
-- ============================================================
drop policy if exists "tenant_billing_requests_select" on public.billing_requests;
drop policy if exists "trial_emails_select" on public.trial_lifecycle_emails;

create policy "tenant_billing_requests_select" on public.billing_requests
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "trial_emails_select" on public.trial_lifecycle_emails
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

-- ============================================================
-- project_whiteboards (0088)
-- ============================================================
drop policy if exists "members_read_whiteboards" on public.project_whiteboards;
drop policy if exists "members_write_whiteboards" on public.project_whiteboards;

create policy "members_read_whiteboards" on public.project_whiteboards
  for select to authenticated
  using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "members_write_whiteboards" on public.project_whiteboards
  for all to authenticated
  using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  )
  with check (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

-- ============================================================
-- recurring_issues (0094)
-- ============================================================
drop policy if exists "recurring_issues_member_read" on public.recurring_issues;
drop policy if exists "recurring_issues_admin_write" on public.recurring_issues;

create policy "recurring_issues_member_read" on public.recurring_issues
  for select using (
    tenant_id in (select tenant_id from public.memberships where user_id = public.current_app_user_id())
  );

create policy "recurring_issues_admin_write" on public.recurring_issues
  for all using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = public.current_app_user_id() and role in ('owner','admin')
    )
  );

insert into public.schema_migrations (filename)
values ('0103_fix_rls_uuid_mismatch_sweep.sql')
on conflict do nothing;
