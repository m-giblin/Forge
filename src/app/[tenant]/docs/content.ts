import type { DocBlock } from './blocks';

export type DocStep = {
  step: number;
  title: string;
  description: string;
  tip?: string;
};

export type DocIssue = {
  problem: string;
  fix: string;
};

export type DocSection = {
  id: string;
  title: string;
  description: string;
  /** 2-4 sentences of context before the steps: what this is for, when you'd reach for it, what breaks if you skip it.
   * Omit once a section has real `blocks` — the opening paragraph block replaces this. */
  overview?: string;
  icon: string;
  /** Legacy step-list rendering. Omit once a section has real `blocks`. */
  steps?: DocStep[];
  /** Common problems and their fixes. Legacy — a `blocks` article covers this with callout/warning blocks instead. */
  commonIssues?: DocIssue[];
  /**
   * Real documentation content — typed prose/heading/table/example blocks.
   * When present, DocSectionCard renders this instead of the step list.
   * Converting a section over is additive, not a schema break.
   */
  blocks?: DocBlock[];
  roles: Array<'owner' | 'admin' | 'member' | 'viewer'>;
};

export type DocGuide = {
  role: 'user' | 'pm' | 'contributor' | 'admin';
  title: string;
  subtitle: string;
  color: string;
  sections: DocSection[];
};

