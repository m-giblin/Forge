# Handoff: Forge-Worx Project Management App

## Overview
Forge-Worx is a full SaaS project-management application (Jira/Rally/ClickUp/monday.com-class competitor for SMBs) designed in the "Ember Rust" visual system (dark olive/charcoal sidebar, rust-orange accent `#b7452f`/`#8c4632`, cream card surfaces `#f4f2eb`, Manrope display type + Inter body type). This bundle documents the full current scope: core workflow, planning/hierarchy tools, agile ceremonies, governance/admin, reporting, automation/integration, and a separate Super Admin platform portal.

## About the Design Files
The files in this bundle (`Forge-Worx App.dc.html`, `Landing Page.dc.html`, `Login Page.dc.html`) are **design references built in HTML** — high-fidelity prototypes of look, layout, copy, and interaction behavior. They are **not production code to copy directly**. The task is to **recreate these designs in the target codebase's real environment** (the existing Next.js/React/Supabase stack referenced during design — see "Source codebase" below) using that codebase's actual data layer, auth, and component patterns. Where the HTML uses inline styles and mock client-state, the real implementation should use the target app's real styling approach (likely Tailwind, per the source repo) and real server data.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and most interaction behavior (clicks, toggles, filters, drag where present) are final and intended to be matched closely. Some interactions are necessarily simplified because the prototype has no backend — see "Known simplifications" below for exactly where real logic must replace mock logic.

## Source codebase context
This design was built as a "catch-up" pass against a real Next.js + Supabase codebase (folder mounted as `forge/` during design), which already implements much of the core (Board, Backlog, Roadmap, Reports, Think Tank, Mind Map, Whiteboards, Calendar, Time tracking, Spaces, Customers, Changelog, Stakeholder, Support, and a full platform-level `/admin` Super Admin console). This bundle's new work fills gaps found by comparing the design against that source and against Jira/Rally/ClickUp/monday.com. Implementers should treat the source repo's existing routes/patterns (Server Actions, Supabase RLS, App Router `[tenant]/[feature]` structure) as the reference for HOW to wire things — this bundle is the reference for WHAT the UI/UX should be for the new/changed screens.