export const DOC_GUIDES: DocGuide[] = [
  {
    role: 'user',
    title: 'User Guide',
    subtitle: 'Get up to speed with Forge as a team member or viewer',
    color: 'blue',
    sections: [
      {
        id: 'getting-started',
        title: 'Getting Started',
        description: 'Join your workspace, set up your profile, and complete onboarding',
        icon: '🚀',
        roles: ['owner', 'admin', 'member', 'viewer'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Everything else in Forge assumes these four things are done first — especially setting your timezone correctly, since it quietly affects when you see deadline and SLA warnings. The whole flow takes a few minutes and you won\'t need to repeat it.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Create your account', detail: 'Navigate to the invite link your admin sent. Click Accept Invitation, enter your email and choose a password — or sign in with Google/GitHub if SSO is enabled. You land on the onboarding checklist automatically after your first login.' },
              { title: 'Join your workspace', detail: 'After signing in you\'re placed in your team\'s workspace. Your URL will be something like forge.app/acme-corp — bookmark it. Each tenant has its own slug and data is fully isolated between workspaces.' },
              {
                title: 'Set up your profile',
                detail: 'Click your avatar in the bottom-left sidebar to open Profile Settings. Add a display name, avatar, and timezone. Forge uses your timezone for sprint deadline countdowns and SLA warning notifications.',
                tip: 'Set your timezone correctly — sprint deadlines and SLA countdowns display in your local time. Wrong timezone = missed alerts.',
              },
              { title: 'Complete the onboarding checklist', detail: 'Forge shows a checklist on first login, accessible via the flag icon in the sidebar. Complete each step to unlock the full interface — it takes about 5 minutes and ensures your account is fully configured.' },
            ],
          },
        ],
      },
      {
        id: 'working-with-issues',
        title: 'Working with Issues',
        description: 'View, update, and comment on issues in your workspace',
        icon: '🎫',
        roles: ['owner', 'admin', 'member', 'viewer'],
        blocks: [
          {
            type: 'paragraph',
            text: 'An issue is the basic unit of work in Forge — a bug, a feature, a task. Everything else (sprints, the board, reports) is really just a different view over the same set of issues, so getting comfortable here pays off everywhere else.',
          },
          {
            type: 'steps',
            items: [
              { title: 'View issues', detail: 'Open the Issues tab in the sidebar. By default it shows all open issues in the workspace. Use the filter bar to narrow by project, assignee, priority, or sprint. Click any row to open the detail panel.' },
              { title: 'Update issue status', detail: 'In the issue detail panel, the status badge (Open → In Progress → In Review → Done) is a dropdown — click it to advance the issue. Members can update status on issues assigned to them; Viewers are read-only.' },
              {
                title: 'Add a comment',
                detail: 'In the issue detail panel, scroll to the Comments section. Type in the text area and press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to post. Markdown is supported: **bold**, *italic*, and fenced code blocks.',
                tip: 'Use #PROJECT-123 in a comment to cross-reference another issue. Forge renders it as a clickable link.',
              },
              { title: 'Upload attachments', detail: 'Drag a file onto the issue detail panel or click the paperclip icon in the comment toolbar. Attachments are stored per-issue and visible to all workspace members with access to that project.' },
            ],
          },
        ],
      },
      {
        id: 'daily-workflow',
        title: 'Your Daily Workflow',
        description: 'Assigned, Inbox, and Watching — the three tabs that keep you on top of work',
        icon: '📅',
        roles: ['owner', 'admin', 'member', 'viewer'],
        blocks: [
          {
            type: 'paragraph',
            text: 'These three tabs answer three different questions: Assigned is "what do I owe," Inbox is "what happened that I should know about," and Watching is "what am I keeping an eye on without owning it."',
          },
          {
            type: 'warning',
            title: 'Inbox is not a to-do list',
            text: 'Confusing Inbox for a to-do list, rather than Assigned, is the most common way people miss their own work. Inbox is about staying informed — what\'s actually yours to do lives in Assigned.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Check your morning Assigned list', detail: 'Open the Assigned tab in the sidebar to see all issues assigned to you, sorted by priority. This is your daily to-do list — work top to bottom by priority.' },
              {
                title: 'Process Inbox notifications',
                detail: 'The Inbox tab collects @mentions, issue assignments, and status changes affecting your issues. Mark items as read by clicking the checkmark. The unread count appears as a badge on the sidebar.',
                tip: 'Click "Mark all read" to clear the Inbox, then re-watch only the issues you need to actively track.',
              },
              { title: 'Review Watching issues', detail: 'The Watching tab shows issues you\'ve starred or been added to as a watcher. Use this to track blockers or cross-team dependencies without being the assignee.' },
              { title: 'Update progress before end of day', detail: 'Before logging off, update the status of any in-progress issues. Stale In Progress items trigger SLA warnings for admins after 48 hours by default — keeping your status current helps the whole team.' },
            ],
          },
        ],
      },
      {
        id: 'sprint-board',
        title: 'Sprint Board',
        description: 'Understand the Kanban board, move issues, and create quick tasks',
        icon: '🗂️',
        roles: ['owner', 'admin', 'member', 'viewer'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The Board is the day-to-day view of the active sprint — a snapshot of what\'s open, in progress, in review, and done. Unlike the Issues list, which shows everything, the Board is scoped to one sprint at a time — which is exactly what makes it useful for a standup: it\'s inherently limited to "what we\'re actually working on right now."',
          },
          {
            type: 'steps',
            items: [
              { title: 'Understand the columns', detail: 'The Board tab shows the active sprint as a Kanban board. Default columns are Open, In Progress, In Review, and Done. These status options are workspace-wide, configured by an Admin — not something set per-project.' },
              {
                title: 'Move issues between columns',
                detail: 'Drag an issue card to a new column to update its status instantly. Members can drag their own issues; admins can drag any issue. The status change is reflected immediately in the Issues list and Reports.',
                tip: 'Dragging to Done does NOT close the issue permanently — it stays in the sprint until a PM completes the sprint.',
              },
              { title: 'Filter the board', detail: 'Use the filter bar above the board to show only your issues (By Assignee), a specific label, or a priority tier. The board also has a sprint selector to view past sprints (read-only).' },
              { title: 'Create a quick issue', detail: 'Click the + button at the top of the Open column to create an issue directly on the board. Give it a title, type, and priority — it\'s added to the active sprint automatically.' },
            ],
          },
        ],
      },
      {
        id: 'time-tracking',
        title: 'Time Tracking',
        description: 'Log time on an issue, run a timer, and keep your weekly timesheet current',
        icon: '⏱️',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Time can be logged two ways: directly on the issue you\'re working on, or from your personal weekly timesheet — both write to the same underlying log, so it doesn\'t matter which one you use day to day. Viewers cannot log time or run timers; everyone else can.',
          },
          {
            type: 'info',
            title: 'If you don\'t see "My Timesheet" in the sidebar',
            text: 'Time tracking (the ops_layer feature) hasn\'t been turned on for this workspace — ask an Admin. Per-issue time logging on an individual issue still works regardless of this flag; the timesheet feature specifically gates the weekly view.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Log time on an issue', detail: 'Open an issue and find the time panel. Click "+ Log time manually" to enter Hours/Minutes, an optional note, a tag (Development, Review, Meetings, Testing, Design, Planning, Support, or your own), and whether it\'s billable.' },
              { title: 'Or just run the timer', detail: 'Click "▶ Start Timer" when you begin work on an issue, and "⏹ Stop & Log" when you\'re done — Forge logs the elapsed time automatically with a note like "Timer · 12m 34s". Only one timer runs at a time; starting a new one on a different issue stops the old one.' },
              { title: 'Watch the estimate vs. logged comparison', detail: 'If the issue has an estimate set, a progress bar shows how much of it you\'ve used — it turns amber past 90% and red past 100%, with a dismissible banner warning you\'re approaching or over the estimate. This is a heads-up, not a hard stop; you can keep logging time past 100%.' },
              { title: 'Use your weekly timesheet for a full-week view', detail: 'Open My Timesheet from the sidebar to see every issue you logged time against this week in a grid, with a daily total row. Click any day/issue cell to add or edit an entry directly from here instead of going to each issue individually.' },
              { title: 'Set up a recurring entry for regular work', detail: 'If you do the same loggable work on a schedule (e.g. a standing weekly meeting), add a Recurring Entry from the timesheet page — daily or specific weekdays. This is a saved template you can toggle active/paused, not a substitute for actually logging your other work.' },
              { title: 'Request time off', detail: 'If your workspace has Timesheet Premium enabled, a "🏖 Time Off" button on the timesheet page lets you submit a PTO, Sick, Holiday, or Other request with a date range and optional notes. Submitted requests show as pending until an Admin approves or rejects them.' },
            ],
          },
          {
            type: 'example',
            label: 'No "Submit week" or "Time Off" button',
            scenario: 'The timesheet page is missing a "Submit week" or "Time Off" button.',
            outcome: 'Those two specifically require the Premium tier of time tracking, separate from the base feature — logging time itself still works without it.',
          },
        ],
      },
      {
        id: 'team-wiki',
        title: 'Team Wiki (Spaces)',
        description: 'Personal, team, and project knowledge bases with rich text and search',
        icon: '📚',
        roles: ['owner', 'admin', 'member', 'viewer'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Spaces come in three flavors: a Project Space, auto-created with every project for that project\'s own docs; Team Spaces, shared workspace-wide for runbooks and how-tos; and My Space, private to you. Only Team and My Space are created by you — a Project Space just appears automatically.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Create a Team Space or My Space', detail: 'From Spaces in the sidebar, click "+ Team Space" (shared) or "+ My Space" (private to you) and pick an icon and name. Project Spaces aren\'t created here — they come automatically with the project.' },
              { title: 'Write a page', detail: 'Click "+ New page." The editor supports headings, bold/italic/strikethrough, lists, tables, code blocks with syntax highlighting, and a slash-command menu (type "/") for quick formatting — it autosaves about a second after you stop typing.' },
              { title: 'Search across everything you have access to', detail: 'Use the search box on the Spaces hub page — it searches page titles and content together, not just titles. There\'s no separate search inside one space; search from the hub.' },
              { title: 'Share a page externally, if needed', detail: 'Click "🔗 Share" on a page to grant read-only access to anyone with an email at a specific company domain — access expires after 48 hours and you can revoke it any time. Generic providers (Gmail, Yahoo, etc.) can\'t be used as the allowed domain.' },
            ],
          },
        ],
      },
      {
        id: 'calendar',
        title: 'Calendar',
        description: 'Issue due dates and sprint date ranges, in one monthly view',
        icon: '📅',
        roles: ['owner', 'admin', 'member', 'viewer'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The Calendar isn\'t a separate scheduling tool — it\'s a monthly view of due dates and sprint windows already set elsewhere, useful for seeing what\'s converging on the same week.',
          },
          {
            type: 'steps',
            items: [
              { title: 'See what\'s due', detail: 'Issue due dates show as colored chips on their due day, colored by project with a priority-colored left border. Click a chip to open that issue directly.' },
              { title: 'See sprint windows', detail: 'Sprints overlapping the visible month show as a colored band above the grid, with a pulsing dot on the currently active one.' },
              { title: 'Filter to one person', detail: 'Use the assignee filter pills to see only one teammate\'s due dates — useful for a 1:1 or checking someone\'s week at a glance.' },
            ],
          },
        ],
      },
      {
        id: 'changelog',
        title: 'Changelog',
        description: 'An automatically generated, public list of what shipped',
        icon: '📰',
        roles: ['owner', 'admin', 'member', 'viewer'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The Changelog isn\'t something anyone writes — it\'s generated automatically from issues moved to Done, grouped by week and categorized by type. There\'s no manual changelog-entry tool; if something isn\'t showing up here, it\'s because the issue\'s type wasn\'t set to something that maps to a category, or it isn\'t actually Done yet.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Open the Changelog', detail: 'It groups completed issues by the week they were finished, newest first.' },
              { title: 'Understand the categories', detail: 'Feature-type issues show as "✨ New," bugs show as "🐛 Fixed," and everything else (tasks, chores, etc.) shows as "🔧 Improved" — categorization is purely based on the issue\'s type field, nothing manual.' },
            ],
          },
        ],
      },
      {
        id: 'ask-ember',
        title: 'Ask Ember',
        description: 'An in-app AI assistant that answers from your own docs and wiki — nothing else',
        icon: '✦',
        roles: ['owner', 'admin', 'member', 'viewer'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Ember is the ✦ button in the bottom-right corner of every page. It only answers from Forge\'s own product docs and your team\'s Spaces/Wiki content — never the open internet, and never another tenant\'s data. If it can\'t find something in those two places, it says so rather than guessing.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Ask a "how do I" question', detail: 'Type a question and Ember answers grounded in the Docs Hub and your team\'s wiki, citing exactly which section or page it drew from — click the citation to verify it yourself.' },
              { title: 'Use "Show me" when it\'s offered', detail: 'On a few pages, a citation includes a "▶ Show me" button that spotlights the actual UI element being described, instead of just describing it in words.' },
              { title: 'Ask it to create an issue', detail: 'While on a project\'s page, ask Ember to create an issue in plain language — it drafts the request and shows a "Create issue" button, but never creates anything until you click it yourself.' },
            ],
          },
          {
            type: 'example',
            label: '"Ember says it couldn\'t find anything, but I know it\'s documented"',
            scenario: 'Ember reports no results for a question you\'re confident is covered in the docs.',
            outcome: 'Try rephrasing with the words actually used in the docs (e.g. "sprint" not "iteration") — retrieval matches on the words present, not the underlying concept.',
          },
        ],
      },
    ],
  },
  {
    role: 'pm',
    title: 'PM Guide',
    subtitle: 'Manage projects, sprints, roadmap, and stakeholder reporting',
    color: 'purple',
    sections: [
      {
        id: 'project-setup',
        title: 'Project Setup',
        description: 'Create a project, then configure it from two different places — worth knowing which is which',
        icon: '🏗️',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A new project needs three things before a team can really use it: issue categories that match how the team triages work, priority levels wired to your SLAs, and people who can actually be assigned to it. The one wrinkle worth knowing up front is that category, priority, and status defaults are workspace-wide, configured once in Admin → Team → Fields & Labels — while categories specifically can also be bulk-imported per project from that project\'s own Categories tab. Team membership, meanwhile, is managed from Admin → Team → Projects, not from inside the project itself.',
          },
          {
            type: 'steps',
            items: [
              {
                title: 'Create the project',
                detail: 'Go to Projects in the sidebar and click New Project. Enter a name, a key — a short prefix like FORGE or WEB — and a description. The key prefixes every issue identifier in the project (e.g. FORGE-42) and cannot be changed once issues exist, so pick something short and unambiguous the first time.',
              },
              {
                title: 'Set up categories',
                detail: 'Open the project, go to its Categories tab (visible to Admins), and either bulk-import from a CSV or add categories one by one. These become the issue-type icon shown on cards and in filters.',
                tip: 'Keep categories under six. Too many options just means people guess wrong, which quietly pollutes your reports later.',
              },
              {
                title: 'Confirm priority and status defaults',
                detail: 'Priority levels (Critical/High/Medium/Low) and status columns are workspace-wide defaults, set once in Admin → Team → Fields & Labels — not a per-project setting. Renaming or reordering them affects every project in the workspace, so loop in other PMs before changing them.',
              },
              {
                title: 'Add the team',
                detail: 'This lives outside the project itself, at Admin → Team → Projects, where an Admin adds or removes members per project. Owners and Admins can already see and act on every project without being explicitly added — this step is really about which Members and Viewers can be assigned issues in this specific project.',
              },
              {
                title: 'Set up SLA policies',
                detail: 'SLA policies are workspace-wide too (Admin → Automation → SLA Policies) — rules match on priority or category across every project, not one at a time. Forge shows a live countdown on matching open issues and flags a breach in red.',
              },
            ],
          },
          {
            type: 'example',
            label: 'A member who can see a project can\'t be assigned in it',
            scenario: 'A Member reports they can\'t be assigned issues in a project they can clearly see and browse.',
            outcome: 'Being able to see a project and being added to it are different things. Have an Admin add them at Admin → Team → Projects — visibility alone doesn\'t grant assignability.',
          },
        ],
      },
      {
        id: 'sprint-management',
        title: 'Sprint Management',
        description: 'Create sprints, fill them, and track velocity over time',
        icon: '⚡',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A sprint is a time-boxed slice of work with a start and end date. Forge tracks velocity automatically once sprints are used consistently — and the value compounds over time: one sprint of data tells you nothing, but six sprints tells you whether your planning estimates are actually realistic.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Create a sprint', detail: 'In the Board tab, open Manage Sprints → New Sprint. Set a name (e.g. "Sprint 12"), a start date, and an end date. There\'s no enforced cadence — two weeks is common, but Forge doesn\'t require it.' },
              {
                title: 'Add issues to it',
                detail: 'Select issues in the Issues list and use the bulk action bar to add them to a sprint, or drag issues onto the sprint from the Backlog view on the Board.',
                tip: 'Velocity only counts issues that reach Done or Closed status while the sprint is still active. An issue closed after a sprint ends and carried into the next one doesn\'t retroactively count for the sprint it was originally planned in.',
              },
              { title: 'Start the sprint', detail: 'Click Start Sprint in Manage Sprints. This is the moment SLA countdown clocks begin on issues in the sprint, and the Board switches to showing this sprint by default for the team.' },
              { title: 'Track velocity', detail: 'Reports → Velocity shows completed work per sprint over time. Use it at planning time, not just retrospectively — a team that has under-delivered its committed scope for three sprints running is telling you something about estimation, not effort.' },
              { title: 'Complete the sprint', detail: 'Click Complete Sprint when the period ends. Forge asks what to do with anything still open — move it to the backlog or carry it into the next sprint. A quick note on why it didn\'t finish is worth more later than the decision itself.' },
            ],
          },
        ],
      },
      {
        id: 'roadmap-planning',
        title: 'Roadmap Planning',
        description: 'Visualize project timelines and milestones across the portfolio',
        icon: '🗺️',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The Roadmap is a portfolio-level timeline — think of it as answering "when is each project happening," not a sprint-by-sprint plan. It exists to answer a stakeholder\'s question ("what\'s shipping this quarter") at a glance, not to replace the Board for day-to-day work.',
          },
          {
            type: 'info',
            title: 'Dependency arcs are computed, not drawn',
            text: 'Cross-project dependency arrows are computed automatically from issue-level "blocks" links between projects — there is no manual drag-to-connect action for dependencies specifically. Dragging a bar reschedules or resizes that project\'s own timeline; it doesn\'t create a dependency.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Open the Roadmap', detail: 'Click Roadmap in the sidebar. Each project appears as a horizontal bar across a timeline.' },
              { title: 'Reposition and resize a project', detail: 'Drag a bar left or right to reschedule it, or drag its right edge to resize the planned duration. This updates the project\'s roadmap position immediately — it does not touch the sprint dates underneath it.' },
              { title: 'See a project\'s issue counts', detail: 'Click a project bar to expand a quick issue-count summary inline, without leaving the roadmap view.' },
              { title: 'Understand dependency arcs', detail: 'If any issue in Project A has a "blocks" relationship to an issue in Project B, Forge draws a dependency arc between those two projects automatically. If you need a dependency reflected here, link the underlying issues — the roadmap will pick it up.' },
            ],
          },
        ],
      },
      {
        id: 'mind-map',
        title: 'Mind Map',
        description: 'A visual, editable tree of a project\'s epics, sprints, and issues',
        icon: '🧠',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The Mind Map renders a project\'s own Idea → Project → Epic → Sprint → Issue structure as a diagram, not just a list — and unlike a static export, you can add real epics, sprints, and issues directly from its nodes. If the project was converted from a Think Tank idea, the idea itself is the root node, so the whole lineage from "why we started this" down to today\'s open tickets is visible in one view.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Open the Mind Map', detail: 'From a project\'s detail page, click the Mind Map tab. The tree lays out automatically left to right — no manual arranging needed for a readable diagram.' },
              { title: 'Add an epic, sprint, or issue from any node', detail: 'Hover a node and use its "+ Add" control to create the next level down — an Epic under the project, a Sprint under an epic, an Issue under a sprint. This writes to the same real data the Board and Sprints use; there is no separate "mind map data" to keep in sync.' },
              { title: 'Expand, collapse, and drag', detail: 'Click the ± toggle on a node to collapse its branch when the tree gets busy. Drag any node to reposition it manually — your layout is preserved across expand/collapse and new nodes, so you don\'t lose a layout arranged for a stakeholder screenshot.' },
              { title: 'Select multiple issues and bulk-move them', detail: 'Shift-click, or drag a selection box over several issue nodes (hold Shift while dragging to select rather than pan), then use the bar at the bottom to move all of them into a different sprint at once.' },
              { title: 'Present the map to a stakeholder', detail: 'Click ▶ Present in the top-right to step through every visible node in order — each click pans and zooms to the next node and dims the rest. Useful for walking someone through how a project decomposed without manually scrolling and zooming live.' },
            ],
          },
          {
            type: 'example',
            label: 'Overlapping nodes',
            scenario: 'Two nodes are overlapping and neither is readable.',
            outcome: 'Drag either node to a clear spot — the layout auto-spaces new nodes reasonably, but a busy tree can still overlap. Your manual position sticks after that.',
          },
        ],
      },
      {
        id: 'whiteboards',
        title: 'Whiteboards',
        description: 'Freeform diagramming and brainstorming canvas, separate from the Mind Map',
        icon: '🎨',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Whiteboards are unstructured — draw, add sticky notes, diagram anything — unlike the Mind Map, which is a structured Epic/Sprint/Issue tree. Reach for a Whiteboard when sketching out an idea or process that doesn\'t map cleanly to that hierarchy; use the Mind Map when actually managing the project\'s real structure.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Create a whiteboard', detail: 'From a project\'s detail page, open the Whiteboards tab and click "+ New whiteboard." Give it a name — you can rename it later by clicking the title inline once it\'s open.' },
              { title: 'Draw and diagram', detail: 'The canvas is a full drawing tool — shapes, sticky notes, freehand, text. Changes autosave a few seconds after you stop editing, so there\'s no explicit save button to remember.' },
              { title: 'Link a real issue onto the board', detail: 'Use "Link issue" to search and attach an existing issue as a badge on the canvas — clicking that badge later jumps straight to the real issue. This is the one place a Whiteboard connects back to real project data; everything else on the canvas is just drawing.' },
              { title: 'Cluster sticky notes with AI', detail: '"Cluster stickies" groups related notes together automatically after a brainstorm — a starting point to tidy up a busy board, not a final answer.' },
            ],
          },
        ],
      },
      {
        id: 'pr-risk-gates',
        title: 'PR Risk Gates',
        description: 'Review and approve AI-flagged high-risk changes before they reach Done',
        icon: '🚨',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'callout',
            variant: 'info',
            title: 'A judgment aid, not static analysis',
            text: 'PR Risk Gates reads an issue\'s title, description, and any linked PR titles — not the actual code diff or CI results. Its job is to slow down risky-looking changes long enough for a human to look at them, not to catch bugs automatically.',
          },
          {
            type: 'steps',
            items: [
              { title: 'What triggers a gate', detail: 'When a developer runs PR Impact Prediction and the result is High or Critical risk, Forge automatically opens a Risk Gate — the issue is blocked from moving to Done until a PM or Admin approves or denies it. Medium risk surfaces as a non-blocking warning.' },
              {
                title: 'Find gated issues',
                detail: 'Open Mission Control (the morning briefing page) and look for the PR Risk Overview widget. It splits into "Risk Gates — Needs Your Approval" (blocking) and "Medium Risk — Monitor" (not blocking). Click any row to jump straight to the ticket.',
                tip: 'The stat strip at the top of Mission Control shows a live gate count. If it\'s non-zero going into standup, check it before the meeting, not during.',
              },
              {
                title: 'Review a gated issue',
                detail: 'Open the issue and find the Risk Gate Review panel under AI Actions. Read the AI\'s summary, concerns, and suggestions, then Approve or Deny — a reason is required either way.',
                tip: 'A gate older than 24 hours shows a red stale indicator on the dashboard — that means a developer is blocked and waiting on you specifically.',
              },
              { title: 'Write a reason that\'s useful later', detail: 'Your reason is posted as a permanent system comment. On approval, note what you reviewed and confirmed was addressed. On denial, be specific about what needs to change — a vague denial just produces a round of back-and-forth instead of a fix.' },
              { title: 'When gates lift automatically', detail: 'If the developer re-runs the analysis and the new result drops to Medium or Low, the gate lifts on its own — no approval needed from you. A "gate lifted" system comment marks the change.' },
            ],
          },
        ],
      },
      {
        id: 'stakeholder-reporting',
        title: 'Stakeholder Reporting',
        description: 'Portfolio health at a glance, for people who don\'t need the day-to-day detail',
        icon: '📊',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The Stakeholder view exists so leadership can see project health without living in the Board. Its RAG status (Red/Amber/Green) per project is computed automatically from real signals — blocked issues, and how much of the queue is stuck in review — rather than something a PM manually sets. That\'s deliberate: a manually-set status can drift from reality; an auto-computed one can\'t lie by omission.',
          },
          { type: 'heading', level: 2, text: 'What drives the color' },
          {
            type: 'table',
            headers: ['Status', 'Trigger'],
            rows: [
              ['Red — Blocked', 'Any issue in the project has status "blocked" — needs immediate attention.'],
              ['Amber — At Risk', 'More than 40% of open issues are stuck in review — throughput may be stalling.'],
              ['Green — On Track', 'Neither of the above.'],
            ],
          },
          {
            type: 'paragraph',
            text: 'There is no manual override. If a project shows Red and you disagree, the fix is to resolve the blocked issues or work down the review backlog — not to recolor the dot.',
          },
          { type: 'heading', level: 2, text: 'Exporting for sharing' },
          {
            type: 'paragraph',
            text: 'Click Export PDF in the header. It\'s formatted for dropping into Slack or email as-is. There\'s no separate CSV export from this view specifically — a general CSV data export exists workspace-wide under Admin → AI & Data → Export Data, but that\'s a different, broader export, not a stakeholder-formatted one.',
          },
          {
            type: 'example',
            label: '"This looks Red but we\'re actually fine"',
            scenario: 'A project shows Red but the team feels like it\'s actually in good shape.',
            outcome: 'Check for any issue with status "blocked" — a single stale blocked ticket that should have been resolved or unblocked will flip the whole project Red. Clean that up rather than looking for a way to override the color.',
          },
        ],
      },
      {
        id: 'time-reports',
        title: 'Time Reports',
        description: 'Where logged time rolls up across your team and projects',
        icon: '⏱️',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Every hour logged on an issue, or from a personal timesheet, feeds this same reporting view — there\'s nothing separate to configure. Use it to see where time is actually going, not just where it was estimated to go, and to pull billable-hours data for client invoicing if you track that.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Pick your time window', detail: 'Reports → Time. Choose Sprint, This Week, This Month, or a Custom date range. Sprint mode lets you pick any sprint, not just the active one, so you can go back and see how a past sprint\'s time actually broke down.' },
              { title: 'By User', detail: 'A bar per team member, sized by total hours, with a "% billable" figure. Click a name to expand their per-project breakdown, or "View logs" to filter the detail table below to just their entries.' },
              { title: 'By Project', detail: 'The same bar-chart idea, one bar per project instead of per person — useful for a quick "which project ate this week" check without cross-referencing By User yourself.' },
              { title: 'By Sprint', detail: 'A table of sprint / project / date range / total hours / top contributor — the fastest way to see whether time logged roughly matched what a sprint was supposed to cost, across sprints, without opening each one individually.' },
              { title: 'Export as CSV', detail: 'Each tab has its own "↓ CSV" export scoped to what you\'re currently viewing (summary by user, summary by project, the sprint rollup table, or the full log detail with date/member/issue/project/minutes/billable/tag/note). Export the log detail view when you need the raw entries, not just the rollup.' },
            ],
          },
        ],
      },
      {
        id: 'reports-hub',
        title: 'Reports Hub',
        description: 'Burndown, Cycle Time, Issue Aging, Sprint Retro, Capacity, and a custom builder',
        icon: '📊',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Beyond the Velocity chart, Reports has a full set of purpose-built views plus a Custom Builder for anything they don\'t cover.',
          },
          {
            type: 'info',
            title: 'Some views are Premium-gated',
            text: 'Cycle Time, Issue Aging, and Scheduled Reports are marked "pro" — gated to the Premium plan tier, not something a workspace setting turns on separately.',
          },
          { type: 'heading', level: 2, text: 'Sprint-focused reports' },
          {
            type: 'paragraph',
            text: 'Burndown shows ideal vs. actual remaining points per day, with an on-track/behind indicator. Overcommitment shows who\'s over their weekly capacity across active sprints, not just the current one. Estimate Accuracy shows how close estimates land to actual logged time, with a plain-language auto-generated insight sentence.',
          },
          { type: 'heading', level: 2, text: 'AI Sprint Retro' },
          {
            type: 'paragraph',
            text: 'Pick a completed sprint and click "Generate AI Summary" — Grok reviews what shipped, what slipped and why, and three focus items for next sprint, based on the sprint\'s actual issues and time logs. The summary is saved on the sprint and shows a "Generated {date}" stamp until you regenerate it.',
          },
          { type: 'heading', level: 2, text: 'Capacity' },
          {
            type: 'paragraph',
            text: 'A gauge of overall committed hours vs. team capacity for the active sprint, plus a per-member breakdown — the fastest sanity check before locking sprint scope at planning.',
          },
          { type: 'heading', level: 2, text: 'Cycle Time & Issue Aging (Premium)' },
          {
            type: 'paragraph',
            text: 'Cycle Time shows how long issues actually take to close, broken down by priority, type, and assignee. Issue Aging flags what\'s gone stale in the backlog (90+ days open). Both require the Premium plan tier — unrelated to the Board\'s own "🔥 Aging" toggle, which is just a visual cue on cards, not this report.',
          },
          { type: 'heading', level: 2, text: 'Custom Builder' },
          {
            type: 'paragraph',
            text: 'Build a report by picking a Group By (status, priority, type, assignee, label, sprint, project, phase, or environment), a metric (issue count, story points, or time logged), and a date range. Save configurations for reuse, and export as CSV, Excel, or PDF.',
          },
          { type: 'heading', level: 2, text: 'Scheduled Reports (Premium)' },
          {
            type: 'paragraph',
            text: 'Set a report to email itself to a recipient list on a daily, weekly, biweekly, or monthly cadence, delivered as a PDF at 8am on the scheduled day. Only Admins can create or pause a schedule; anyone can view existing ones.',
          },
        ],
      },
      {
        id: 'okrs',
        title: 'OKRs',
        description: 'Objectives and key results, with AI-scored alignment from Think Tank ideas',
        icon: '🎯',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'An OKR here is a title (the Objective) plus a free-text notes field for key results — there\'s no separate structured KR sub-record, just one text box where you\'d typically write "KR1: ..., KR2: ...". The real value is linking ideas to OKRs and letting AI score how well they actually align.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Create an objective', detail: 'Admin → Products → OKRs → "+ Add OKR." Set the objective title, key-results notes, quarter, status (draft/active/achieved/missed), and a progress percentage.' },
              { title: 'Link an idea to an OKR', detail: 'From an idea\'s detail page in Think Tank, use "+ Link OKR" to attach it to any active objective.' },
              { title: 'Score the alignment', detail: '"AI Score" (or "Re-score" once scored) asks Grok to rate 1-5 how well the idea actually supports that objective, with a short justification — a sanity check against ideas that sound aligned but aren\'t really moving the objective.' },
            ],
          },
        ],
      },
      {
        id: 'customers',
        title: 'Customers',
        description: 'A lightweight CRM for tracking accounts and tying them to issues',
        icon: '🏢',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'This is intentionally minimal — company name, domain, tier, ARR, and notes, not a full CRM. Its real value is linking issues to the customer account affected, so you can see which issues matter to which accounts.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Add a customer', detail: 'Customers → "+ Add customer" (Admin/Owner only). Set company name, domain, tier (Enterprise/Mid-Market/SMB/Startup/Free), and ARR.' },
              { title: 'Link an issue to a customer', detail: 'From an issue, link it to the affected customer account — useful for seeing which open issues are tied to your highest-ARR accounts at a glance.' },
            ],
          },
          {
            type: 'example',
            label: 'A Member can view but not edit customers',
            scenario: 'A Member can see the customer list but can\'t add or edit a record.',
            outcome: 'Adding, editing, and deleting customer records is Admin/Owner-only by design — Members and Viewers get read-only access to the list.',
          },
        ],
      },
      {
        id: 'workload-capacity',
        title: 'Workload & Capacity',
        description: 'Two different views — forward-looking planning vs. this-week snapshot',
        icon: '📈',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'callout',
            variant: 'info',
            title: 'Two views, two questions',
            text: 'The personal/team heatmap (Workload in the sidebar) is a forward-looking, multi-week view based on issue due dates and estimates — a planning tool. The admin capacity view (Admin → Team → Workload) is a current-sprint snapshot of logged vs. estimated vs. available hours per person — a management tool. Don\'t confuse one for the other.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Use the heatmap to plan ahead', detail: 'The Workload heatmap shows 16 weeks at a glance, color-coded by how loaded each person is that week based on their assigned issues\' estimates and due dates. Click any cell to see exactly which issues are contributing to that week\'s load.' },
              { title: 'Use Admin Workload to check right now', detail: 'Admin → Team → Workload shows this week/this sprint: available capacity, hours logged, and hours estimated in the active sprint, per person — flagging anyone at or over capacity.' },
              { title: 'Export or drill into one person', detail: 'From the admin view, click a member\'s card for a capacity breakdown and a direct link to their issues on the board, or use "Export Report" / "Export Team Report" for a printable summary.' },
            ],
          },
        ],
      },
    ],
  },
  {
    role: 'contributor',
    title: 'Developer Guide',
    subtitle: 'Pick up work, contribute ideas, and collaborate effectively in Forge',
    color: 'green',
    sections: [
      {
        id: 'developer-workflow',
        title: 'Developer Workflow',
        description: 'Pick up issues, report progress, block on dependencies, and close work',
        icon: '💻',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'This is the loop most of a developer\'s day runs on: pick up work, keep it visible, unblock or get unblocked, close it out. None of these steps are enforced by the system — Forge won\'t stop you from silently working an issue without updating it — but a team that skips comments and blocked-relations consistently ends up needing status meetings to recover the visibility this loop gives you for free.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Pick up an issue', detail: 'In the Board tab, filter by your name using By Assignee. Find an Open issue and drag it to In Progress, or open the issue and change status via the status dropdown. This signals to the team you are actively working on it.' },
              {
                title: 'Update progress with comments',
                detail: 'Post a comment on your In Progress issues with what you did, what is next, and any blockers. Daily updates are lightweight but give PMs visibility without needing a status meeting.',
                tip: 'Paste your branch name or PR link in the issue\'s Link field as soon as you create the branch. Future team members can find the commit history through the issue.',
              },
              { title: 'Block an issue', detail: 'If your issue is waiting on another team\'s work, open the issue and add an "is blocked by" relation pointing to the blocking issue. Change status to Blocked. PMs see blocked issues in the Reports view and can intervene.' },
              { title: 'Move to In Review', detail: 'When your code is ready for review, move the issue to In Review and @mention your reviewer in a comment. Paste the PR URL in the Link field. The reviewer gets an Inbox notification.' },
              { title: 'Close the issue', detail: 'Once the PR is merged and deployed, move the issue to Done. Add a brief resolution comment — what was changed and where. This feeds the velocity report and helps with post-mortems.' },
            ],
          },
          {
            type: 'example',
            label: 'A blocked issue nobody notices',
            scenario: 'An issue has been marked Blocked for days but nobody seems to have picked up on it.',
            outcome: 'Blocked status alone is passive — pair it with a comment @mentioning whoever owns the blocking work, or your PM, so it surfaces as a notification rather than something someone has to go looking for.',
          },
        ],
      },
      {
        id: 'think-tank',
        title: 'Think Tank',
        description: 'Submit ideas, vote, and link approved ideas to project issues',
        icon: '💡',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Think Tank exists for ideas that aren\'t issues yet — a problem worth solving or a feature worth building, before anyone commits real sprint time to it. Writing it up here first, rather than pitching it verbally in standup, means it doesn\'t get lost, and it gives other people a chance to vote or add context before a PM has to make a call.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Submit an idea', detail: 'Open Think Tank in the sidebar. Click New Idea. Write a title, description, and optionally link it to an existing project. Ideas are visible to all workspace members — write clearly so others understand the problem you are solving.' },
              {
                title: 'Vote on ideas',
                detail: 'Browse the idea list and click the thumbs-up on ideas you support. Upvotes surface ideas in the Trending sort. You have unlimited votes but cannot vote on your own ideas.',
                tip: 'Vote on ideas outside your own area — cross-functional upvotes surface ideas with the broadest impact to PMs.',
              },
              { title: 'Comment and refine', detail: 'Add technical notes, edge cases, or alternative approaches in the idea\'s comments. Good discussion here shapes the idea before it becomes an issue and saves time in sprint planning.' },
              { title: 'Track approved ideas', detail: 'When a PM approves an idea, they click Link to Issue. As the submitter you receive an Inbox notification and can follow the implementation by watching the linked issue.' },
            ],
          },
        ],
      },
      {
        id: 'idea-canvas',
        title: 'Idea Canvas',
        description: 'A freeform brainstorm board for one idea, with AI critique built in',
        icon: '✨',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Before an idea has any real structure, the Canvas gives you a blank corkboard to work out Problems, Features, Risks, and Questions as loose cards — not the strict Epic/Sprint/Issue tree the Mind Map uses once there\'s a real project. Any non-viewer can edit it, since it\'s meant as shared scratch space, not the idea\'s official record — title and description editing stays creator/admin-only.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Open the Canvas', detail: 'From an idea\'s detail page, click the ✨ Canvas button next to Export.' },
              { title: 'Add cards and connect them', detail: 'Use the "Add a thought" panel to drop Problem/Feature/Risk/Question cards anywhere on the board. Drag from a card\'s edge to connect it to another if the relationship matters.' },
              { title: 'Test the shape with AI', detail: 'Click "Test with AI" to send everything currently on the canvas to Grok for a critique — feasibility, gaps, and what a first sprint should scope in or defer. The response comes back as new dashed "AI suggestion" cards you can add to the board, not just chat text that disappears.' },
              { title: 'Convert when it\'s ready', detail: 'The canvas doesn\'t auto-convert itself — use the idea\'s normal Convert flow once you\'re happy with the shape. The canvas stays attached to the idea afterward as historical context.' },
            ],
          },
        ],
      },
      {
        id: 'ai-idea-tools',
        title: 'AI-Powered Idea Tools',
        description: 'Sounding Board chat, consensus synthesis, AI-drafted PRDs, and a devil\'s advocate critique',
        icon: '🤖',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'An idea in Think Tank has several distinct AI tools, not one combined "AI button" — each does something different and lives in its own card on the idea\'s detail page. All of them are Grok-backed, all show a disclosure before first use, and all are blocked for Viewers.',
          },
          { type: 'heading', level: 2, text: 'Sounding Board — a conversation, not a one-shot answer' },
          {
            type: 'paragraph',
            text: 'Pick a lens — Devil\'s Advocate, Market Fit, Technical Feasibility, Risk Assessment, User Impact, Prioritization, Competitive Landscape, Next Steps (multi-select) — optionally add your own text, and click "Ask AI." It\'s rate-limited to 20 calls per tenant per hour, shown right in the header so you know how much room is left.',
          },
          { type: 'heading', level: 2, text: 'Consensus Builder' },
          {
            type: 'paragraph',
            text: 'Once an idea has at least 3 comments, "Build consensus" summarizes the discussion into what people agree on, what\'s still unresolved, and a recommended next step — useful before a decision meeting instead of re-reading every comment yourself.',
          },
          { type: 'heading', level: 2, text: 'Draft PRD' },
          {
            type: 'paragraph',
            text: '"Draft PRD ✨" generates Problem Statement, Goals, Success Metrics, User Stories, In/Out of Scope, Technical Notes, Open Questions, and Risks. "Copy as Markdown" gets it into whatever document tool you actually write in.',
          },
          { type: 'heading', level: 2, text: 'Devil\'s Advocate' },
          {
            type: 'paragraph',
            text: '"🔥 Challenge This Idea" runs the same Devil\'s Advocate lens as the Sounding Board, but as a one-click shortcut with no need to type anything — and it\'s repeatable, not one-time, so you can re-run it after the idea changes.',
          },
          { type: 'heading', level: 2, text: 'Impact/Effort Matrix' },
          {
            type: 'paragraph',
            text: 'On the Think Tank listing page, click any idea chip to score its Impact (1-5) and Effort (1-5) — it drops into one of four quadrants (Quick Wins, Big Bets, Fill-ins, Money Pits) automatically. Useful for a prioritization conversation across many ideas at once, not just one.',
          },
          { type: 'heading', level: 2, text: 'Import ideas from a competitor\'s page' },
          {
            type: 'paragraph',
            text: 'Paste a competitor\'s feature page, changelog, or product copy into "📥 Import from competitor" and AI extracts a list of candidate ideas — review the checkboxes, then import the ones actually worth adding as real ideas.',
          },
          {
            type: 'warning',
            title: 'Sounding Board rate limit',
            text: 'The 20-calls-per-hour limit is shared across everyone in the tenant using it, not per-person. If it\'s hit, wait for the hour to roll over, or coordinate with the team about spacing out AI-heavy sessions.',
          },
        ],
      },
      {
        id: 'using-the-board',
        title: 'Using the Board',
        description: 'Views, filters, and quick-create patterns for developers',
        icon: '🗂️',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The Board is where most of a developer\'s day actually happens, so the difference between fumbling through it and using it well is mostly knowing these few shortcuts exist. Grouping by assignee instead of status is the single biggest one — it turns the board into a standup tool instead of just a status tracker.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Switch to By Assignee view', detail: 'Click the View dropdown in the Board header and select By Assignee. Swimlanes appear for each person — useful in standups to see who is overloaded at a glance without a separate report.' },
              { title: 'Filter by sprint', detail: 'Use the Sprint dropdown above the board to switch between active, past, or upcoming sprints. Past sprint boards are read-only — useful for referencing what was shipped in a given sprint.' },
              {
                title: 'Create an issue from the board',
                detail: 'Click + at the top of any column. The quick-create form opens inline — fill in title, type, and priority and press Enter. The issue is added to the active sprint in that column\'s status.',
                tip: 'The By Assignee view with no filters is the fastest way to run a daily standup — each lane is one person\'s update.',
              },
              { title: 'Use labels for cross-cutting concerns', detail: 'Apply labels like "frontend", "backend", "needs-design" from the issue card\'s label dropdown. Labels are filterable across all views and appear in the Issues export — useful for tracking tech debt or design debt across sprints.' },
            ],
          },
        ],
      },
      {
        id: 'pr-risk-overview-developer',
        title: 'PR Risk Overview — What PMs See',
        description: 'Understand the risk dashboard your PM watches so there are no surprises',
        icon: '📊',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Your PM isn\'t guessing about your blocked or risky work — they have a live dashboard showing exactly what\'s gated and how long it\'s been waiting. Knowing what they see should change how you communicate: don\'t wait to be asked about a gate, since they already know it exists the moment it opens.',
          },
          {
            type: 'tip',
            text: 'Do not wait for a PM to come to you. If your issue gets gated, comment on it immediately to explain what you are doing to address it. They can already see the gate; they want to see you acting on it.',
          },
          {
            type: 'steps',
            items: [
              { title: 'The PM has a live risk dashboard', detail: 'On Mission Control (the PM morning briefing), a PR Risk Overview widget shows every open risk gate and every medium-risk issue across the tenant — blocked issues, how long they\'ve been waiting, and which ones are overdue, in real time, without you telling them.' },
              { title: 'What shows up as gated', detail: 'Any issue where PR Impact returned High or Critical risk appears in the "Risk Gates — Needs Your Approval" section of the PM dashboard. Your name isn\'t shown, but the issue number and title are — the PM can click straight through to the ticket and the full AI analysis.' },
              { title: 'What shows up as medium risk', detail: 'Issues where PR Impact returned Medium risk appear in the "Medium Risk — Monitor" section. These aren\'t blocked — the PM is just watching them. Close cleanly or re-run the analysis after fixing concerns to clear the badge.' },
              { title: 'The 24-hour stale timer', detail: 'If a High or Critical gate sits open for more than 24 hours without PM review, a red ⏰ stale indicator appears on the dashboard — a signal to the PM that someone is waiting. Use it to your advantage: nudge your PM directly and reference the ticket number if your gate goes stale.' },
              { title: 'Everything is in the audit trail', detail: 'Every PR Impact action — prediction run, gate opened, PM decision, your comments — is logged as a system comment on the ticket. If anyone asks why something was merged or what happened with a risky change, the full history is right there.' },
            ],
          },
        ],
      },
      {
        id: 'pr-impact-developer',
        title: 'PR Impact Prediction',
        description: 'Run AI risk analysis before merging and respond to risk gates on your issues',
        icon: '🔬',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'PR Impact Prediction reads an issue\'s title, description, type, and priority — not the actual diff or CI output — so treat the result as an early warning to think harder about a change, not a verdict on whether it\'s safe. Running it before moving to In Review costs thirty seconds and can save an awkward conversation later.',
          },
          {
            type: 'steps',
            items: [
              {
                title: 'Run an analysis',
                detail: 'Open any issue. In the right sidebar under AI Actions, click the PR Impact Prediction button. The AI analyzes the issue title, description, type, and priority, then returns a risk level (Low, Medium, High, or Critical) along with a scope summary, concerns, and suggested actions.',
                tip: 'Run PR Impact before moving an issue to In Review — it gives your reviewer and PM early warning if the change is riskier than it looks.',
              },
              { title: 'Understand the four risk levels', detail: 'Low: narrow scope, safe to merge with normal review. Medium: moderate complexity — review the listed concerns before merge, no gate opened. High: significant risk to stability, performance, or security — a gate opens and the issue is blocked until a PM or Admin approves. Critical: severe risk (data loss, security vulnerability, or production outage risk) — same gate workflow as High but higher urgency.' },
              {
                title: 'Address a High or Critical gate',
                detail: 'When High or Critical risk is detected, a Risk Gate opens on the issue: an orange or red badge and a system comment explaining the block, and the issue can\'t move to Done until a PM or Admin approves it. Review the listed concerns, optionally use "Create action items as sub-issues," then address the concerns and notify the PM.',
                tip: 'Re-run the analysis after fixing the concerns. If the risk drops to Medium or Low, the gate lifts automatically and no PM approval is needed.',
              },
              { title: 'Create action items from suggestions', detail: 'Inside the PR Impact modal, click "Create action items as sub-issues." Forge converts each AI suggestion into a linked sub-issue on the current ticket — assign, track, and resolve them before asking the PM to review the gate.' },
              { title: 'Re-run after fixes', detail: 'Click Re-analyse at any time. Each run creates a new system comment with the updated result and updates the badge on the ticket. If the new result is Medium or Low on a previously gated issue, the gate lifts automatically — no manual PM step needed.' },
            ],
          },
        ],
      },
      {
        id: 'ai-actions-on-issue',
        title: 'AI Actions on an Issue',
        description: 'Triage suggestions, an embedded spec/PRD, and formal sign-offs',
        icon: '📋',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Beyond PR Impact (its own section) and Decompose (covered under PR Overview & Blockers), an issue has a couple more AI and process tools worth knowing about: an AI-suggested triage you can accept or dismiss, and an embedded mini-spec you write yourself.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Run Triage for a suggested priority and category', detail: '"Triage Issue" reads the title/description and suggests a Priority, Category, a reasoning paragraph, and any likely duplicates it spotted, with a one-click "Mark dup" per candidate. "Accept" applies the suggestion and logs it as an activity comment; "Dismiss" just hides the card.' },
              { title: 'Write a spec or mini-PRD directly on the issue', detail: 'The Spec / PRD card is a plain Markdown editor — write acceptance criteria or requirements right where the work is being tracked, instead of a separate document that goes stale. Viewers see it read-only.' },
              { title: 'Request sign-offs before calling it done', detail: 'Admins add named approval roles (e.g. "Design," "Engineering," "Product" — whatever your team needs, not a fixed list) via "+ Add role." Each role gets Approved/Revoke controls, and the card shows "✓ All approved" once every role has signed.' },
            ],
          },
        ],
      },
      {
        id: 'pr-overview-blockers',
        title: 'PR Overview & Blockers',
        description: 'Linked PRs/commits, blocking relationships, sub-issues, and duplicate merging',
        icon: '🔗',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'An issue accumulates real relationships beyond its own status: PRs and commits attached automatically from GitHub, other issues it blocks or is blocked by, sub-issues under it, and duplicates merged into it. These live in a few different cards on the issue detail page rather than one combined panel — worth knowing so you look in the right place.',
          },
          { type: 'heading', level: 2, text: 'PRs and commits are automatic' },
          {
            type: 'paragraph',
            text: 'The Git card shows Pull Requests and Commits in separate sections, each with a status badge (Merged/Open/Closed for PRs) and an AI-generated summary line where available. These populate entirely from your GitHub webhook — there is no button to manually attach a PR or commit to an issue. If nothing shows up here, check your GitHub integration setup rather than looking for a manual-link option.',
          },
          { type: 'heading', level: 2, text: 'Linking a blocking or duplicate relationship' },
          {
            type: 'paragraph',
            text: 'In the Linked Issues card, click "+ Link issue," choose Duplicate or Blocks, then search by title or key. There is no third manual option in this picker — "relates to" links can only appear if created elsewhere, not chosen here.',
          },
          { type: 'heading', level: 2, text: 'The 🚫 Blocked badge' },
          {
            type: 'paragraph',
            text: 'This badge is computed live from open "Blocks" links, not a status you set — it appears automatically when any linked blocker isn\'t done yet, and disappears automatically once all blockers are resolved. The issue\'s own status field is untouched either way; you still change status yourself when the work is actually done.',
          },
          {
            type: 'tip',
            text: 'A red border on the Linked Issues card is the same signal as the badge — either one means something upstream needs to close first.',
          },
          { type: 'heading', level: 2, text: 'Sub-issues vs. links' },
          {
            type: 'paragraph',
            text: 'The Sub-issues card is parent/child, not "blocks" — use "+ New" to create a fresh sub-issue under this one, or "Link existing" to attach an issue that already exists. Removing a sub-issue just detaches it, setting its parent back to none; it does not delete the issue.',
          },
          { type: 'heading', level: 2, text: 'Merging a duplicate' },
          {
            type: 'paragraph',
            text: '"🔁 Mark as duplicate of…" searches for the original, then — after you confirm — merges the duplicate\'s top-level comments and watchers into the original and closes the duplicate automatically. This is one-way and immediate once confirmed, so make sure you\'ve got the right original before confirming.',
          },
          { type: 'heading', level: 2, text: 'AI Decompose' },
          {
            type: 'paragraph',
            text: 'The Decompose button asks Grok to break the issue into 3-6 draft sub-tasks, which you review and select before creating — accepted drafts become real sub-issues using the exact same parent/child mechanism as "+ New" above, not a separate AI-only structure.',
          },
          {
            type: 'example',
            label: 'Blocked badge won\'t clear',
            scenario: 'A blocking issue was completed but the 🚫 Blocked badge is still showing.',
            outcome: 'This badge is derived on page load, not cached — refresh the issue. If it still shows after refresh, confirm the blocking issue\'s status is actually "done," not just "in review."',
          },
          {
            type: 'example',
            label: 'Missing Roadmap dependency arc',
            scenario: 'Cross-project dependencies aren\'t showing up on the Roadmap even though the issues are clearly related.',
            outcome: 'Roadmap arcs only come from issue-level "Blocks" links between issues in two different projects — a same-project block, or a "Duplicate"/sub-issue relationship, never produces a roadmap arc, by design.',
          },
        ],
      },
      {
        id: 'comments-decisions',
        title: 'Comments & Decisions',
        description: 'Structured async collaboration with decisions, @mentions, and reactions',
        icon: '💬',
        roles: ['owner', 'admin', 'member'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Most team communication should happen on the issue it\'s about, not in a separate chat thread that a new hire can\'t find six months later. Decisions specifically are worth flagging deliberately — a decision buried in a normal comment gets lost the moment the thread scrolls past it.',
          },
          {
            type: 'steps',
            items: [
              { title: 'Add a comment', detail: 'Open any issue and type in the Comments box at the bottom. Markdown is supported: **bold**, *italic*, `inline code`, and fenced code blocks for snippets. Press Cmd+Enter to submit.' },
              {
                title: 'Mark a decision',
                detail: 'After a key decision is made in comments (e.g. "We will use Redis not Memcached"), click the decision flag icon on that comment. Decisions appear in the Decisions tab of the issue for future reference.',
                tip: 'Mark decisions consistently — they are especially useful during post-mortems and when onboarding new team members to a project.',
              },
              { title: 'Use @mentions', detail: 'Type @ followed by a teammate\'s name to notify them. They receive an Inbox notification with the issue context. You can @mention anyone in the workspace, not just current issue assignees or watchers.' },
              { title: 'React to comments', detail: 'Hover a comment and click the emoji button to add a reaction. Common conventions: 👍 = agreed, 👀 = reviewing, ✅ = done. Reactions keep threads from getting clogged with short acknowledgment replies.' },
            ],
          },
        ],
      },
    ],
  },
  {
    role: 'admin',
    title: 'Admin Guide',
    subtitle: 'Configure your workspace, manage access, and keep operations running smoothly',
    color: 'red',
    sections: [
      {
        id: 'workspace-setup',
        title: 'Team & Workspace Setup',
        description: 'Invite members, assign roles, and standardize how issues are tracked',
        icon: '⚙️',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Workspace setup is the first thing to get right in a new Forge tenant, because two decisions made here are expensive to unwind later: who is in the workspace, and what they are allowed to do. A workspace that starts too permissive — everyone an Admin — tends to accumulate accidental configuration changes that nobody remembers making. One that starts too restrictive — everyone a Viewer — creates a steady stream of "can you give me access to X" requests in the first week. Neither failure is fatal, but both cost time you don\'t need to spend if roles are set deliberately from the start.',
          },
          {
            type: 'info',
            title: 'No workspace branding step',
            text: 'Forge does not currently support a custom logo or company name display. Your workspace is identified everywhere — the sidebar, emails, exports — by its URL slug. If your organization needs custom branding in outbound communication, treat that as a support request rather than something to look for in Settings.',
          },
          { type: 'heading', level: 2, text: 'Inviting members' },
          {
            type: 'paragraph',
            text: 'Go to Admin → Team → Members and click Invite. You can enter one or more email addresses at once and assign them a default role immediately. Choosing the right default matters more than it looks: Member for anyone doing the actual work (creating issues, commenting, using the board), Viewer for stakeholders and external clients who only need to watch progress, and Admin for anyone who should be able to manage settings and other members. You can change any member\'s role after the fact, so this default is a starting point, not a permanent commitment — but it\'s still worth getting close to right, since a batch of Viewer invites is faster to send than fixing forty individual roles a week later.',
          },
          {
            type: 'tip',
            text: 'Send one invite batch per role rather than inviting everyone identically and correcting roles afterward. If you\'re inviting five engineers and two stakeholders, that\'s two separate invite actions — not one batch of seven followed by individual edits.',
          },
          { type: 'heading', level: 2, text: 'What each role can do' },
          {
            type: 'field-list',
            items: [
              { field: 'Owner', description: 'Full control of the workspace, including billing and the ability to remove other Owners or Admins. Every workspace needs at least one; see the warning below about keeping two.' },
              { field: 'Admin', description: 'Manages members, every Admin settings page, and every project in the workspace — but cannot touch billing plan changes or remove an Owner.' },
              { field: 'Member', description: 'Creates and edits issues, comments, and uses the board — scoped to the projects they belong to. This is the default role for anyone doing hands-on work.' },
              { field: 'Viewer', description: 'Read-only everywhere in the workspace. Cannot create, edit, or comment on anything. The right default for stakeholders, clients, or auditors.' },
            ],
          },
          {
            type: 'paragraph',
            text: 'If your workspace has Custom Roles enabled (see Features & Plan below), you can define narrower roles than these four — for example, a role that can approve sign-offs but not manage billing. Most workspaces never need this and should start with the fixed four; only reach for Custom Roles once you hit a real, specific wall with them.',
          },
          { type: 'heading', level: 2, text: 'Changing a role' },
          {
            type: 'steps',
            items: [
              { title: 'Open Admin → Team → Members', detail: 'Find the member whose role you need to change in the list.' },
              { title: 'Use the Role dropdown next to their name', detail: 'Selecting a new role applies it immediately — there is no separate save step, and no re-login is required on the member\'s side.' },
              { title: 'Confirm the change if demoting an Admin', detail: 'Demoting an Admin to Member instantly removes their access to every Admin settings page. Check that they aren\'t mid-way through a configuration change before you do this — there is no undo.' },
            ],
          },
          { type: 'heading', level: 2, text: 'Custom fields' },
          {
            type: 'paragraph',
            text: 'Admin → Team → Fields & Labels lets you add fields that appear on every issue across every project — text, number, date, single-select, or multi-select. These are workspace-wide, not per-project, so they work best for things every team needs to track (a "Customer Impact" select, for instance) rather than one project\'s special case. A project-specific field belongs in that project\'s own configuration, not here.',
          },
          {
            type: 'warning',
            title: 'Keep at least two Owners',
            text: 'Only an Owner can promote someone back to Admin, and only an Owner can act on billing. If the sole Owner in a workspace becomes unreachable, no one else can restore Admin access or change the plan — there is no support-side override for this today. Add a second Owner as soon as the workspace has more than one long-term stakeholder.',
          },
          {
            type: 'example',
            label: 'Invite email never arrived',
            scenario: 'A newly invited member says they never received the invite email.',
            outcome: 'Check spam first — invite emails are the most commonly filtered transactional email type. If it\'s genuinely missing, re-invite the same address from Admin → Team → Members; a second invite simply replaces the pending one rather than sending a duplicate.',
          },
        ],
      },
      {
        id: 'roles-permissions',
        title: 'Roles & Permissions',
        description: 'The four system roles, and how Custom Roles extend them',
        icon: '🛡',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Forge ships with four fixed roles — Owner, Admin, Member, Viewer — that cover the large majority of teams without any extra configuration. They are deliberately simple: rather than a sprawling permission matrix you have to reason about for every feature, each role is a coherent bundle that maps to a real job function (someone who runs the business, someone who runs the workspace, someone who does the work, someone who watches the work). When a team genuinely needs something in between, Custom Roles exists for exactly that case — but it is an escape hatch, not the default path.',
          },
          { type: 'heading', level: 2, text: 'The four system roles' },
          {
            type: 'table',
            headers: ['Role', 'Can do', 'Cannot do'],
            rows: [
              ['Owner', 'Everything — billing, plan changes, removing anyone including other Admins.', 'Nothing is restricted.'],
              ['Admin', 'Manage members, every Admin settings page, all projects.', 'Change the billing plan, remove an Owner.'],
              ['Member', 'Create/edit issues, comment, use the board — scoped to their projects.', 'Anything under Admin, or act on projects they are not a member of.'],
              ['Viewer', 'Read everything they have project access to.', 'Create, edit, or comment anywhere.'],
            ],
          },
          {
            type: 'paragraph',
            text: 'These are set per member in Admin → Team → Members, and a role change takes effect immediately — there is no propagation delay and no re-login required on the affected member\'s side.',
          },
          { type: 'heading', level: 2, text: 'When to reach for Custom Roles' },
          {
            type: 'paragraph',
            text: 'Enable Custom Roles when a real person on your team needs some Admin-level permission but not others — the canonical example is a QA lead who should be able to approve sign-offs but has no business touching billing or member management. Turn the feature on in Admin → Subscription → Features & Plan, then build the actual role in Admin → Team → Roles.',
          },
          {
            type: 'callout',
            variant: 'success',
            title: 'Custom roles are additive',
            text: 'Enabling Custom Roles never removes anything the four base roles already grant — it only adds new, narrower role definitions alongside them. That makes it safe to turn on and experiment with; you are not reconfiguring existing members\' access by flipping this flag.',
          },
          { type: 'heading', level: 2, text: 'Recommended pairings for common titles' },
          {
            type: 'list',
            items: [
              'Developers and QA → Member',
              'Product Managers → Member, or Admin if they also manage workspace-wide settings rather than just their own projects',
              'Stakeholders and external clients → Viewer',
              'A role that needs to approve but not configure (e.g. sign-off authority without settings access) → this is exactly the case Custom Roles solves',
            ],
          },
          {
            type: 'tip',
            text: 'Keep at least two Owners in the workspace at all times. If the sole Owner becomes unreachable, no remaining member — including Admins — can restore Owner-level access.',
          },
        ],
      },
      {
        id: 'feature-flags',
        title: 'Features & Plan',
        description: 'Turn optional product areas on or off for the whole workspace',
        icon: '🚩',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Not every workspace needs every feature Forge offers. A five-person team doesn\'t need timesheet approval workflows; a team that isn\'t doing SSO doesn\'t need that entry cluttering Settings. Feature flags exist so each workspace shows only what it actually uses, rather than every admin having to mentally filter out irrelevant nav items on every visit.',
          },
          {
            type: 'paragraph',
            text: 'Go to Admin → Subscription → Features & Plan to see every toggleable feature with a short description of what it does. Flipping a toggle takes effect immediately for every member in the workspace — there\'s no rollout delay, though a member may need to refresh their browser tab to see a newly-added sidebar entry.',
          },
          { type: 'heading', level: 2, text: 'What is toggleable today' },
          {
            type: 'feature-grid',
            columns: 3,
            items: [
              { icon: '💡', name: 'Think Tank', desc: 'Idea capture and voting' },
              { icon: '🗺️', name: 'Visual Roadmap', desc: 'Timeline-based planning view' },
              { icon: '🌅', name: 'Mission Control', desc: 'Cross-project analytics + Morning Briefing' },
              { icon: '🛡', name: 'Custom Roles', desc: 'RBAC beyond the four base roles' },
              { icon: '🔐', name: 'SSO/SAML', desc: 'Identity-provider login' },
              { icon: '🔌', name: 'Webhooks & Integrations', desc: 'GitHub, chat, outbound webhooks' },
              { icon: '📊', name: 'Advanced Reports', desc: 'Custom report builder + scheduling' },
              { icon: '📤', name: 'PDF/Excel Exports', desc: 'Non-CSV export formats' },
              { icon: '🧠', name: 'AI Sprint Intelligence', desc: 'Sprint-level AI insight surfaces' },
              { icon: '✨', name: 'Advanced AI', desc: 'Deeper AI features across the product' },
              { icon: '⏱️', name: 'My Time', desc: 'Personal timesheets, and its Premium tier (approvals, time-off, billing rates)' },
              { icon: '📁', name: 'Project Portal', desc: 'Timeline / health / costs / sign-offs view' },
            ],
          },
          {
            type: 'info',
            title: 'Some toggles are plan-gated',
            text: 'A toggle that appears greyed out usually means the feature needs a plan upgrade rather than a workspace configuration change. If a toggle you expect to be able to flip isn\'t responding, check Billing & Plan before assuming it\'s a bug.',
          },
          { type: 'heading', level: 2, text: 'Rolling out gradually' },
          {
            type: 'paragraph',
            text: 'There is no built-in pilot-group or per-role rollout mechanism for a feature flag — turning one on switches it on for the entire workspace at once. If you want to trial a feature with a subset of the team before announcing it broadly, the practical approach is simply to tell that subset to try it and gather feedback informally, rather than expecting the platform to gate visibility by role or project. That gating doesn\'t exist for feature flags today.',
          },
        ],
      },
      {
        id: 'api-keys',
        title: 'API Keys & the Forge REST API',
        description: 'Authenticate external tools against Forge, and use the full v1 API for projects, issues, and time tracking',
        icon: '🔑',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'The Forge REST API lets anything outside the product — a CI pipeline, a Zapier workflow, an internal script, another SaaS tool — read and write your issue data without a human logging into the UI. It is the same API that Forge\'s own Slack bot, GitHub integration, and CSV import tooling are built on, so it is a first-class, fully-supported surface rather than a thin or unofficial add-on.',
          },
          {
            type: 'callout',
            variant: 'info',
            title: 'Scopes are narrow by design',
            text: 'API keys only ever carry `issues:read` and/or `issues:write` — there is no broader "admin" or settings-changing scope for a key to hold. A leaked key cannot change member roles, delete a project, or touch billing. The blast radius of any single leaked key is capped at issue data, on purpose.',
          },
          { type: 'heading', level: 2, text: 'Creating and managing a key' },
          {
            type: 'steps',
            items: [
              {
                title: 'Create a key',
                detail: 'Admin → Integrations → API Keys → New Key. Give it a descriptive name — "GitHub Actions CI" or "Zapier Integration" — so a future admin auditing the key list can tell what it\'s for and whether it\'s safe to revoke.',
                tip: 'The raw key is shown exactly once, immediately after creation. Copy it into your secrets manager before closing the dialog — Forge cannot display it again.',
              },
              {
                title: 'Choose scopes',
                detail: 'issues:read for anything that only needs to pull data (a reporting dashboard). Add issues:write if it also needs to create, update, or delete issues, comments, or time logs (a CI pipeline filing a bug on test failure, or a time-tracking integration).',
              },
              {
                title: 'Authenticate requests',
                detail: 'Pass the key as a Bearer token in the Authorization header on every request: `Authorization: Bearer <your-key>`. There is no separate API-secret or signing step — the bearer token is the full authentication mechanism.',
              },
              {
                title: 'Rotate or revoke',
                detail: 'Keys never expire automatically unless you set an expiry at creation. If a key leaks, revoke it immediately from Admin → Integrations → API Keys — but create the replacement key first if anything production-critical depends on it, so the integration doesn\'t go dark mid-swap.',
              },
            ],
          },
          {
            type: 'warning',
            title: 'A revoked key fails hard, immediately',
            text: 'There is no grace period after revocation. A CI job or integration using a revoked key starts getting 401 Unauthorized on its very next request. If a job that used to work suddenly starts failing with 401s, check Admin → Integrations → API Keys for the key\'s status before looking anywhere else.',
          },
          {
            type: 'divider',
          },
          {
            type: 'heading',
            level: 2,
            text: 'Using the API for projects and bug tracking',
          },
          {
            type: 'paragraph',
            text: 'This section is the practical reference for wiring an external system into Forge\'s issue tracker — filing bugs from a CI pipeline, syncing tickets from another system, or building your own reporting on top of live project data. All endpoints below live under `/api/v1` on your workspace\'s own domain (for example, `https://<your-workspace>.forgeapp.com/api/v1/...`) and require the `Authorization: Bearer <key>` header shown above on every call.',
          },
          { type: 'heading', level: 3, text: 'Issues: list and filter' },
          {
            type: 'paragraph',
            text: '`GET /api/v1/issues` returns issues in the workspace, newest first, and accepts query parameters to scope the result set — most integrations will filter by `project` (the project key, e.g. `FORGE`) and page through results with `limit`/`cursor` rather than pulling the whole backlog on every poll.',
          },
          {
            type: 'code',
            label: 'List open bugs in a project',
            language: 'bash',
            code: 'curl -s "https://acme.forgeapp.com/api/v1/issues?project=FORGE&status=todo&type=bug&limit=50" \\\n  -H "Authorization: Bearer $FORGE_API_KEY"',
          },
          { type: 'heading', level: 3, text: 'Issues: create' },
          {
            type: 'paragraph',
            text: 'This is the core "file a bug from outside Forge" call. `title` and `project` are the only required fields — everything else has a sane default, so a CI pipeline failing a test only needs to send a title and let priority/type default, or set them explicitly for better triage.',
          },
          {
            type: 'field-list',
            items: [
              { field: 'project', type: 'string (required)', description: 'The project key the issue belongs to.', example: '"FORGE"' },
              { field: 'title', type: 'string (required)', description: 'Short summary of the issue.', example: '"Checkout fails on Safari 17"' },
              { field: 'description', type: 'string (optional)', description: 'Full body text — steps to reproduce, stack trace, whatever context you have.' },
              { field: 'type', type: 'string (optional)', description: 'One of bug, task, story, epic. Defaults to task.' },
              { field: 'priority', type: 'string (optional)', description: 'One of low, medium, high, urgent. Defaults to medium.' },
              { field: 'assignee_id', type: 'string uuid (optional)', description: 'A workspace member\'s user id — left unassigned if omitted.' },
            ],
          },
          {
            type: 'code',
            label: 'File a bug from a CI pipeline',
            language: 'bash',
            code: 'curl -s -X POST "https://acme.forgeapp.com/api/v1/issues" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "project": "FORGE",\n    "title": "Checkout fails on Safari 17",\n    "description": "e2e suite: checkout.spec.ts failing on Safari 17 since build #482.",\n    "type": "bug",\n    "priority": "high"\n  }\'',
          },
          { type: 'heading', level: 3, text: 'Issues: update and delete' },
          {
            type: 'paragraph',
            text: '`PATCH /api/v1/issues/{id}` accepts a partial body — send only the fields you\'re changing (status, priority, assignee_id, title, description). `DELETE /api/v1/issues/{id}` removes it permanently; there is no soft-delete or undo on this endpoint, so an integration that deletes issues automatically should be very sure it\'s targeting the right id.',
          },
          {
            type: 'code',
            label: 'Move a bug to in_review after a fix merges',
            language: 'bash',
            code: 'curl -s -X PATCH "https://acme.forgeapp.com/api/v1/issues/<issue-id>" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"status": "in_review"}\'',
          },
          { type: 'heading', level: 3, text: 'Comments' },
          {
            type: 'paragraph',
            text: '`POST /api/v1/issues/{id}/comments` posts a comment on an issue — the mechanism Forge\'s own sprint-sync tooling uses to leave dated status updates. `author_label` lets you tag the comment with a readable source name (e.g. "CI Bot") instead of it appearing to come from a person.',
          },
          {
            type: 'code',
            label: 'Post a status comment',
            language: 'bash',
            code: 'curl -s -X POST "https://acme.forgeapp.com/api/v1/issues/<issue-id>/comments" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"body": "Deploy #482 fixed this — verifying in staging.", "author_label": "CI Bot"}\'',
          },
          { type: 'heading', level: 3, text: 'Attachments — a two-call flow, not one' },
          {
            type: 'warning',
            title: 'Creating an issue does NOT attach a file',
            text: 'This is the single most common integration mistake: sending a screenshot or file as part of the issue-create payload. `POST /api/v1/issues` only ever accepts JSON — it has no file field. Attaching a file to an issue is always a **second, separate call**, made after the issue already exists. An integration that skips this second call will create issues that look like they should have an attachment (the description might even say "see attached screenshot") but silently have nothing — Forge has no way to know a file was expected if it was never sent.',
          },
          {
            type: 'steps',
            items: [
              {
                title: 'Create the issue first',
                detail: 'POST /api/v1/issues as usual (see "Issues: create" above). Take the `id` from the response — you need it for the next call.',
              },
              {
                title: 'Upload the file as its own request',
                detail: 'POST /api/v1/issues/{id}/attachments with a multipart/form-data body, a single field named `file`. This is a completely separate HTTP request from the one that created the issue — most HTTP client libraries and multipart helpers cannot combine a JSON body and a file upload in one call, which is exactly why the API is split this way.',
                tip: 'If your integration captures a screenshot at the same time it creates the issue (e.g. an in-app bug reporter), sequence the two calls: create the issue, get its id back, then immediately upload the file to that id. Don\'t fire them in parallel — the attachment call needs the issue to already exist.',
              },
            ],
          },
          {
            type: 'field-list',
            items: [
              { field: 'file', type: 'binary, multipart field (required)', description: 'The file itself. Allowed types: PNG, JPEG, GIF, WEBP, PDF, Word (.doc/.docx), Excel (.xls/.xlsx). Max 10 MB per file, 100 MB total per tenant per month.' },
            ],
          },
          {
            type: 'code',
            label: 'Step 1 — create the issue, capture its id',
            language: 'bash',
            code: 'RESPONSE=$(curl -s -X POST "https://acme.forgeapp.com/api/v1/issues" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"project": "FORGE", "title": "Checkout button unresponsive", "type": "bug"}\')\nISSUE_ID=$(echo "$RESPONSE" | jq -r \'.data.id\')',
          },
          {
            type: 'code',
            label: 'Step 2 — upload the screenshot to that issue (separate call)',
            language: 'bash',
            code: 'curl -s -X POST "https://acme.forgeapp.com/api/v1/issues/$ISSUE_ID/attachments" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -F "file=@/path/to/screenshot.png"',
          },
          {
            type: 'paragraph',
            text: '`GET /api/v1/issues/{id}/attachments` lists an issue\'s attachment metadata (filename, content type, size, upload date) — it returns pointers, not the file bytes. Download URLs are short-lived signed URLs fetched separately; the list response tells you an attachment exists, not how to display it inline.',
          },
          { type: 'heading', level: 3, text: 'Session Replay (FORGE-71) — no extra endpoint, one specific detail' },
          {
            type: 'paragraph',
            text: 'Forge can show a short replay of what a user did in the seconds before they hit a bug — a rewind, not a screen recording. This is not a third API call and not a separate upload mechanism: it is the exact same two-call attachment flow described above (create the issue, then POST the file to /api/v1/issues/{id}/attachments). The only thing that makes a replay different from any other attachment is the Content-Type on the uploaded file.',
          },
          {
            type: 'callout',
            variant: 'info',
            title: 'The one thing to get right: Content-Type',
            text: 'Upload the serialized replay events with content type `application/x-forge-replay+json`. That exact content type is what tells Forge to pull the file out of the plain attachment list and render it as its own prominent "🎥 Session Replay" card at the top of the issue — instead of just another file a reviewer has to go looking for. Any other content type on the same file (e.g. text/plain or application/json) would upload fine but display as a generic attachment, not a replay.',
          },
          {
            type: 'paragraph',
            text: 'If your app already uses Forge\'s browser SDK (public/forge-sdk.js), you don\'t need to build any of this yourself — pass `sessionReplay: true` to `ForgeSDK.init(...)` and the SDK handles the entire lifecycle automatically: it silently buffers the last ~45 seconds of DOM events in memory (nothing is ever sent anywhere unless an issue is actually filed), uploads the buffer as an attachment the moment an error is captured, and appends a note to the issue description pointing at it. All input fields are masked by default.',
          },
          {
            type: 'callout',
            variant: 'warning',
            title: 'Server-side-only integrations get no video, by construction',
            text: 'If your app files issues from your backend — e.g. a "Report a bug" button that POSTs to your own API, which then calls Forge\'s REST API server-side — there is no DOM event capture happening anywhere, because nothing running in the user\'s actual browser ever recorded it. That is a browser-only capability: some script has to be executing on the page, watching clicks/inputs/mutations, before an issue is ever filed. Posting to /api/v1/issues from a server has no way to retroactively produce that recording. If you want replay video, the browser SDK (or your own client-side rrweb integration) has to be loaded on the page — a server-only REST integration cannot get you there no matter what content type you upload.',
          },
          {
            type: 'paragraph',
            text: 'If you\'re integrating directly against the API instead of using the SDK — a custom capture pipeline, a mobile app, your own error boundary — you own three things the SDK would otherwise do for you: capturing the events (rrweb is what Forge itself uses, and is a reasonable default), setting that exact content type on upload, and — if you want reviewers to see why it\'s there — appending your own note to the issue description via a PATCH, the same way the SDK does.',
          },
          {
            type: 'example',
            label: 'Custom integration uploading a replay',
            scenario: 'A team building their own error-capture pipeline (not using forge-sdk.js) wants replays to show up the same prominent way the SDK\'s do.',
            outcome: 'Same two calls as any attachment — POST /api/v1/issues to create it, then POST the serialized event JSON to /api/v1/issues/{id}/attachments as a file named e.g. session-replay.json with Content-Type: application/x-forge-replay+json. That content type alone is what triggers the dedicated Session Replay card instead of a plain file row.',
          },
          { type: 'heading', level: 3, text: 'Time tracking: log, list, edit, and delete time' },
          {
            type: 'paragraph',
            text: 'Every issue supports time logs through the API — the same underlying data members see when they log time from the issue UI. This is the endpoint set to use for integrating an external time tool, a billing system, or a bulk-import of historical time data. All four verbs (GET, POST, PATCH, DELETE) require `issues:read` for GET and `issues:write` for the other three.',
          },
          {
            type: 'field-list',
            items: [
              { field: 'minutes', type: 'integer 1-1440 (required on create)', description: 'Duration of the entry. Capped at 1440 (24 hours) per single entry — log multiple entries for anything longer.' },
              { field: 'user_id', type: 'string uuid (required on create)', description: 'The Forge user id — not an email — of who the time is attributed to. Must be an existing member of the workspace; the API rejects a user_id that isn\'t.' },
              { field: 'note', type: 'string, max 2000 chars (optional)', description: 'Free-text description of what the time was spent on.' },
              { field: 'billable', type: 'boolean (optional)', description: 'Whether this entry counts as billable time. Defaults to false.' },
              { field: 'tag', type: 'string, max 100 chars (optional)', description: 'A free-text category tag, useful for grouping in reports.' },
              { field: 'logged_at', type: 'ISO 8601 datetime (optional)', description: 'When the work happened. Defaults to now if omitted — set this explicitly when backfilling historical entries.' },
            ],
          },
          {
            type: 'table',
            headers: ['Method', 'Endpoint', 'Scope', 'Purpose'],
            rows: [
              ['GET', '/api/v1/issues/{id}/time-logs', 'issues:read', 'List up to 200 time logs on an issue, newest first.'],
              ['POST', '/api/v1/issues/{id}/time-logs', 'issues:write', 'Create a new time log entry.'],
              ['PATCH', '/api/v1/issues/{id}/time-logs/{logId}', 'issues:write', 'Edit one or more fields on an existing entry.'],
              ['DELETE', '/api/v1/issues/{id}/time-logs/{logId}', 'issues:write', 'Permanently remove an entry.'],
            ],
          },
          {
            type: 'code',
            label: 'Log 90 minutes of billable work',
            language: 'bash',
            code: 'curl -s -X POST "https://acme.forgeapp.com/api/v1/issues/<issue-id>/time-logs" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "minutes": 90,\n    "user_id": "b3f1c2a0-....-....-....-............",\n    "note": "Investigated Safari checkout failure, wrote repro test.",\n    "billable": true,\n    "tag": "bugfix"\n  }\'',
          },
          {
            type: 'code',
            label: 'Correct an entry\'s duration and note (PATCH is partial — send only what changes)',
            language: 'bash',
            code: 'curl -s -X PATCH "https://acme.forgeapp.com/api/v1/issues/<issue-id>/time-logs/<log-id>" \\\n  -H "Authorization: Bearer $FORGE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"minutes": 120, "note": "Investigated + fixed Safari checkout failure."}\'',
          },
          {
            type: 'code',
            label: 'Delete an entry logged in error',
            language: 'bash',
            code: 'curl -s -X DELETE "https://acme.forgeapp.com/api/v1/issues/<issue-id>/time-logs/<log-id>" \\\n  -H "Authorization: Bearer $FORGE_API_KEY"',
          },
          {
            type: 'warning',
            title: 'user_id must already be a workspace member',
            text: 'Both POST and PATCH validate user_id against the workspace\'s own membership list before writing anything. Passing an id from another tenant, a made-up id, or an email address instead of the actual user id returns a 400 Invalid Request — time can never be attributed to someone outside the workspace.',
          },
          {
            type: 'example',
            label: 'Building a "bug from failed test" integration',
            scenario: 'A CI pipeline should automatically open a Forge bug whenever the nightly end-to-end suite fails, tag it high priority, and post the failing test names as a comment — without a human touching Forge.',
            outcome: 'Store an issues:write-scoped key as a CI secret. On failure, POST to /api/v1/issues with type: "bug", priority: "high", and a description containing the failing spec names; then POST to /api/v1/issues/{id}/comments with the full test log for anyone who opens the issue later. Because the key only holds issues:write, a compromised CI secret still cannot touch billing, members, or any other project outside what the pipeline files.',
          },
          {
            type: 'info',
            title: 'Response shape and error format',
            text: 'Every endpoint returns JSON. Successful responses wrap the payload; error responses return a stable error code (e.g. not_found, invalid_request, internal) plus a human-readable message, and validation failures additionally list which field failed and why — useful for surfacing a precise error back to whoever triggered the integration, rather than a generic "request failed."',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        description: 'SSO, MFA enforcement, permissions, and the audit log — four separate pages, not one',
        icon: '🔒',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Security configuration in Forge is spread across a few distinct Admin pages rather than a single combined "Security" screen — worth knowing up front so you don\'t go looking for SSO settings on the audit log page, or vice versa. There is also a separate, read-only Security dashboard (Admin → Overview → Security) that shows a summary score and posture overview; the actual configuration toggles all live under Admin → Security.',
          },
          { type: 'heading', level: 2, text: 'Single sign-on (SSO/SAML)' },
          {
            type: 'paragraph',
            text: 'Admin → Security → SSO/SAML accepts your identity provider\'s SAML metadata or OIDC configuration. Once configured, members can authenticate through your IdP instead of a Forge password.',
          },
          {
            type: 'warning',
            title: 'Test before you enforce',
            text: 'Enforcing SSO workspace-wide disables password login for everyone. Confirm at least one Admin account can successfully authenticate through the IdP before flipping enforcement on — an untested configuration can lock the entire team out simultaneously, with no password fallback.',
          },
          { type: 'heading', level: 2, text: 'Multi-factor authentication' },
          {
            type: 'paragraph',
            text: 'Admin → Security → Security has the "require MFA" toggle for the workspace. Once enabled, every member must enroll a TOTP authenticator app before they can access anything beyond the enrollment screen — there is no grace period or skip option once the toggle is on.',
          },
          { type: 'heading', level: 2, text: 'The permission matrix' },
          {
            type: 'paragraph',
            text: 'Admin → Security → Permissions shows exactly what each role can do across every feature in the product. If Custom Roles is enabled, this is also where a new custom role\'s permission set gets defined field-by-field.',
          },
          { type: 'heading', level: 2, text: 'SLA policies' },
          {
            type: 'paragraph',
            text: 'Admin → Automation → SLA Policies is workspace-wide, not per-project. Create rules such as "Critical issues must have a first response within 4 hours" — Forge shows a live countdown on matching open issues and flags breaches in red so they surface without anyone having to check manually.',
          },
          { type: 'heading', level: 2, text: 'The audit log' },
          {
            type: 'paragraph',
            text: 'Admin → Overview → Audit Log records member changes, role changes, deletions, and API key activity, each with a timestamp and the acting user. Treat this as the source of truth in a post-mortem or compliance review — it reflects what actually happened, not what someone remembers happening after the fact.',
          },
          { type: 'heading', level: 2, text: 'SCIM provisioning' },
          {
            type: 'paragraph',
            text: 'On the same SSO/SAML page, the SCIM card generates a bearer token your identity provider uses to automatically create and deactivate Forge accounts as people join or leave your IdP directory. The token is shown once — copy it immediately. Revoking it stops your IdP from provisioning or deprovisioning members until a new token is generated.',
          },
        ],
      },
      {
        id: 'compliance',
        title: 'Data Requests & Compliance',
        description: 'What a workspace admin can — and can\'t — do for GDPR/CCPA requests',
        icon: '📋',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'callout',
            variant: 'warning',
            title: 'There is no self-serve export/erasure tool',
            text: 'A workspace Admin cannot process a GDPR/CCPA data-export or right-to-erasure request from inside the tenant app today. This is handled by Forge\'s own platform team. If your organization has a compliance obligation with a hard deadline, build the extra lead time for a support round-trip into your process — it is not instant or self-serve.',
          },
          { type: 'heading', level: 2, text: 'Submitting a request' },
          {
            type: 'paragraph',
            text: 'Submit a request through Admin → AI & Data → Support Queue describing exactly what\'s needed — a data export, or right-to-erasure/deletion — and for which member. This routes to Forge\'s platform team for processing; it is not something you action directly from your own workspace settings.',
          },
          { type: 'heading', level: 2, text: 'What erasure actually does' },
          {
            type: 'paragraph',
            text: 'When a request is processed, the member\'s profile is anonymized — name and email replaced — across every issue and comment they authored. Their contributions stay in place for team continuity, but their identity is scrubbed from them. The auth account itself is deleted, so they can no longer log in. This is irreversible once complete.',
          },
          { type: 'heading', level: 2, text: 'Your own compliance record' },
          {
            type: 'paragraph',
            text: 'Admin → Overview → Audit Log is the record you control directly: every member and role change, and every deletion, with timestamps and actors. Export it for a specific date range when an auditor or legal team asks for a paper trail of what happened inside your workspace.',
          },
          {
            type: 'example',
            label: 'Proving a deletion actually happened',
            scenario: 'A member who submitted a right-to-erasure request wants proof it was completed, not just that their profile disappeared from view.',
            outcome: 'Ask Forge support for confirmation once the deletion request completes. The erasure process itself runs on the platform side and isn\'t visible from inside your workspace, so confirmation has to come from the team that actually ran it.',
          },
        ],
      },
      {
        id: 'wiki-insights',
        title: 'Wiki Insights',
        description: 'Find the gaps in your team wiki by seeing what people searched for and didn\'t find',
        icon: '🔍',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Despite the name, Wiki Insights is not page-view analytics or a stale-content report. It is specifically a log of zero-result searches against your Spaces/Wiki content — which turns out to be a better signal for what to write next than a popularity chart would be, since a popular page just tells you what people already found, not what they couldn\'t.',
          },
          { type: 'heading', level: 2, text: 'Reading it as a content gap list' },
          {
            type: 'paragraph',
            text: 'Each row is a search term that returned nothing, along with how many times it was searched and when it was last tried. A term searched five or more times and still returning nothing is a real, recurring gap — treat it as a prioritized backlog of wiki pages to write, ordered by how many people actually went looking for that answer and came up empty.',
          },
        ],
      },
      {
        id: 'billing-plan',
        title: 'Billing & Plan',
        description: 'Current plan, seats, and how to upgrade',
        icon: '💳',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'info',
            title: 'Owner-only',
            text: 'Only Owners can change the billing plan. Admins and every other role see this page in read-only form.',
          },
          {
            type: 'paragraph',
            text: 'The summary strip at the top shows your current tier, status, and active seat count. If the workspace is on a trial, a countdown banner shows days remaining and turns red as the trial nears expiry, so there\'s no ambiguity about when action is needed.',
          },
          { type: 'heading', level: 2, text: 'Changing seats or plan' },
          {
            type: 'paragraph',
            text: 'Use the seat stepper to set how many seats you need, pick a tier, and click Activate. Basic and Premium are self-serve and go through checkout immediately; Pro and Enterprise are marked "Coming Soon" — email in instead of expecting a self-serve flow for those tiers.',
          },
          {
            type: 'paragraph',
            text: 'Upgrading doesn\'t always go through live Stripe checkout. If Stripe isn\'t fully configured for your workspace yet, clicking Activate logs the request instead and Forge follows up directly — you\'ll see a confirmation that the request was received rather than a payment screen.',
          },
          {
            type: 'example',
            label: 'Trial expires mid-project',
            scenario: 'A trial expires and Premium features (like Custom Roles or advanced reports) suddenly disappear from the sidebar.',
            outcome: 'Nothing is lost. The workspace simply drops to Basic-plan features until you upgrade. Reactivating restores Premium features immediately, using the same data that was already there — there is no re-migration or data loss involved.',
          },
        ],
      },
      {
        id: 'support',
        title: 'Getting Help from Forge',
        description: 'How to reach the Forge platform team when something needs a human',
        icon: '🎯',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'This is how a workspace Admin escalates something to Forge itself — it is not an internal helpdesk tool for your own team\'s end users. Use it for anything the docs and your own troubleshooting can\'t resolve: product bugs, account-level requests, or the compliance data requests described above.',
          },
          { type: 'heading', level: 2, text: 'Submitting a ticket' },
          {
            type: 'paragraph',
            text: 'Admin → AI & Data → Support Queue → New Ticket. Set a priority and describe the issue with as much specificity as you can — the affected project or issue key, what you expected, and what happened instead. Vague tickets take longer to resolve, because the first reply is often just someone asking for the details that could have been included up front.',
          },
          { type: 'heading', level: 2, text: 'Ticket lifecycle' },
          {
            type: 'paragraph',
            text: 'Tickets move through Open → In Progress → Resolved (or Closed). There is no separate "Triaged" state in between — a ticket is either open and waiting, actively being worked, or done.',
          },
          {
            type: 'info',
            title: 'No self-service escalation button',
            text: 'If a ticket feels stuck, the right move is to reply on the ticket itself with new context — for example, "this is now blocking our sprint" — rather than looking for an Escalate control. That control doesn\'t exist yet.',
          },
        ],
      },
      {
        id: 'timesheets-time-off-rates',
        title: 'Timesheets, Time Off & Rates',
        description: 'Approve submitted timesheets, review time-off requests, and configure billing/cost rates',
        icon: '💰',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'callout',
            variant: 'info',
            title: 'Gated separately from base time tracking',
            text: 'All three tools on this page sit behind the Premium tier of time tracking (the ops_layer_premium flag) — a separate gate from the base feature that lets members log time at all. If a member can already log time on issues but you can\'t reach these admin pages, that is expected behavior, not a bug: base logging and these admin tools are gated independently.',
          },
          { type: 'heading', level: 2, text: 'Approving timesheets' },
          {
            type: 'paragraph',
            text: 'Admin → Team → Timesheets shows each member\'s submitted week with a status pill — submitted, approved, or rejected. Approve directly, or reject with a required note explaining what needs correcting so the member knows exactly what to fix before resubmitting.',
          },
          { type: 'heading', level: 2, text: 'Time-off requests' },
          {
            type: 'paragraph',
            text: 'Admin → Team → Time Off lists PTO, Sick, Holiday, and Other requests, filterable by status. Approve or reject each independently — this workflow is entirely separate from timesheet approval above, so enabling or disabling one doesn\'t affect the other.',
          },
          { type: 'heading', level: 2, text: 'Billing and cost rates' },
          {
            type: 'paragraph',
            text: 'Admin → Team → Rates has two distinct tabs. Billing Rates are external — used for client invoicing, and can be scoped to a specific project. Internal Cost Rates are used for margin and profitability tracking internally, with no project scoping. Each rate can apply per-person, per-role, or workspace-wide (Global), and carries an hourly amount, a currency, and an effective-from date so historical rates stay accurate even after a rate changes.',
          },
          {
            type: 'example',
            label: 'Premium upsell instead of the tool',
            scenario: 'All three pages — Timesheets, Time Off, Rates — show a Premium-plan upsell message instead of the actual tool.',
            outcome: 'That\'s the ops_layer_premium flag being off for this workspace, a separate tier from base time tracking. Upgrading the plan (or asking Forge to enable it) unlocks all three at once.',
          },
        ],
      },
      {
        id: 'recurring-issues',
        title: 'Recurring Issues',
        description: 'Auto-create the same issue every sprint, or every N sprints',
        icon: '🔁',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Recurring Issues exists for work that repeats on a schedule regardless of what else is planned that sprint — a deploy checklist, a recurring security review, a standing audit. A template seeds a real issue automatically the moment a matching sprint starts; there is no separate "run" step, and no risk of forgetting to create the ticket manually.',
          },
          { type: 'heading', level: 2, text: 'Creating a template' },
          {
            type: 'paragraph',
            text: 'Admin → Automation → Recurring Issues → "+ New." Set a title, project, schedule (every sprint, or every N sprints with N from 2 to 12), issue type, priority, and an optional description that carries over to each generated issue.',
          },
          { type: 'heading', level: 2, text: 'Pausing without deleting' },
          {
            type: 'tip',
            text: 'Toggle a template Active/Paused instead of deleting it if you need to skip a stretch of sprints. Paused templates are skipped when a sprint starts, but the configuration itself stays intact for whenever you re-enable it — no need to recreate it from scratch.',
          },
        ],
      },
      {
        id: 'integrations',
        title: 'Integrations',
        description: 'GitHub, Slack/Teams/Discord notifications, outbound webhooks, and the SDK/embed options',
        icon: '🔌',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'Forge has four independent integration surfaces, not one combined settings page — worth knowing so you configure the right one for what you actually want. GitHub is for PR/commit links on issues. Chat is for team notifications. Webhooks is for your own systems reacting to Forge events. SDK/Embed is for capturing errors or emailing-in issues from entirely outside Forge.',
          },
          { type: 'heading', level: 2, text: 'GitHub' },
          {
            type: 'paragraph',
            text: 'Admin → Integrations → GitHub generates a webhook secret and a URL to paste into your GitHub repo\'s own webhook settings, subscribed to Pull Request and Push events. The connection is inbound from GitHub — there is no OAuth or personal-access-token flow on Forge\'s side. Mention an issue key like FORGE-123 in a PR title or body to link it automatically; use "closes FORGE-123" to auto-close the issue on merge.',
          },
          { type: 'heading', level: 2, text: 'Slack, Teams, or Discord' },
          {
            type: 'paragraph',
            text: 'Admin → Integrations → Chat accepts an incoming webhook URL per provider to notify the channel on issue creation, new comments, and priority changes to Urgent. Separately, a Slack Bot card enables inbound issue creation from Slack itself — a `/forge [title]` slash command and a 🐛 emoji reaction — if you supply a bot token, signing secret, and workspace ID.',
          },
          { type: 'heading', level: 2, text: 'Outbound webhooks' },
          {
            type: 'paragraph',
            text: 'Admin → Integrations → Webhooks lets you register your own endpoint for issue.created, issue.updated, issue.deleted, and comment.created events. Every request is signed with HMAC-SHA256 in the X-Forge-Signature header, so your endpoint can verify it actually came from Forge before trusting the payload.',
          },
          {
            type: 'tip',
            text: 'Use "Send test" on a newly registered webhook before relying on it in production — it confirms your endpoint is reachable and the signature verifies correctly, without waiting for a real issue event to occur.',
          },
          { type: 'heading', level: 2, text: 'SDK & Embed' },
          {
            type: 'paragraph',
            text: 'Admin → Integrations → SDK & Embed covers three ways to get data into Forge without going through the UI: server-side API calls using an issues:write API key (see API Keys above), a drop-in browser script for automatic error capture via `ForgeSDK.init(...)`, and email-to-issue — an inbound email address per project that turns the subject into a title and the body into a description.',
          },
        ],
      },
      {
        id: 'admin-tools-data',
        title: 'Admin Tools & Data',
        description: 'Engineering Health, AI Usage, Release Notes, and Import/Export',
        icon: '🛠',
        roles: ['owner', 'admin'],
        blocks: [
          {
            type: 'paragraph',
            text: 'A handful of admin-only pages that don\'t fit neatly under Team or Security: a health dashboard, an AI-usage view scoped specifically to Think Tank, an AI-generated release-notes tool, and the two data-movement utilities (CSV import and export).',
          },
          { type: 'heading', level: 2, text: 'Engineering Health' },
          {
            type: 'paragraph',
            text: 'A dashboard of WIP count, blocked or unowned urgent issues, average cycle time, and weekly throughput, topped with a plain-language banner — "Board looks healthy," "WIP is high," and similar — summarizing overall state at a glance.',
          },
          { type: 'heading', level: 2, text: 'AI Usage' },
          {
            type: 'paragraph',
            text: 'Shows Think Tank Sounding Board activity specifically — calls, input and output tokens for the current month — broken down by provider and by user. This does not cover every AI feature in Forge, only Sounding Board usage; don\'t read it as a total AI cost dashboard.',
          },
          { type: 'heading', level: 2, text: 'Release Notes generator' },
          {
            type: 'paragraph',
            text: 'Pick a date range and an optional project filter, click "✨ Generate release notes," and Grok categorizes completed issues into New Features, Bug Fixes, Improvements, and Breaking Changes with a short summary. "Copy as Markdown" pastes the result wherever you actually publish release notes.',
          },
          { type: 'heading', level: 2, text: 'Import issues from CSV' },
          {
            type: 'paragraph',
            text: 'Admin → AI & Data → Import Issues is a three-step wizard: upload the CSV, map its columns to Forge fields (title is the only required mapping), then review a preview — including any new categories it detected — before confirming. Rows that already exist, matched by an external ID, are skipped rather than duplicated.',
          },
          { type: 'heading', level: 2, text: 'Export data' },
          {
            type: 'paragraph',
            text: 'Admin → AI & Data → Export Data offers three fixed CSV downloads: Issues, Sprint Report, and Time Logs. For anything beyond these three, use the Custom Report Builder\'s export instead, which supports CSV, Excel, and PDF.',
          },
        ],
      },
    ],
  },
];