## Known simplifications (must become real before ship)
1. ~~Two overlapping watcher systems~~ — **Resolved during design.** Consolidated onto a single `this.state.watchers` map (`{ issueKey: [personKey, ...] }`); the issue drawer's Watch toggle, the Board's "My watching only" filter, and the new Watching page all read/write the same map. The assignee is treated as an implicit watcher everywhere (unioned in, not stored). Build this as one `issue_watchers` relation.
2. **All state is client-only mock data.** Every feature added in this pass (Permissions matrix, Automation rules, issue Dependencies/links, Components, Custom fields, Issue types, Workflow states, Recurring templates, Intake Forms + submissions, Guest access links, API keys, Timeline positions, Dashboards widget layout, PI objectives, Mind Map tree) lives in in-memory React state with hardcoded seed data. None of it persists or is scoped by real tenant/user. Real schema and API endpoints must be designed — this doc describes shape and behavior, not a schema.
3. **Role switcher now does light real gating, but isn't full RBAC.** The PM/Dev sidebar toggle maps to `admin`/`member` for one concrete example: the gear-menu's **Settings** and **Super Admin** entries are hidden entirely when in Dev/member role (matching the Permissions page's "Admin only" column). Everything else the Permissions matrix describes (create/edit/delete issue, manage sprints/epics, view budget, export data) is still visual-only and not enforced. Build full role-based access control against the Permissions schema and extend this same show/hide pattern to every gated action.
4. **Super Admin portal is a disconnected mock dataset**, but tenant naming/slugs now match the real project names/keys used elsewhere in the design (`Storefront Rebuild` / `forge`, `Travli Web App` / `web`) for internal consistency. Data is still hardcoded and doesn't reflect the actual tenant workspace's live data — treat as its own module with its own real data source (only platform staff should reach it).
5. **Mind Map / Timeline layouts are pseudo-random, not persisted.** Node positions (Mind Map tree collapse state, Timeline bar start/duration) are computed from a deterministic hash of the issue key for visual variety, not real dates/estimates. Real implementation needs actual start/due dates and a real layout algorithm (e.g., dagre for Mind Map, as the source app already does — reuse it).
6. **Dependency links, components, custom fields, issue types, workflow states are workspace-global in the mock**, not scoped per-project. Confirm with product whether these should be per-project or per-workspace before building the schema.

## Design Tokens
- **Primary accent (rust):** `#b7452f` (bright/active), `#8c4632` (buttons/borders), `#5e2c1f` (button border/dark accent)
- **Sidebar dark:** `#20221f` → `#191a16` → `#131412` (gradient), text `#d8d3c2` / `#a39d89` / `#736e5c`
- **Cream surfaces:** `#f4f2eb` (cards), `#eeece4` (app background), `#ddd8c9` (borders), `#eae6da` / `#ece7d9` (subtle fills)
- **Status colors:** Backlog `#a19d90`/`#f1efe9`, Todo `#3a6ea8`/`#eaf1f8`, In Progress `#c9791d`/`#fdf1de`, In Review `#7a4fa0`/`#f4ecfa`, Blocked `#c0392b`/`#fbeae8`, Done `#3f7d4c`/`#e9f3ea`
- **Super Admin portal (distinct neutral theme):** slate/white `#f8fafc`/`#fff`, dark sidebar `#111827`, indigo accent `#4f46e5`/`#818cf8` — intentionally different from the tenant app to signal "you've left the workspace"
- **Typography:** Manrope 700/800 for headings/brand, Inter 400–700 for body/UI. Base UI text ~12–13px, section headers ~21px/800, micro-labels ~10–10.5px uppercase with 0.05–0.08em tracking
- **Radius:** 5–6px standard controls/cards, 8px modals, 999px pills/chips/switches
- **Shadows:** modals `0 24px 60px rgba(0,0,0,0.4)`, drawers `-16px 0 40px rgba(0,0,0,0.35)`, dropdowns `0 12px 24px rgba(0,0,0,0.5)` (dark) or `0 12px 24px rgba(0,0,0,0.15)` (light)

## Navigation structure (implement in this grouping)
Sidebar is grouped with uppercase section labels:
- **(ungrouped)** Home
- **Execution:** My Work, Code Review, Watching, Sprint board, Backlog, Table, Timeline, Calendar
- **Planning:** Projects, Roadmap, Portfolio, Mind Map
- **Insights:** Reports, Dashboards, Org Workload
- **Collaboration:** Team, Think Tank, Whiteboards
- **Relationships:** Customers, Stakeholder, Changelog

Secondary/admin surfaces live behind the gear icon in the sidebar footer (a popover menu), not in main nav: Preferences, Spaces, Help Docs, Get Support, Settings, Backlog Refinement, Estimation Poker, Sprint Planning, PI Planning, Advanced Search, Intake Forms, Issue Templates, Super Admin (opens the separate platform portal).

The Settings page itself is a card grid of sub-pages: Members & Roles (permissions matrix), Custom Fields & Components, Issue Types, Workflow, API Keys, Security & SSO, Billing & Rates, Feature Flags (static — real per-workspace toggle intentionally deferred to platform-level Feature Access), Integrations, Automation, Recurring Tasks, Guest & Client Access, Data Export & Import, Usage & Seats, Wiki Insights, Engineering Health, Onboarding Wizard (preview), Support Queue.

## Screens / Views — by area

### Core workflow (pre-existing, reference only)
Home (role-split PM/Dev dashboards), Sprint Board (kanban, swimlanes, WIP limits, quick-create), Backlog (grouped by epic/status/sprint), Roadmap (Goals = Initiative/Theme rollup + epic timeline swimlane), Reports (4 tabs: Overview / Delivery health / Team & capacity / Budget & compliance, plus new **My contribution** tab), Team (workload), Calendar (sprint schedule + time-off), Think Tank (idea pipeline), Customers, Changelog, Stakeholder, Spaces (wiki), Help Docs, Get Support.

### New this pass — Planning & hierarchy
- **Portfolio** — cross-project board; each project is a card row with health dot + aggregate counts, epics shown as mini progress-bar chips.
- **Mind Map** — indented-tree (not a canvas graph) rendering Epic → Sprint-bucket → Issue, with collapse/expand, inline "+ Add" (creates a real issue), checkbox multi-select on issue rows + bottom action bar to bulk-move to a sprint, and a Present mode (steps through nodes, dims non-current).
- **Dependencies** — "Blocks" / "Blocked by" chip lists in the issue drawer, add via issue-key text input + relation-type select.
- **Components** — per-project tag field, shown as a chip on the issue drawer; managed via Settings.

### New this pass — Agile ceremonies
Backlog Refinement (points/priority triage list + "Mark ready" moves Backlog→Todo), Estimation Poker (card deck 1/2/3/5/8/13/21, vote/reveal/apply, queue navigation), Sprint Planning (candidate list with committed-points-vs-capacity bar, overcommit warning), PI Planning (cross-team objective list with 5-dot confidence vote).

### New this pass — Workflow configuration (all under Settings)
Issue Types (add/remove custom types, built-ins protected), Workflow (reorderable status list + "restrict to adjacent states" toggle), Custom Fields (name + type: text/number/select/date/checkbox).

### New this pass — Search & navigation
Global Search (topbar "Search everything" → modal, searches issue key/title/description/comments across all projects), Advanced Search (JQL-style `field = "value" AND …` parser over status/priority/type/assignee/epic/project, example chips, saved queries).

### New this pass — Automation & integration
Automation (When [trigger] → then [action] rule builder, enable toggle, delete), Integrations (GitHub/Slack/Figma connect cards), Development panel in issue drawer (link branch → mock PR # + status; shown alongside Dependencies).

### New this pass — View types
Timeline (Gantt-style: epic groups, issue bars positioned across an 8-week axis, "waits on X" note under blocked-dependency bars), Table (full spreadsheet grid, every cell an inline-editable select, all issue fields), Dashboards (add/remove widgets: Stat row / Status breakdown donut-as-bars / Burndown bar chart / Team workload list — composable, not fixed).

### New this pass — Data model & intake
Multiple assignees (extra-assignee chips + add-select in issue drawer, alongside the single primary assignee), Intake Forms (form-title + field-list builder, public link, submissions list with "Convert to ticket"), Recurring Tasks (name + cadence templates), Guest & Client Access (toggle + generated view-only link), Issue Templates (prefills quick-create with type/priority/title-prefix).

### New this pass — Collaboration extras
Issue drawer now has a 3-way tab: **Comments** (unchanged) / **Updates** (system-event feed: status/assignee/priority changes, distinct from user comments) / **Files & Proofing** (click a mock attachment image to drop numbered pins, leave feedback text per pin, mark resolved).

### New this pass — Role-based views
My Work (cross-project assigned-to-me queue, grouped Overdue/Blocked/In-progress/Upcoming), Code Review (Waiting on your review / Your open PRs / Recently merged, sourced from Development-panel branch links), Org Workload (cross-project per-person workload bars, for managers overseeing multiple teams), "My contribution" Reports tab (personal stat cards: issues done, points, open PRs, avg cycle time).

### New this pass — Remaining real gaps vs. ClickUp/monday/Jira
Projects Hub (card grid of all projects, health + counts, click to jump into that project's Roadmap), Watching (aggregate list of every issue the current user watches, across projects, with Unwatch), Billing & Rates (plan + invoice list + per-person hourly rate editor), Security & SSO (SSO enable, require-SSO-for-all, session timeout select), Data Export & Import (CSV export-all button, CSV import file picker), Usage & Seats (seats/API-calls/storage stat cards), Wiki Insights (Spaces page views/editors list), Engineering Health (DX metric cards + an explicit "still in progress" note — intentionally left as a stub, matching the real codebase's own unfinished state), Onboarding Wizard (step-through preview of a first-run flow), workspace-scoped Support Queue (ticket list with open/resolved toggle, distinct from the platform-wide Super Admin support console).

### Super Admin platform portal (separate, distinct visual theme)
Reached via gear menu → "Super Admin." Full-shell swap (own sidebar/topbar, indigo/slate theme). Pages: Dashboard (KPIs, health-scored tenant table, quick actions, recent activity), Tenants (provision form + full tenant table with suspend/reactivate/impersonate), AI Analytics (usage by tenant), Feature Access (per-plan feature toggle matrix), Plans (pricing tier cards), Support (platform-wide ticket list), Compliance (GDPR/CCPA/SOC2 status cards), Audit Log, Admins (platform staff list).

## Interactions & Behavior
- All navigation is client-side state (`view` key) swapping which section renders — no real routing in the prototype. Real implementation should map each `view` value to a real route (the source app's `[tenant]/[feature]` App Router convention).
- Modals (Manage Epics/Sprints, New Project, Global Search, changelog RSS) are `position:fixed` overlays with a click-outside-to-close backdrop (`stopProp` pattern to prevent the inner panel's click from bubbling to the backdrop).
- Toggle switches are custom-built (a positioned pill + circle knob), not native checkboxes — reuse this exact visual pattern (34×19px pill, 15×15px knob, 2px inset) everywhere a boolean toggle appears.
- Drag-and-drop exists only on the Sprint Board (card → column). Mind Map, Timeline, and Dashboards do NOT have real drag positioning in this pass — layout is computed, not draggable. If draggable widgets/timeline bars are wanted, that's new scope.

## Files
- `Forge-Worx App.dc.html` — the entire application (single file, all screens/logic/styling)
- `Landing Page.dc.html` — public marketing landing page
- `Login Page.dc.html` — auth entry point
- `assets/forge-worx-badge-transparent.png` — transparent logo cutout used in hero moments

## Suggested implementation order
See accompanying note from the design conversation — summarized:
1. **Foundation:** reconcile data model gaps (watchers, permissions schema, workflow/issue-type/component schema) before writing any new UI.
2. **Navigation shell:** grouped sidebar nav + gear-menu popover restructure (low-risk, unblocks everything else being reachable).
3. **Core-daily-use views:** My Work, Watching, Table, Timeline, Dashboards, Projects Hub — highest daily traffic, biggest usability win.
4. **Planning & hierarchy:** Portfolio, Mind Map tree, Dependencies, Components.
5. **Governance & workflow config:** Permissions, Custom Fields/Issue Types/Workflow editor, API Keys, Security & SSO, Billing & Rates.
6. **Ceremonies:** Backlog Refinement, Estimation Poker, Sprint Planning, PI Planning.
7. **Automation & integration:** Automation rules, Integrations, Development/Git panel, Code Review queue.
8. **Search:** Global Search, Advanced Search (AQL).
9. **Intake & collaboration extras:** Forms, Recurring Tasks, Guest Access, Issue Templates, Updates feed, Files & Proofing.
10. **Reporting additions:** CFD, Control chart, Burnup, My contribution tab, Org Workload.
11. **Lower-traffic admin:** Usage & Seats, Wiki Insights, Engineering Health, Onboarding Wizard, workspace Support Queue.
12. **Super Admin platform portal:** last, since it's the most isolated module and needs real platform-level auth separate from tenant auth.
