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
  /** 2-4 sentences of context before the steps: what this is for, when you'd reach for it, what breaks if you skip it. */
  overview: string;
  icon: string;
  steps: DocStep[];
  /** Common problems and their fixes — the part a pure step-list never covers. */
  commonIssues?: DocIssue[];
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
        overview:
          'Everything else in Forge assumes you\'ve done these four things first — especially setting your timezone correctly, since it quietly affects when you see deadline and SLA warnings. This only takes a few minutes and you won\'t need to repeat it.',
        icon: '🚀',
        roles: ['owner', 'admin', 'member', 'viewer'],
        steps: [
          {
            step: 1,
            title: 'Create your account',
            description:
              'Navigate to the invite link your admin sent. Click Accept Invitation, enter your email and choose a password — or sign in with Google/GitHub if SSO is enabled. You will land on the onboarding checklist automatically after your first login.',
          },
          {
            step: 2,
            title: 'Join your workspace',
            description:
              'After signing in you will be placed in your team\'s workspace. Your URL will be something like forge.app/acme-corp — bookmark it. Each tenant has its own slug and data is fully isolated between workspaces.',
          },
          {
            step: 3,
            title: 'Set up your profile',
            description:
              'Click your avatar in the bottom-left sidebar to open Profile Settings. Add a display name, avatar, and timezone. Forge uses your timezone for sprint deadline countdowns and SLA warning notifications.',
            tip: 'Set your timezone correctly — sprint deadlines and SLA countdowns display in your local time. Wrong timezone = missed alerts.',
          },
          {
            step: 4,
            title: 'Complete the onboarding checklist',
            description:
              'Forge shows a checklist on first login (accessible via the flag icon in the sidebar). Complete each step to unlock the full interface — it takes about 5 minutes and ensures your account is fully configured.',
          },
        ],
      },
      {
        id: 'working-with-issues',
        title: 'Working with Issues',
        description: 'View, update, and comment on issues in your workspace',
        overview:
          'An issue is the basic unit of work in Forge — a bug, a feature, a task. Everything else (sprints, the board, reports) is really just different views over the same set of issues, so getting comfortable here pays off everywhere else.',
        icon: '🎫',
        roles: ['owner', 'admin', 'member', 'viewer'],
        steps: [
          {
            step: 1,
            title: 'View issues',
            description:
              'Open the Issues tab in the sidebar. By default it shows all open issues in the workspace. Use the filter bar to narrow by project, assignee, priority, or sprint. Click any row to open the detail panel.',
          },
          {
            step: 2,
            title: 'Update issue status',
            description:
              'In the issue detail panel, the status badge (Open → In Progress → In Review → Done) is a dropdown — click it to advance the issue. Members can update status on issues assigned to them; viewers are read-only.',
          },
          {
            step: 3,
            title: 'Add a comment',
            description:
              'In the issue detail panel, scroll to the Comments section. Type in the text area and press Cmd+Enter (Mac) or Ctrl+Enter (Windows) to post. Markdown is supported: **bold**, *italic*, and ```code blocks```.',
            tip: 'Use #PROJECT-123 in a comment to cross-reference another issue. Forge renders it as a clickable link.',
          },
          {
            step: 4,
            title: 'Upload attachments',
            description:
              'Drag a file onto the issue detail panel or click the paperclip icon in the comment toolbar. Attachments are stored per-issue and visible to all workspace members with access to that project.',
          },
        ],
      },
      {
        id: 'daily-workflow',
        title: 'Your Daily Workflow',
        description: 'Assigned, Inbox, and Watching — the three tabs that keep you on top of work',
        overview:
          'These three tabs answer three different questions: Assigned is "what do I owe," Inbox is "what happened that I should know about," Watching is "what am I keeping an eye on without owning it." Confusing Inbox for a to-do list (rather than Assigned) is the most common way people miss their own work — Inbox is about staying informed, not about what\'s yours to do.',
        icon: '📅',
        roles: ['owner', 'admin', 'member', 'viewer'],
        steps: [
          {
            step: 1,
            title: 'Check your morning Assigned list',
            description:
              'Open the Assigned tab in the sidebar to see all issues assigned to you, sorted by priority. This is your daily to-do list — work top to bottom by priority.',
          },
          {
            step: 2,
            title: 'Process Inbox notifications',
            description:
              'The Inbox tab collects @mentions, issue assignments, and status changes affecting your issues. Mark items as read by clicking the checkmark. The unread count appears as a badge on the sidebar.',
            tip: 'Click \'Mark all read\' to clear the Inbox, then re-watch only the issues you need to actively track.',
          },
          {
            step: 3,
            title: 'Review Watching issues',
            description:
              'The Watching tab shows issues you have starred or been added to as a watcher. Use this to track blockers or cross-team dependencies without being the assignee.',
          },
          {
            step: 4,
            title: 'Update progress before end of day',
            description:
              'Before logging off, update the status of any in-progress issues. Stale In Progress items trigger SLA warnings for admins after 48 hours by default — keeping your status current helps the whole team.',
          },
        ],
      },
      {
        id: 'sprint-board',
        title: 'Sprint Board',
        description: 'Understand the Kanban board, move issues, and create quick tasks',
        overview:
          'The Board is the day-to-day view of the active sprint — a snapshot of what\'s open, in progress, in review, and done. Unlike the Issues list (which shows everything), the Board is scoped to one sprint at a time, which is what makes it useful for a standup: it\'s inherently limited to "what we\'re actually working on right now."',
        icon: '🗂️',
        roles: ['owner', 'admin', 'member', 'viewer'],
        steps: [
          {
            step: 1,
            title: 'Understand the columns',
            description:
              'The Board tab shows the active sprint as a Kanban board. Default columns are Open, In Progress, In Review, and Done. These status options are workspace-wide (configured by an Admin), not something you set per-project.',
          },
          {
            step: 2,
            title: 'Move issues between columns',
            description:
              'Drag an issue card to a new column to update its status instantly. Members can drag their own issues; admins can drag any issue. The status change is reflected immediately in the Issues list and Reports.',
            tip: 'Dragging to Done does NOT close the issue permanently — it stays in the sprint until a PM completes the sprint.',
          },
          {
            step: 3,
            title: 'Filter the board',
            description:
              'Use the filter bar above the board to show only your issues (By Assignee), a specific label, or a priority tier. The board also has a sprint selector to view past sprints (read-only).',
          },
          {
            step: 4,
            title: 'Create a quick issue',
            description:
              'Click the + button at the top of the Open column to create an issue directly on the board. Give it a title, type, and priority — it will be added to the active sprint automatically.',
          },
        ],
      },
      {
        id: 'time-tracking',
        title: 'Time Tracking',
        description: 'Log time on an issue, run a timer, and keep your weekly timesheet current',
        overview:
          'Time can be logged two ways: directly on the issue you\'re working on, or from your personal weekly timesheet — both write to the same underlying log, so it doesn\'t matter which one you use day to day. Viewers cannot log time or run timers; everyone else can. If your workspace doesn\'t show a "My Timesheet" link in the sidebar, time tracking (the `ops_layer` feature) hasn\'t been turned on for this workspace — ask an Admin.',
        icon: '⏱️',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Log time on an issue',
            description:
              'Open an issue and find the time panel. Click "+ Log time manually" to enter Hours/Minutes, an optional note, a tag (Development, Review, Meetings, Testing, Design, Planning, Support, or your own), and whether it\'s billable.',
          },
          {
            step: 2,
            title: 'Or just run the timer',
            description:
              'Click "▶ Start Timer" when you begin work on an issue, and "⏹ Stop & Log" when you\'re done — Forge logs the elapsed time automatically with a note like "Timer · 12m 34s". Only one timer runs at a time; starting a new one on a different issue stops the old one.',
          },
          {
            step: 3,
            title: 'Watch the estimate vs. logged comparison',
            description:
              'If the issue has an estimate set, a progress bar shows how much of it you\'ve used — it turns amber past 90% and red past 100%, with a dismissible banner warning you\'re approaching or over the estimate. This is a heads-up, not a hard stop; you can keep logging time past 100%.',
          },
          {
            step: 4,
            title: 'Use your weekly timesheet for a full-week view',
            description:
              'Open My Timesheet from the sidebar to see every issue you logged time against this week in a grid, with a daily total row. Click any day/issue cell to add or edit an entry directly from here instead of going to each issue individually.',
          },
          {
            step: 5,
            title: 'Set up a recurring entry for regular work',
            description:
              'If you do the same loggable work on a schedule (e.g. a standing weekly meeting), add a Recurring Entry from the timesheet page — daily or specific weekdays. This is a saved template you can toggle active/paused, not a substitute for actually logging your other work.',
          },
          {
            step: 6,
            title: 'Request time off',
            description:
              'If your workspace has Timesheet Premium enabled, a "🏖 Time Off" button on the timesheet page lets you submit a PTO, Sick, Holiday, or Other request with a date range and optional notes. Submitted requests show as pending until an Admin approves or rejects them.',
          },
        ],
        commonIssues: [
          {
            problem: 'I don\'t see "My Timesheet" in the sidebar at all.',
            fix: 'The base time-tracking feature is off for this workspace. Per-issue time logging on an individual issue still works regardless — ask an Admin to enable the timesheet feature if you need the weekly view.',
          },
          {
            problem: 'I don\'t see a "Submit week" or "Time Off" button on my timesheet.',
            fix: 'Those two specifically require the Premium tier of time tracking, separate from the base feature — logging time itself still works without it.',
          },
        ],
      },
      {
        id: 'team-wiki',
        title: 'Team Wiki (Spaces)',
        description: 'Personal, team, and project knowledge bases with rich text and search',
        overview:
          'Spaces come in three flavors: a Project Space (auto-created with every project, for that project\'s own docs), Team Spaces (shared workspace-wide — runbooks, how-tos), and My Space (private to you). Only Team and My Space are created by you; a Project Space just appears automatically.',
        icon: '📚',
        roles: ['owner', 'admin', 'member', 'viewer'],
        steps: [
          {
            step: 1,
            title: 'Create a Team Space or My Space',
            description:
              'From Spaces in the sidebar, click "+ Team Space" (shared) or "+ My Space" (private to you) and pick an icon and name. Project Spaces aren\'t created here — they come automatically with the project.',
          },
          {
            step: 2,
            title: 'Write a page',
            description:
              'Click "+ New page." The editor supports headings, bold/italic/strikethrough, lists, tables, code blocks with syntax highlighting, and a slash-command menu (type "/") for quick formatting — it autosaves about a second after you stop typing.',
          },
          {
            step: 3,
            title: 'Search across everything you have access to',
            description:
              'Use the search box on the Spaces hub page — it searches page titles and content together, not just titles. There\'s no separate search inside one space; search from the hub.',
          },
          {
            step: 4,
            title: 'Share a page externally, if you need to',
            description:
              'Click "🔗 Share" on a page to grant read-only access to anyone with an email at a specific company domain — access expires after 48 hours and you can revoke it any time. Generic providers (Gmail, Yahoo, etc.) can\'t be used as the allowed domain.',
          },
        ],
      },
      {
        id: 'calendar',
        title: 'Calendar',
        description: 'Issue due dates and sprint date ranges, in one monthly view',
        overview:
          'The Calendar isn\'t a separate scheduling tool — it\'s a monthly view of due dates and sprint windows you already set elsewhere, useful for seeing what\'s converging on the same week.',
        icon: '📅',
        roles: ['owner', 'admin', 'member', 'viewer'],
        steps: [
          {
            step: 1,
            title: 'See what\'s due',
            description:
              'Issue due dates show as colored chips on their due day, colored by project with a priority-colored left border. Click a chip to open that issue directly.',
          },
          {
            step: 2,
            title: 'See sprint windows',
            description:
              'Sprints overlapping the visible month show as a colored band above the grid, with a pulsing dot on the currently active one.',
          },
          {
            step: 3,
            title: 'Filter to one person',
            description:
              'Use the assignee filter pills to see only one teammate\'s due dates — useful for a 1:1 or checking someone\'s week at a glance.',
          },
        ],
      },
      {
        id: 'changelog',
        title: 'Changelog',
        description: 'An automatically generated, public list of what shipped',
        overview:
          'This isn\'t something anyone writes — it\'s generated automatically from issues moved to Done, grouped by week and categorized by type. There\'s no manual changelog-entry tool; if it\'s not showing up here, it\'s because the issue\'s type wasn\'t set to something that maps to a category, or it isn\'t actually Done yet.',
        icon: '📰',
        roles: ['owner', 'admin', 'member', 'viewer'],
        steps: [
          {
            step: 1,
            title: 'Open the Changelog',
            description:
              'It groups completed issues by the week they were finished, newest first.',
          },
          {
            step: 2,
            title: 'Understand the categories',
            description:
              'Feature-type issues show as "✨ New," bugs show as "🐛 Fixed," and everything else (tasks, chores, etc.) shows as "🔧 Improved" — categorization is purely based on the issue\'s type field, nothing manual.',
          },
        ],
      },
      {
        id: 'ask-ember',
        title: 'Ask Ember',
        description: 'An in-app AI assistant that answers from your own docs and wiki — nothing else',
        overview:
          'Ember is the ✦ button in the bottom-right corner of every page. It only answers from Forge\'s own product docs and your team\'s Spaces/Wiki content — never the open internet, and never another tenant\'s data. If it can\'t find something in those two places, it says so rather than guessing.',
        icon: '✦',
        roles: ['owner', 'admin', 'member', 'viewer'],
        steps: [
          {
            step: 1,
            title: 'Ask a "how do I" question',
            description:
              'Type a question and Ember answers grounded in the Docs Hub and your team\'s wiki, citing exactly which section or page it drew from — click the citation to verify it yourself.',
          },
          {
            step: 2,
            title: 'Use "Show me" when it\'s offered',
            description:
              'On a few pages, a citation includes a "▶ Show me" button that spotlights the actual UI element being described, instead of just describing it in words.',
          },
          {
            step: 3,
            title: 'Ask it to create an issue',
            description:
              'While you\'re on a project\'s page, ask Ember to create an issue in plain language — it drafts the request and shows a "Create issue" button, but never creates anything until you click it yourself.',
          },
        ],
        commonIssues: [
          {
            problem: 'Ember says it couldn\'t find anything, but I know it\'s documented.',
            fix: 'Try rephrasing with the words actually used in the docs (e.g. "sprint" not "iteration") — retrieval matches on the words present, not the underlying concept.',
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
        overview:
          'A new project needs three things before a team can really use it: issue categories that match how you triage, priority levels wired to your SLAs, and people who can be assigned work. The one thing to know going in: category/priority/status defaults are workspace-wide (Admin → Team → Fields & Labels), while categories specifically can also be bulk-imported per project from that same project\'s Categories tab. Team membership is managed from Admin → Team → Projects, not from inside the project itself.',
        icon: '🏗️',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Create a project',
            description:
              'Go to Projects in the sidebar and click New Project. Enter a name, key (short prefix like FORGE or WEB), and description. The key prefixes every issue identifier in that project (e.g. FORGE-42) and cannot be changed once issues exist — pick something short and unambiguous the first time.',
          },
          {
            step: 2,
            title: 'Set up categories for this project',
            description:
              'Open the project, go to its Categories tab (visible to Admins), and either bulk-import from a CSV or add categories one by one. These are what appear as the issue-type icon on cards and in filters.',
            tip: 'Keep categories under 6. Too many options just means people guess wrong, which quietly pollutes your reports later.',
          },
          {
            step: 3,
            title: 'Confirm your priority and status defaults',
            description:
              'Priority levels (Critical/High/Medium/Low) and status columns are workspace-wide defaults, configured once in Admin → Team → Fields & Labels — not a per-project setting. If they need to change, that change affects every project in the workspace, so loop in other PMs before renaming or reordering them.',
          },
          {
            step: 4,
            title: 'Add your team to the project',
            description:
              'This lives outside the project itself, at Admin → Team → Projects — an Admin adds or removes members per project from there. Owners and Admins can already see and act on every project without being explicitly added; this step is really about which Members and Viewers can be assigned issues in this specific project.',
          },
          {
            step: 5,
            title: 'Set up SLA policies',
            description:
              'SLA policies are workspace-wide too (Admin → Automation → SLA Policies) — rules match on priority or category across every project, not one at a time. Forge shows a live countdown on matching open issues and flags a breach in red.',
          },
        ],
        commonIssues: [
          {
            problem: 'A Member says they can\'t be assigned issues in a project they can clearly see.',
            fix: 'Being able to see a project and being added to it are different things. Have an Admin add them at Admin → Team → Projects — visibility alone doesn\'t grant assignability.',
          },
        ],
      },
      {
        id: 'sprint-management',
        title: 'Sprint Management',
        description: 'Create sprints, fill them, and track velocity over time',
        overview:
          'A sprint is a time-boxed slice of work with a start and end date. Forge tracks velocity automatically once you start using sprints consistently — the value compounds: one sprint of data tells you nothing, six sprints tells you whether your planning estimates are realistic.',
        icon: '⚡',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Create a sprint',
            description:
              'In the Board tab, open Manage Sprints → New Sprint. Set a name (e.g. "Sprint 12"), start date, and end date. There\'s no enforced cadence — two weeks is common, but Forge doesn\'t require it.',
          },
          {
            step: 2,
            title: 'Add issues to the sprint',
            description:
              'Select issues in the Issues list and use the bulk action bar to add them to a sprint, or drag issues onto the sprint from the Backlog view on the Board.',
            tip: 'Velocity only counts issues that reach Done or Closed status while the sprint is still active. An issue closed after a sprint ends and carries into the next doesn\'t retroactively count for the one it was originally planned in.',
          },
          {
            step: 3,
            title: 'Start the sprint',
            description:
              'Click Start Sprint in Manage Sprints. This is the point where SLA countdown clocks begin on issues in the sprint, and the Board switches to showing this sprint by default for the team.',
          },
          {
            step: 4,
            title: 'Track velocity',
            description:
              'Reports → Velocity shows completed work per sprint over time. Use it at planning time, not just retrospectively — a team that has consistently under-delivered its committed scope for three sprints running is telling you something about estimation, not effort.',
          },
          {
            step: 5,
            title: 'Complete the sprint',
            description:
              'Click Complete Sprint when the period ends. Forge asks what to do with anything still open — move it to the backlog or carry it into the next sprint. Whichever you choose, a quick note on *why* it didn\'t finish is worth more later than the decision itself.',
          },
        ],
      },
      {
        id: 'roadmap-planning',
        title: 'Roadmap Planning',
        description: 'Visualize project timelines and milestones across the portfolio',
        overview:
          'The Roadmap is a portfolio-level timeline — think of it as "when is each project happening," not a sprint-by-sprint plan. It exists to answer a stakeholder\'s question ("what\'s shipping this quarter") at a glance, not to replace the Board for day-to-day work. One thing worth knowing before you rely on it for planning conversations: cross-project dependency arrows are computed automatically from issue-level "blocks" links between projects — there\'s no manual drag-to-connect action for dependencies specifically (dragging a bar reschedules or resizes that project\'s own timeline).',
        icon: '🗺️',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Open the Roadmap',
            description:
              'Click Roadmap in the sidebar. Each project appears as a horizontal bar across a timeline.',
          },
          {
            step: 2,
            title: 'Reposition and resize a project',
            description:
              'Drag a bar left or right to reschedule it, or drag its right edge to resize its planned duration. This updates the project\'s roadmap position immediately — it does not touch sprint dates underneath it.',
          },
          {
            step: 3,
            title: 'See a project\'s issue counts',
            description:
              'Click a project bar to expand a quick issue-count summary inline, without leaving the roadmap view.',
          },
          {
            step: 4,
            title: 'Understand dependency arcs',
            description:
              'If any issue in Project A has a "blocks" relationship to an issue in Project B, Forge draws a dependency arc between those two projects automatically — you don\'t create these by hand. If you need a dependency reflected here, link the underlying issues; the roadmap will pick it up.',
          },
        ],
      },
      {
        id: 'mind-map',
        title: 'Mind Map',
        description: 'A visual, editable tree of a project\'s epics, sprints, and issues',
        overview:
          'The Mind Map is a project\'s own Idea→Project→Epic→Sprint→Issue structure rendered as a diagram, not just a list — and unlike a static export, you can add real epics, sprints, and issues directly from the nodes. If the project was converted from a Think Tank idea, the idea itself is the root node, so you can see the whole lineage from "why we started this" down to today\'s open tickets in one view.',
        icon: '🧠',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Open the Mind Map',
            description:
              'From a project\'s detail page, click the Mind Map tab. The tree lays out automatically left to right — you don\'t need to arrange anything to get a readable diagram.',
          },
          {
            step: 2,
            title: 'Add an epic, sprint, or issue from any node',
            description:
              'Hover a node and use its "+ Add" control to create the next level down — an Epic under the project, a Sprint under an epic, an Issue under a sprint. This writes to the same real data Board and Sprints use; there is no separate "mind map data" to keep in sync.',
          },
          {
            step: 3,
            title: 'Expand, collapse, and drag',
            description:
              'Click the ± toggle on a node to collapse its branch when the tree gets busy. Drag any node to reposition it manually — your layout is preserved across expand/collapse and adding new nodes, so you don\'t lose a layout you\'ve arranged for a stakeholder screenshot.',
          },
          {
            step: 4,
            title: 'Select multiple issues and bulk-move them',
            description:
              'Shift-click or drag a selection box over several issue nodes (hold Shift while dragging to select rather than pan), then use the bar at the bottom to move all of them into a different sprint at once.',
          },
          {
            step: 5,
            title: 'Present the map to a stakeholder',
            description:
              'Click ▶ Present in the top-right to step through every visible node in order — each click pans and zooms to the next node and dims the rest. Useful for walking someone through how a project decomposed without manually scrolling and zooming live.',
          },
        ],
        commonIssues: [
          {
            problem: 'Two nodes are overlapping and I can\'t read either one.',
            fix: 'Drag either node to a clear spot — the layout auto-spaces new nodes reasonably, but a busy tree can still overlap. Your manual position sticks after that.',
          },
        ],
      },
      {
        id: 'whiteboards',
        title: 'Whiteboards',
        description: 'Freeform diagramming and brainstorming canvas, separate from the Mind Map',
        overview:
          'Whiteboards are unstructured — draw, add sticky notes, diagram anything — unlike the Mind Map, which is a structured Epic/Sprint/Issue tree. Use a Whiteboard when you need to sketch out an idea or process that doesn\'t map cleanly to that hierarchy; use the Mind Map when you\'re actually managing the project\'s real structure.',
        icon: '🎨',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Create a whiteboard',
            description:
              'From a project\'s detail page, open the Whiteboards tab and click "+ New whiteboard." Give it a name — you can rename it later by clicking the title inline once it\'s open.',
          },
          {
            step: 2,
            title: 'Draw and diagram',
            description:
              'The canvas is a full drawing tool (shapes, sticky notes, freehand, text) — changes autosave a few seconds after you stop editing, so there\'s no explicit save button to remember.',
          },
          {
            step: 3,
            title: 'Link a real issue onto the board',
            description:
              'Use "Link issue" to search and attach an existing issue as a badge on the canvas — clicking that badge later jumps straight to the real issue. This is the one place a Whiteboard connects back to real project data; everything else on the canvas is just drawing.',
          },
          {
            step: 4,
            title: 'Cluster sticky notes with AI',
            description:
              'If you\'ve got a wall of sticky notes from a brainstorm, "Cluster stickies" groups related ones together automatically — a starting point to tidy up a busy board, not a final answer.',
          },
        ],
      },
      {
        id: 'pr-risk-gates',
        title: 'PR Risk Gates',
        description: 'Review and approve AI-flagged high-risk changes before they reach Done',
        overview:
          'This is a judgment aid, not a static analysis tool — it reads an issue\'s title, description, and any linked PR titles, not the actual code diff or CI results. Its job is to slow down risky-looking changes long enough for a human to look at them, not to catch bugs automatically.',
        icon: '🚨',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'What triggers a gate',
            description:
              'When a developer runs PR Impact Prediction and the result is High or Critical risk, Forge automatically opens a Risk Gate — the issue is blocked from moving to Done until a PM or Admin approves or denies it. Medium risk surfaces as a non-blocking warning.',
          },
          {
            step: 2,
            title: 'Find gated issues',
            description:
              'Open Mission Control (the morning briefing page) and look for the PR Risk Overview widget. It splits into "Risk Gates — Needs Your Approval" (blocking) and "Medium Risk — Monitor" (not blocking). Click any row to jump straight to the ticket.',
            tip: 'The stat strip at the top of Mission Control shows a live gate count. If it\'s non-zero going into standup, check it before the meeting, not during.',
          },
          {
            step: 3,
            title: 'Review a gated issue',
            description:
              'Open the issue and find the Risk Gate Review panel under AI Actions. Read the AI\'s summary, concerns, and suggestions, then Approve or Deny — a reason is required either way.',
            tip: 'A gate older than 24 hours shows a red stale indicator on the dashboard — that means a developer is blocked and waiting on you specifically.',
          },
          {
            step: 4,
            title: 'Write a reason that\'s actually useful later',
            description:
              'Your reason is posted as a permanent system comment. On approval, note what you reviewed and confirmed was addressed. On denial, be specific about what needs to change — a vague denial just produces a round of back-and-forth instead of a fix.',
          },
          {
            step: 5,
            title: 'When gates lift automatically',
            description:
              'If the developer re-runs the analysis and the new result drops to Medium or Low, the gate lifts on its own — no approval needed from you. A "gate lifted" system comment marks the change.',
          },
        ],
      },
      {
        id: 'stakeholder-reporting',
        title: 'Stakeholder Reporting',
        description: 'Portfolio health at a glance, for people who don\'t need the day-to-day detail',
        overview:
          'The Stakeholder view exists so leadership can see project health without living in the Board. Its RAG status (Red/Amber/Green) per project is computed automatically from real signals — blocked issues and how much of the queue is stuck in review — not something a PM manually sets. That\'s deliberate: a manually-set status can drift from reality; an auto-computed one can\'t lie by omission.',
        icon: '📊',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Open Stakeholder view',
            description:
              'Click Stakeholder in the sidebar. Projects are grouped by their computed RAG status, alongside workspace-level KPIs.',
          },
          {
            step: 2,
            title: 'Understand what drives the color',
            description:
              'Blocked: any issue in the project has status "blocked" — needs immediate attention. At Risk: more than 40% of open issues are stuck in review — throughput may be stalling. On Track: neither of those. There is no manual override — if a project shows Red and you disagree, the fix is to resolve the blocked issues or review backlog, not to recolor the dot.',
          },
          {
            step: 3,
            title: 'Export for sharing',
            description:
              'Click Export PDF in the header. It\'s formatted for dropping into Slack or email as-is — there\'s no separate CSV export from this view specifically (a general CSV data export exists workspace-wide under Admin → AI & Data → Export Data, but that\'s a different, broader export, not a stakeholder-formatted one).',
          },
        ],
        commonIssues: [
          {
            problem: 'A project looks Red but the team feels like it\'s actually fine.',
            fix: 'Check for any issue with status "blocked" — a single stale blocked ticket that should have been resolved or unblocked will flip the whole project Red. Clean that up rather than looking for a way to override the color.',
          },
        ],
      },
      {
        id: 'time-reports',
        title: 'Time Reports',
        description: 'Where logged time rolls up across your team and projects',
        overview:
          'Every hour logged on an issue or from a personal timesheet feeds this same reporting view — there\'s nothing separate to configure. Use it to see where time is actually going, not just where it was estimated to go, and to pull billable-hours data for client invoicing if you track that.',
        icon: '⏱️',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Pick your time window',
            description:
              'Reports → Time. Choose Sprint, This Week, This Month, or a Custom date range. Sprint mode lets you pick any sprint, not just the active one, so you can go back and see how a past sprint\'s time actually broke down.',
          },
          {
            step: 2,
            title: 'By User — who logged what',
            description:
              'A bar per team member, sized by total hours, with a "% billable" figure. Click a name to expand their per-project breakdown, or "View logs" to filter the detail table below to just their entries.',
          },
          {
            step: 3,
            title: 'By Project — where the hours went',
            description:
              'Same bar-chart idea, one bar per project instead of per person. Useful for a quick "which project ate this week" check without cross-referencing By User yourself.',
          },
          {
            step: 4,
            title: 'By Sprint — a per-sprint rollup',
            description:
              'A table of sprint / project / date range / total hours / top contributor — the fastest way to see whether time logged roughly matched what a sprint was supposed to cost, across sprints, without opening each one individually.',
          },
          {
            step: 5,
            title: 'Export what you need as CSV',
            description:
              'Each tab has its own "↓ CSV" export scoped to what you\'re currently looking at (summary by user, summary by project, the sprint rollup table, or the full log detail with date/member/issue/project/minutes/billable/tag/note). Export the log detail view when you need the raw entries, not just the rollup.',
          },
        ],
      },
      {
        id: 'reports-hub',
        title: 'Reports Hub',
        description: 'Burndown, Cycle Time, Issue Aging, Sprint Retro, Capacity, and a custom builder',
        overview:
          'Beyond the Velocity chart, Reports has a full set of purpose-built views plus a Custom Builder for anything they don\'t cover. A few (Cycle Time, Issue Aging, Scheduled Reports) are marked "pro" — gated to the Premium plan tier, not something a workspace setting turns on separately.',
        icon: '📊',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Sprint-focused reports',
            description:
              'Burndown (ideal vs. actual remaining points per day, with an on-track/behind indicator), Overcommitment (who\'s over their weekly capacity across active sprints, not just this one), and Estimate Accuracy (how close estimates land to actual logged time, with a plain-language auto-generated insight sentence).',
          },
          {
            step: 2,
            title: 'AI Sprint Retro',
            description:
              'Pick a completed sprint and click "Generate AI Summary" — Grok reviews what shipped, what slipped and why, and three focus items for next sprint, based on the sprint\'s actual issues and time logs. The summary is saved on the sprint and shows a "Generated {date}" stamp until you regenerate it.',
          },
          {
            step: 3,
            title: 'Capacity',
            description:
              'A gauge of overall committed hours vs. team capacity for the active sprint, plus a per-member breakdown — the fastest sanity check before locking sprint scope at planning.',
          },
          {
            step: 4,
            title: 'Cycle Time & Issue Aging (Premium)',
            description:
              'Cycle Time shows how long issues actually take to close, broken down by priority/type/assignee. Issue Aging flags what\'s gone stale in the backlog (90+ days open). Both require the Premium plan tier — this is unrelated to the Board\'s own "🔥 Aging" toggle, which is just a visual cue on cards, not this report.',
          },
          {
            step: 5,
            title: 'Custom Builder',
            description:
              'Build your own report: pick a Group By (status, priority, type, assignee, label, sprint, project, phase, or environment), a metric (issue count, story points, or time logged), and a date range. Save configurations for reuse, and export as CSV, Excel, or PDF.',
          },
          {
            step: 6,
            title: 'Scheduled Reports (Premium)',
            description:
              'Set a report to email itself to a recipient list on a daily/weekly/biweekly/monthly cadence, delivered as a PDF at 8am on the scheduled day. Only Admins can create or pause a schedule; anyone can view existing ones.',
          },
        ],
      },
      {
        id: 'okrs',
        title: 'OKRs',
        description: 'Objectives and key results, with AI-scored alignment from Think Tank ideas',
        overview:
          'An OKR here is a title (the Objective) plus a free-text notes field for key results — there\'s no separate structured KR sub-record, just one text box where you\'d typically write "KR1: ..., KR2: ...". The real value is linking ideas to OKRs and letting AI score how well they actually align.',
        icon: '🎯',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Create an objective',
            description:
              'Admin → Products → OKRs → "+ Add OKR." Set the objective title, key-results notes, quarter, status (draft/active/achieved/missed), and a progress percentage.',
          },
          {
            step: 2,
            title: 'Link an idea to an OKR',
            description:
              'From an idea\'s detail page in Think Tank, use "+ Link OKR" to attach it to any active objective.',
          },
          {
            step: 3,
            title: 'Score the alignment',
            description:
              '"AI Score" (or "Re-score" once scored) asks Grok to rate 1-5 how well the idea actually supports that objective, with a short justification — a sanity check against ideas that sound aligned but aren\'t really moving the objective.',
          },
        ],
      },
      {
        id: 'customers',
        title: 'Customers',
        description: 'A lightweight CRM for tracking accounts and tying them to issues',
        overview:
          'This is intentionally minimal — company name, domain, tier, ARR, and notes — not a full CRM. Its real value is linking issues to the customer account affected, so you can see which issues matter to which accounts.',
        icon: '🏢',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Add a customer',
            description:
              'Customers → "+ Add customer" (Admin/Owner only). Set company name, domain, tier (Enterprise/Mid-Market/SMB/Startup/Free), and ARR.',
          },
          {
            step: 2,
            title: 'Link an issue to a customer',
            description:
              'From an issue, link it to the affected customer account — useful for seeing which open issues are tied to your highest-ARR accounts at a glance.',
          },
        ],
        commonIssues: [
          {
            problem: 'A Member can see the customer list but can\'t add or edit one.',
            fix: 'Adding, editing, and deleting customer records is Admin/Owner-only by design — Members and Viewers get read-only access to the list.',
          },
        ],
      },
      {
        id: 'workload-capacity',
        title: 'Workload & Capacity',
        description: 'Two different views — forward-looking planning vs. this-week snapshot',
        overview:
          'There are two workload views and they answer different questions: the personal/team heatmap (Workload in the sidebar) is a forward-looking, multi-week view based on issue due dates and estimates — a planning tool. The admin capacity view (Admin → Team → Workload) is a current-sprint snapshot of logged vs. estimated vs. available hours per person — a management tool. Don\'t confuse one for the other.',
        icon: '📈',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Use the heatmap to plan ahead',
            description:
              'The Workload heatmap shows 16 weeks at a glance, color-coded by how loaded each person is that week based on their assigned issues\' estimates and due dates. Click any cell to see exactly which issues are contributing to that week\'s load.',
          },
          {
            step: 2,
            title: 'Use Admin Workload to check right now',
            description:
              'Admin → Team → Workload shows this week/this sprint: available capacity, hours logged, and hours estimated in the active sprint, per person — flagging anyone at or over capacity.',
          },
          {
            step: 3,
            title: 'Export or drill into one person',
            description:
              'From the admin view, click a member\'s card for a capacity breakdown and a direct link to their issues on the board, or use "Export Report" / "Export Team Report" for a printable summary.',
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
        overview:
          'This is the loop most of your day runs on: pick up work, keep it visible, unblock or get unblocked, close it out. None of these steps are enforced by the system — Forge won\'t stop you from silently working an issue without updating it — but a team that skips comments and blocked-relations consistently ends up needing status meetings to recover the visibility this loop gives you for free.',
        icon: '💻',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Pick up an issue',
            description:
              'In the Board tab, filter by your name using By Assignee. Find an Open issue and drag it to In Progress, or open the issue and change status via the status dropdown. This signals to the team you are actively working on it.',
          },
          {
            step: 2,
            title: 'Update progress with comments',
            description:
              'Post a comment on your In Progress issues with what you did, what is next, and any blockers. Daily updates are lightweight but give PMs visibility without needing a status meeting.',
            tip: 'Paste your branch name or PR link in the issue\'s Link field as soon as you create the branch. Future team members can find the commit history through the issue.',
          },
          {
            step: 3,
            title: 'Block an issue',
            description:
              'If your issue is waiting on another team\'s work, open the issue and add a \'is blocked by\' relation pointing to the blocking issue. Change status to Blocked. PMs see blocked issues in the Reports view and can intervene.',
          },
          {
            step: 4,
            title: 'Move to In Review',
            description:
              'When your code is ready for review, move the issue to In Review and @mention your reviewer in a comment. Paste the PR URL in the Link field. The reviewer will get an Inbox notification.',
          },
          {
            step: 5,
            title: 'Close the issue',
            description:
              'Once the PR is merged and deployed, move the issue to Done. Add a brief resolution comment — what was changed and where. This feeds the velocity report and helps with post-mortems.',
          },
        ],
        commonIssues: [
          {
            problem: 'A blocked issue never seems to get noticed by anyone.',
            fix: 'Blocked status alone is passive — pair it with a comment @mentioning whoever owns the blocking work, or your PM, so it surfaces as a notification rather than something someone has to go looking for.',
          },
        ],
      },
      {
        id: 'think-tank',
        title: 'Think Tank',
        description: 'Submit ideas, vote, and link approved ideas to project issues',
        overview:
          'Think Tank exists for ideas that aren\'t issues yet — a problem worth solving or a feature worth building, before anyone commits real sprint time to it. Writing it up here first (rather than pitching it verbally in standup) means it doesn\'t get lost, and it gives other people a chance to vote or add context before a PM has to make a call.',
        icon: '💡',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Submit an idea',
            description:
              'Open Think Tank in the sidebar. Click New Idea. Write a title, description, and optionally link it to an existing project. Ideas are visible to all workspace members — write clearly so others understand the problem you are solving.',
          },
          {
            step: 2,
            title: 'Vote on ideas',
            description:
              'Browse the idea list and click the thumbs-up on ideas you support. Upvotes surface ideas in the Trending sort. You have unlimited votes but cannot vote on your own ideas.',
            tip: 'Vote on ideas outside your own area — cross-functional upvotes surface ideas with the broadest impact to PMs.',
          },
          {
            step: 3,
            title: 'Comment and refine',
            description:
              'Add technical notes, edge cases, or alternative approaches in the idea\'s comments. Good discussion here shapes the idea before it becomes an issue and saves time in sprint planning.',
          },
          {
            step: 4,
            title: 'Track approved ideas',
            description:
              'When a PM approves an idea, they click Link to Issue. As the submitter you will receive an Inbox notification and can follow the implementation by watching the linked issue.',
          },
        ],
      },
      {
        id: 'idea-canvas',
        title: 'Idea Canvas',
        description: 'A freeform brainstorm board for one idea, with AI critique built in',
        overview:
          'Before an idea has any real structure, the Canvas gives you a blank corkboard to work out Problems, Features, Risks, and Questions as loose cards — not the strict Epic/Sprint/Issue tree the Mind Map uses once there\'s a real project. Any non-viewer can edit it, since it\'s meant as shared scratch space, not the idea\'s official record (title/description editing is still creator/admin-only).',
        icon: '✨',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Open the Canvas',
            description:
              'From an idea\'s detail page, click the ✨ Canvas button next to Export.',
          },
          {
            step: 2,
            title: 'Add cards and connect them',
            description:
              'Use the "Add a thought" panel to drop Problem/Feature/Risk/Question cards anywhere on the board. Drag from a card\'s edge to connect it to another if the relationship matters.',
          },
          {
            step: 3,
            title: 'Test the shape with AI',
            description:
              'Click "Test with AI" to send everything currently on the canvas to Grok for a critique — feasibility, gaps, and what a first sprint should scope in or defer. The response comes back as new dashed "AI suggestion" cards you can add to the board, not just chat text that disappears.',
          },
          {
            step: 4,
            title: 'Convert when it\'s ready',
            description:
              'The canvas doesn\'t auto-convert itself — use the idea\'s normal Convert flow once you\'re happy with the shape. The canvas stays attached to the idea afterward as historical context.',
          },
        ],
      },
      {
        id: 'ai-idea-tools',
        title: 'AI-Powered Idea Tools',
        description: 'Sounding Board chat, consensus synthesis, AI-drafted PRDs, and a devil\'s advocate critique',
        overview:
          'An idea in Think Tank has several distinct AI tools, not one combined "AI button" — each does something different and lives in its own card on the idea\'s detail page. All of them are Grok-backed, all show a disclosure before first use, and all are blocked for Viewers.',
        icon: '🤖',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Sounding Board — a conversation, not a one-shot answer',
            description:
              'Pick a lens (Devil\'s Advocate, Market Fit, Technical Feasibility, Risk Assessment, User Impact, Prioritization, Competitive Landscape, Next Steps — multi-select), optionally add your own text, and click "Ask AI." It\'s rate-limited to 20 calls/tenant/hour, shown right in the header so you know how much room you have left.',
          },
          {
            step: 2,
            title: 'Consensus Builder — once discussion is happening',
            description:
              'Once an idea has at least 3 comments, "Build consensus" summarizes the discussion into what people agree on, what\'s still unresolved, and a recommended next step — useful before a decision meeting instead of re-reading every comment yourself.',
          },
          {
            step: 3,
            title: 'Draft PRD — turn an idea into a structured document',
            description:
              '"Draft PRD ✨" generates Problem Statement, Goals, Success Metrics, User Stories, In/Out of Scope, Technical Notes, Open Questions, and Risks. "Copy as Markdown" gets it into whatever document tool you actually write in.',
          },
          {
            step: 4,
            title: 'Devil\'s Advocate — a standalone challenge',
            description:
              '"🔥 Challenge This Idea" runs the same Devil\'s Advocate lens as the Sounding Board, but as a one-click shortcut with no need to type anything — and it\'s repeatable, not one-time, so you can re-run it after the idea changes.',
          },
          {
            step: 5,
            title: 'Impact/Effort Matrix — score and place ideas visually',
            description:
              'On the Think Tank listing page, click any idea chip to score its Impact (1-5) and Effort (1-5) — it drops into one of four quadrants (Quick Wins, Big Bets, Fill-ins, Money Pits) automatically. Useful for a prioritization conversation across many ideas at once, not just one.',
          },
          {
            step: 6,
            title: 'Import ideas from a competitor\'s page',
            description:
              'Paste a competitor\'s feature page, changelog, or product copy into "📥 Import from competitor" and AI extracts a list of candidate ideas — review the checkboxes, then import the ones actually worth adding as real ideas.',
          },
        ],
        commonIssues: [
          {
            problem: 'The Sounding Board says a rate limit was hit.',
            fix: 'It\'s 20 calls per tenant per hour, shared across everyone using it — wait for the hour to roll over, or check with your team about spacing out AI-heavy sessions.',
          },
        ],
      },
      {
        id: 'using-the-board',
        title: 'Using the Board',
        description: 'Views, filters, and quick-create patterns for developers',
        overview:
          'The Board is where most of your day actually happens, so the difference between fumbling through it and using it well is mostly knowing these few shortcuts exist. Grouping by assignee instead of status is the single biggest one — it turns the board into a standup tool instead of just a status tracker.',
        icon: '🗂️',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Switch to By Assignee view',
            description:
              'Click the View dropdown in the Board header and select By Assignee. Swimlanes appear for each person — useful in standups to see who is overloaded at a glance without a separate report.',
          },
          {
            step: 2,
            title: 'Filter by sprint',
            description:
              'Use the Sprint dropdown above the board to switch between active, past, or upcoming sprints. Past sprint boards are read-only — they are useful for referencing what was shipped in a given sprint.',
          },
          {
            step: 3,
            title: 'Create an issue from the board',
            description:
              'Click + at the top of any column. The quick-create form opens inline — fill in title, type, and priority and press Enter. The issue is added to the active sprint in that column\'s status.',
            tip: 'The By Assignee view with no filters is the fastest way to run a daily standup — each lane is one person\'s update.',
          },
          {
            step: 4,
            title: 'Use labels for cross-cutting concerns',
            description:
              'Apply labels like \'frontend\', \'backend\', \'needs-design\' from the issue card\'s label dropdown. Labels are filterable across all views and appear in the Issues export — useful for tracking tech debt or design debt across sprints.',
          },
        ],
      },
      {
        id: 'pr-risk-overview-developer',
        title: 'PR Risk Overview — What PMs See',
        description: 'Understand the risk dashboard your PM watches so there are no surprises',
        overview:
          'Your PM isn\'t guessing about your blocked or risky work — they have a live dashboard showing exactly what\'s gated and how long it\'s been waiting. Knowing what they see changes how you should communicate: don\'t wait to be asked about a gate, since they already know it exists the moment it opens.',
        icon: '📊',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'The PM has a live risk dashboard',
            description:
              'On Mission Control (the PM morning briefing), there is a PR Risk Overview widget that shows every open risk gate and every medium-risk issue across the tenant. Your PM can see blocked issues, how long they have been waiting, and which ones are overdue — in real time, without you telling them.',
            tip: 'Do not wait for a PM to come to you. If your issue gets gated, comment on it immediately to explain what you are doing to address it. They can see the gate; they want to see you acting on it.',
          },
          {
            step: 2,
            title: 'What shows up as gated',
            description:
              'Any issue where PR Impact returned High or Critical risk is shown in the "Risk Gates — Needs Your Approval" section of the PM dashboard. Your name is not shown on the dashboard, but the issue number and title are. The PM can click straight through to the ticket and see the full AI analysis.',
          },
          {
            step: 3,
            title: 'What shows up as medium risk',
            description:
              'Issues where PR Impact returned Medium risk appear in the "Medium Risk — Monitor" section. These are not blocked — the PM is just watching them. If a medium-risk issue sits open for a while without progress, it will draw attention. Close it cleanly or re-run the analysis after fixing concerns to clear the badge.',
          },
          {
            step: 4,
            title: 'The 24-hour stale timer',
            description:
              'If a High or Critical gate sits open for more than 24 hours without PM review, a red ⏰ stale indicator appears on the dashboard. This is a signal to the PM that someone is waiting. Use it to your advantage — if your gate is stale, nudge your PM directly and reference the ticket number.',
          },
          {
            step: 5,
            title: 'Everything is in the audit trail',
            description:
              'Every PR Impact action — prediction run, gate opened, PM decision, your comments — is logged as a system comment on the ticket. If a PM asks why something was merged or what happened with a risky change, the full history is right there. This protects you as much as it protects the PM.',
          },
        ],
      },
      {
        id: 'pr-impact-developer',
        title: 'PR Impact Prediction',
        description: 'Run AI risk analysis before merging and respond to risk gates on your issues',
        overview:
          'This reads your issue\'s title, description, type, and priority — not the actual diff or CI output — so treat the result as an early warning to think harder about a change, not a verdict on whether it\'s safe. Running it before you move to In Review costs you thirty seconds and can save your PM (and you) an awkward conversation later.',
        icon: '🔬',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Run an analysis',
            description:
              'Open any issue. In the right sidebar under AI Actions, click the PR Impact Prediction button. The AI analyzes the issue title, description, type, and priority, then returns a risk level (Low, Medium, High, or Critical) along with a scope summary, concerns, and suggested actions.',
            tip: 'Run PR Impact before moving an issue to In Review — it gives your reviewer and PM early warning if the change is riskier than it looks.',
          },
          {
            step: 2,
            title: 'Understand the four risk levels',
            description:
              'Low: narrow scope, safe to merge with normal review. Medium: moderate complexity — review the listed concerns before merge, no gate opened. High: significant risk to stability, performance, or security — a gate is opened and the issue is blocked until a PM or Admin approves. Critical: severe risk (data loss potential, security vulnerability, or production outage risk) — same gate workflow as High but with higher urgency.',
          },
          {
            step: 3,
            title: 'Address a High or Critical gate',
            description:
              'When High or Critical risk is detected, a Risk Gate is opened on the issue. You will see an orange or red badge and a system comment explaining the block. The issue cannot be moved to Done until a PM or Admin approves the gate. Your job: review the listed concerns, optionally use "Create action items as sub-issues" to turn suggestions into trackable tasks, then address the concerns and notify the PM.',
            tip: 'Re-run the analysis after fixing the concerns. If the risk drops to Medium or Low, the gate is automatically lifted and no PM approval is needed.',
          },
          {
            step: 4,
            title: 'Create action items from suggestions',
            description:
              'Inside the PR Impact modal, click "Create action items as sub-issues." Forge converts each AI suggestion into a linked sub-issue on the current ticket. Assign them, track them on the board, and resolve them before asking the PM to review the gate.',
          },
          {
            step: 5,
            title: 'Re-run after fixes',
            description:
              'Click Re-analyse at any time. Each run creates a new system comment with the updated result and updates the badge on the ticket. If the new result is Medium or Low on a previously gated issue, the gate lifts automatically — no manual PM step needed.',
          },
        ],
      },
      {
        id: 'ai-actions-on-issue',
        title: 'AI Actions on an Issue',
        description: 'Triage suggestions, an embedded spec/PRD, and formal sign-offs',
        overview:
          'Beyond PR Impact (its own section) and Decompose (covered under PR Overview & Blockers), an issue has a couple more AI and process tools worth knowing about: an AI-suggested triage you can accept or dismiss, and an embedded mini-spec you write yourself.',
        icon: '📋',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Run Triage for a suggested priority and category',
            description:
              '"Triage Issue" reads the title/description and suggests a Priority, Category, a reasoning paragraph, and any likely duplicates it spotted (with a one-click "Mark dup" per candidate). "Accept" applies the suggestion and logs it as an activity comment; "Dismiss" just hides the card.',
          },
          {
            step: 2,
            title: 'Write a spec or mini-PRD directly on the issue',
            description:
              'The Spec / PRD card is a plain Markdown editor — write acceptance criteria or requirements right where the work is being tracked, instead of a separate document that goes stale. Viewers see it read-only.',
          },
          {
            step: 3,
            title: 'Request sign-offs before calling it done',
            description:
              'Admins add named approval roles (e.g. "Design," "Engineering," "Product" — whatever your team needs, not a fixed list) via "+ Add role." Each role gets Approved/Revoke controls, and the card shows "✓ All approved" once every role has signed.',
          },
        ],
      },
      {
        id: 'pr-overview-blockers',
        title: 'PR Overview & Blockers',
        description: 'Linked PRs/commits, blocking relationships, sub-issues, and duplicate merging',
        overview:
          'An issue accumulates real relationships beyond its own status: PRs and commits attached automatically from GitHub, other issues it blocks or is blocked by, sub-issues under it, and duplicates merged into it. These live in a few different cards on the issue detail page rather than one combined panel — worth knowing so you look in the right place.',
        icon: '🔗',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'PRs and commits are automatic, not manual',
            description:
              'The Git card shows Pull Requests and Commits in separate sections, each with a status badge (Merged/Open/Closed for PRs) and an AI-generated summary line where available. These populate entirely from your GitHub webhook — there is no button to manually attach a PR or commit to an issue. If nothing shows up here, check your GitHub integration setup rather than looking for a manual-link option.',
          },
          {
            step: 2,
            title: 'Link a blocking or duplicate relationship',
            description:
              'In the Linked Issues card, click "+ Link issue," choose Duplicate or Blocks, then search by title or key. There is no third manual option in this picker — "relates to" links can only appear if created elsewhere, not chosen here.',
          },
          {
            step: 3,
            title: 'Understand the 🚫 Blocked badge',
            description:
              'This badge is computed live from open "Blocks" links, not a status you set — it appears automatically when any linked blocker isn\'t done yet, and disappears automatically once all blockers are resolved. The issue\'s own status field is untouched either way; you still change status yourself when the work is actually done.',
            tip: 'A red border on the Linked Issues card is the same signal as the badge — either one means something upstream needs to close first.',
          },
          {
            step: 4,
            title: 'Sub-issues are a separate hierarchy from links',
            description:
              'The Sub-issues card is parent/child, not "blocks" — use "+ New" to create a fresh sub-issue under this one, or "Link existing" to attach an issue that already exists. Removing a sub-issue just detaches it (sets its parent back to none); it does not delete the issue.',
          },
          {
            step: 5,
            title: 'Merge a duplicate',
            description:
              '"🔁 Mark as duplicate of…" searches for the original, then — after you confirm — merges the duplicate\'s top-level comments and watchers into the original and closes the duplicate automatically. This is one-way and immediate once confirmed, so make sure you\'ve got the right original before confirming.',
          },
          {
            step: 6,
            title: 'AI Decompose creates real sub-issues',
            description:
              'The Decompose button asks Grok to break the issue into 3-6 draft sub-tasks, which you review and select before creating — accepted drafts become real sub-issues using the exact same parent/child mechanism as "+ New" above, not a separate AI-only structure.',
          },
        ],
        commonIssues: [
          {
            problem: 'A blocking issue was completed but the 🚫 Blocked badge is still showing.',
            fix: 'This badge is derived on page load, not cached — refresh the issue. If it still shows after refresh, confirm the blocking issue\'s status is actually "done," not just "in review."',
          },
          {
            problem: 'Cross-project dependencies aren\'t showing up on the Roadmap.',
            fix: 'Roadmap arcs only come from issue-level "Blocks" links between issues in two different projects — a same-project block, or a "Duplicate"/sub-issue relationship, never produces a roadmap arc, by design.',
          },
        ],
      },
      {
        id: 'comments-decisions',
        title: 'Comments & Decisions',
        description: 'Structured async collaboration with decisions, @mentions, and reactions',
        overview:
          'Most team communication should happen on the issue it\'s about, not in a separate chat thread that a new hire can\'t find six months later. Decisions specifically are worth flagging deliberately — a decision buried in a normal comment gets lost the moment the thread scrolls past it.',
        icon: '💬',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Add a comment',
            description:
              'Open any issue and type in the Comments box at the bottom. Markdown is supported: **bold**, *italic*, `inline code`, and fenced code blocks for snippets. Press Cmd+Enter to submit.',
          },
          {
            step: 2,
            title: 'Mark a decision',
            description:
              'After a key decision is made in comments (e.g. \'We will use Redis not Memcached\'), click the decision flag icon on that comment. Decisions appear in the Decisions tab of the issue for future reference.',
            tip: 'Mark decisions consistently — they are especially useful during post-mortems and when onboarding new team members to a project.',
          },
          {
            step: 3,
            title: 'Use @mentions',
            description:
              'Type @ followed by a teammate\'s name to notify them. They receive an Inbox notification with the issue context. You can @mention anyone in the workspace, not just current issue assignees or watchers.',
          },
          {
            step: 4,
            title: 'React to comments',
            description:
              'Hover a comment and click the emoji button to add a reaction. Common conventions: 👍 = agreed, 👀 = reviewing, ✅ = done. Reactions keep threads from getting clogged with short acknowledgment replies.',
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
        overview:
          'This is the first thing to configure in a new workspace: who is in it, what they can do, and what fields your team fills in on every issue. Get roles right early — changing them later is easy, but a workspace that starts too permissive (everyone an Admin) or too restrictive (everyone a Viewer) creates friction either way. There is no separate "workspace branding" step — Forge does not currently support a custom logo or company name display; the workspace is identified by its URL slug everywhere (emails, exports, the sidebar).',
        icon: '⚙️',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Invite team members',
            description:
              'Go to Admin → Team → Members and click Invite. Enter one or more email addresses and choose a default role: Member for people doing the work, Viewer for stakeholders and clients who only need to watch, Admin for anyone who should manage settings and other members. You can change anyone\'s role later — this just sets where they start.',
            tip: 'It is easier to send one invite batch per role than to invite everyone the same way and fix roles individually afterward.',
          },
          {
            step: 2,
            title: 'Understand what each role can do',
            description:
              'Owner: everything, including billing and removing other Owners/Admins. Admin: manage members, all Admin settings pages, and every project. Member: create and edit issues, comment, use the board — scoped to projects they belong to. Viewer: read-only everywhere. If your workspace has Custom Roles enabled (see Feature Flags below), you can also define narrower roles than these four.',
          },
          {
            step: 3,
            title: 'Change a member\'s role',
            description:
              'In Admin → Team → Members, use the Role dropdown next to their name. This takes effect immediately — no re-login needed. Demoting an Admin to Member instantly removes their access to every Admin settings page, so check they aren\'t in the middle of a config change first.',
          },
          {
            step: 4,
            title: 'Configure custom fields',
            description:
              'In Admin → Team → Fields & Labels, add fields that will appear on every issue in every project: text, number, date, single-select, or multi-select. These are workspace-wide, not per-project — think of them as things every team needs to track (e.g. "Customer Impact") rather than one project\'s special case.',
          },
        ],
        commonIssues: [
          {
            problem: 'An invited member says they never got the email.',
            fix: 'Check spam first — invite emails are the easiest to get filtered. If it\'s genuinely missing, re-invite the same address from Admin → Team → Members; a second invite simply replaces the pending one.',
          },
          {
            problem: 'I demoted the only Admin and now no one can reach Settings.',
            fix: 'Only an Owner can promote someone back to Admin. Keep at least two Owners in any workspace that matters — if the sole Owner is unreachable, no one else can restore Admin access.',
          },
        ],
      },
      {
        id: 'roles-permissions',
        title: 'Roles & Permissions',
        description: 'The four system roles, and how Custom Roles extend them',
        overview:
          'Forge ships with four fixed roles that cover most teams out of the box. If you need finer control — say, a QA lead who should approve sign-offs but not manage billing — turn on the Custom Roles feature flag, which lets you define your own permission sets instead of stretching the built-in four to fit. Most workspaces never need this; start with the fixed roles and only reach for custom roles when you hit a real wall.',
        icon: '🛡',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'The four system roles',
            description:
              'Owner: full control, including billing and removing anyone else including other Admins. Admin: manage members, every Admin settings page, and all projects. Member: create/edit issues, comment, use the board, scoped to their projects. Viewer: read-only everywhere — cannot create, edit, or comment. These are set per member in Admin → Team → Members.',
          },
          {
            step: 2,
            title: 'When to reach for Custom Roles instead',
            description:
              'If your team has a role that needs some Admin-level permissions but not others (e.g. "can manage sprints but not billing or members"), enable Custom Roles in Admin → Subscription → Features & Plan, then build the role in Admin → Team → Roles. Custom roles are additive — they never remove what the four base roles already grant, so turning this on is safe to try.',
          },
          {
            step: 3,
            title: 'Recommended pairings for common titles',
            description:
              'Developers and QA → Member. Product Managers → Member (or Admin if they also manage workspace settings, not just their own projects). Stakeholders and external clients → Viewer. If a title needs something in between — approve-but-not-configure, for instance — that is exactly the case Custom Roles solves.',
          },
          {
            step: 4,
            title: 'Change a member\'s role',
            description:
              'Admin → Team → Members → the Role dropdown next to their name. Takes effect immediately, no re-login required.',
            tip: 'Keep at least two Owners in the workspace. If the sole Owner becomes unreachable, no remaining member can restore Owner-level access.',
          },
        ],
      },
      {
        id: 'feature-flags',
        title: 'Features & Plan',
        description: 'Turn optional product areas on or off for the whole workspace',
        overview:
          'Not every workspace needs every feature — a 5-person team doesn\'t need Timesheet approvals, and a team that isn\'t doing SSO doesn\'t need that nav entry cluttering Settings. Feature flags let you show only what your team actually uses. Toggling a flag off hides the feature from the sidebar for everyone; it does not delete any data already created while it was on.',
        icon: '🚩',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Open Features & Plan',
            description:
              'Go to Admin → Subscription → Features & Plan. You will see every toggleable feature for this workspace with a short description of what it does. Changes take effect immediately for all members — no page reload needed on their end, though they may need to refresh to see the new sidebar entry.',
          },
          {
            step: 2,
            title: 'What is actually toggleable today',
            description:
              'Think Tank (idea capture + voting), Visual Roadmap, Mission Control (cross-project analytics and the Morning Briefing dashboard), Custom Roles (RBAC), SSO/SAML, Webhooks & Integrations, Advanced Reports, PDF/Excel Exports, AI Sprint Intelligence, Advanced AI, My Time (personal timesheets) and its Premium tier (approvals, time-off, billing rates), and Project Portal (timeline/health/costs/sign-offs). Some of these are also gated by your subscription plan — a toggle that appears greyed out usually means it needs a plan upgrade, not a workspace configuration change.',
          },
          {
            step: 3,
            title: 'Roll out gradually if you are unsure',
            description:
              'There is no built-in pilot-group or per-role rollout for a flag — toggling it on turns it on for everyone in the workspace. If you want to trial something with a subset of the team first, the practical approach is to just tell that subset to try it and gather feedback before announcing it more broadly, rather than expecting the platform to gate it by role.',
          },
        ],
      },
      {
        id: 'api-keys',
        title: 'API Keys',
        description: 'Create scoped keys for integrations and automation',
        overview:
          'API keys let external tools (CI pipelines, Zapier, your own scripts) read and write issues without a human logging in. Keys are scoped narrowly on purpose — Forge only exposes read and write scopes for issues, nothing broader. There is no "admin" or settings-changing scope for API keys at all, which means a leaked key cannot be used to change member roles, delete a project, or touch billing — the blast radius of a leaked key is capped by design.',
        icon: '🔑',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Create a key',
            description:
              'Admin → Integrations → API Keys → New Key. Give it a descriptive name (e.g. "GitHub Actions CI" or "Zapier Integration") so a future admin can tell what it\'s for and whether it\'s safe to revoke. The raw key is shown exactly once, immediately after creation — copy it into your secrets manager before closing the dialog, because Forge cannot show it to you again.',
          },
          {
            step: 2,
            title: 'Choose scopes',
            description:
              'Pick issues:read if the integration only needs to pull data (a reporting dashboard, for instance), or add issues:write if it also needs to create or update issues (a CI pipeline filing a bug on failure). There is no broader scope to accidentally over-grant — these two are the whole set today.',
          },
          {
            step: 3,
            title: 'Use the key',
            description:
              'Pass it as a Bearer token in the Authorization header against the workspace\'s REST API. Full endpoint reference lives at /api/docs within your workspace.',
          },
          {
            step: 4,
            title: 'Rotate or revoke',
            description:
              'Keys never expire automatically unless you set an expiry at creation. If a key leaks, revoke it immediately from Admin → Integrations → API Keys — but create the replacement key first if anything depends on it, so the integration doesn\'t go dark mid-swap.',
          },
        ],
        commonIssues: [
          {
            problem: 'A CI job that used to work is now getting 401s.',
            fix: 'Check whether the key was rotated or revoked — Admin → Integrations → API Keys shows every key\'s status. A revoked key returns 401 immediately, with no grace period.',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        description: 'SSO, MFA enforcement, permissions, and the audit log — four separate pages, not one',
        overview:
          'Security configuration in Forge is spread across a few distinct Admin pages rather than one combined "Security" screen — worth knowing so you don\'t go looking for SSO settings on the audit log page. There is also a separate, read-only Security dashboard (Admin → Overview → Security) that shows a security score and posture summary; the actual configuration toggles live under Admin → Security.',
        icon: '🔒',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Configure SSO',
            description:
              'Admin → Security → SSO/SAML. Enter your identity provider\'s SAML metadata or OIDC configuration. Confirm at least one Admin can successfully authenticate through the IdP before you enforce SSO workspace-wide — enforcement disables password login for everyone, so an untested config can lock the whole team out at once.',
            tip: 'Test with a second Admin account before enforcing. If only one person has verified SSO works, that person is now a single point of failure for the whole workspace\'s login.',
          },
          {
            step: 2,
            title: 'Enforce multi-factor authentication',
            description:
              'Admin → Security → Security has the "require MFA" toggle for the workspace. Once enabled, every member must enroll a TOTP authenticator before they can access anything beyond the enrollment screen.',
          },
          {
            step: 3,
            title: 'Review the permission matrix',
            description:
              'Admin → Security → Permissions shows what each role can do across every feature. If Custom Roles is enabled, this is also where new custom roles get their permission sets defined.',
          },
          {
            step: 4,
            title: 'Set SLA policies',
            description:
              'Admin → Automation → SLA Policies — this is a workspace-wide page, not a per-project setting. Create rules like "Critical issues must have a first response within 4 hours"; Forge shows a live countdown on matching open issues and flags breaches in red.',
          },
          {
            step: 5,
            title: 'Review the audit log',
            description:
              'Admin → Overview → Audit Log records member changes, role changes, deletions, and API key activity, each with a timestamp and actor. Use this as your source of truth in a post-mortem or compliance review — it is the one place that shows what actually happened, not what someone remembers happening.',
          },
          {
            step: 6,
            title: 'Set up SCIM provisioning',
            description:
              'On the same SSO/SAML page, the SCIM card generates a bearer token for your identity provider to automatically create and deactivate accounts as people join or leave your IdP directory. The token is shown once — copy it immediately. Revoking it stops your IdP from provisioning or deprovisioning until you generate a new one.',
          },
        ],
      },
      {
        id: 'compliance',
        title: 'Data Requests & Compliance',
        description: 'What a workspace admin can — and can\'t — do for GDPR/CCPA requests',
        overview:
          'Being direct about this because it matters: a workspace Admin does not have a self-serve GDPR export/erasure tool in the tenant app today. Processing a member\'s data-export or right-to-erasure request is handled by Forge\'s own platform team, not from anything inside your workspace settings. If your organization has a compliance obligation with a hard deadline, build the extra lead time for a support round-trip into your process rather than assuming it\'s instant and self-serve.',
        icon: '📋',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'When a member requests their data or deletion',
            description:
              'Submit a request through Admin → AI & Data → Support Queue describing exactly what\'s needed (data export, or right-to-erasure/deletion) and for which member. This routes to Forge\'s platform team, who process it — it is not an action you take directly in your workspace settings.',
          },
          {
            step: 2,
            title: 'What erasure actually does, so you can set expectations',
            description:
              'When processed, the member\'s profile is anonymized (name/email replaced) across issues and comments they authored — their contributions stay in place for team continuity, but their identity is scrubbed. The auth account is deleted so they can no longer log in. This is irreversible once done.',
          },
          {
            step: 3,
            title: 'Use the audit log for your own compliance record',
            description:
              'Admin → Overview → Audit Log is the record you control directly — every member/role change and deletion, with timestamps and actors. Export it for a date range when an auditor or legal team asks for a paper trail of what happened inside your workspace.',
          },
        ],
        commonIssues: [
          {
            problem: 'A member wants proof their data was actually deleted, not just hidden.',
            fix: 'Ask Forge support for confirmation once a deletion request completes — the erasure process itself is not visible from inside your workspace, so the confirmation has to come from the team that ran it.',
          },
        ],
      },
      {
        id: 'wiki-insights',
        title: 'Wiki Insights',
        description: 'Find the gaps in your team wiki by seeing what people searched for and didn\'t find',
        overview:
          'Despite the name, this isn\'t page-view analytics or a stale-content report — it\'s specifically a log of zero-result searches on your Spaces/Wiki content, which is arguably more useful for finding what\'s actually missing than a popularity chart would be.',
        icon: '🔍',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Read it as a content gap list',
            description:
              'Each row is a search term that returned nothing, with how many times it was searched and when it was last tried. A term searched 5+ times and still returning nothing is a real, recurring gap worth writing a page for.',
          },
        ],
      },
      {
        id: 'billing-plan',
        title: 'Billing & Plan',
        description: 'Current plan, seats, and how to upgrade',
        overview:
          'Only Owners can change the billing plan — Admins and everyone else see this page read-only. Upgrading doesn\'t always go through live Stripe checkout yet; if Stripe isn\'t fully configured for your workspace, the request is logged and Forge follows up directly instead.',
        icon: '💳',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Check your current plan and seat count',
            description:
              'The summary strip shows your current tier, status, and active seats. If you\'re on a trial, a banner counts down the days remaining and turns red as it gets close to expiring.',
          },
          {
            step: 2,
            title: 'Change your seat count and upgrade',
            description:
              'Use the seat stepper to set how many seats you need, pick a tier (Basic or Premium are self-serve; Pro and Enterprise are "Coming Soon" — email in instead), and click Activate. You\'ll either land in real Stripe Checkout or get a confirmation that your request was logged and someone will follow up within a business day.',
          },
        ],
        commonIssues: [
          {
            problem: 'A trial expired and features disappeared.',
            fix: 'Nothing is lost — the workspace drops to Basic plan features until you upgrade. Reactivating restores Premium features immediately, using the same data that was already there.',
          },
        ],
      },
      {
        id: 'support',
        title: 'Getting Help from Forge',
        description: 'How to reach the Forge platform team when something needs a human',
        overview:
          'This is how a workspace Admin escalates something to Forge itself — not an internal helpdesk for your own team\'s end users. Use it for anything the docs and your own troubleshooting can\'t resolve: bugs, account-level requests, or the compliance data requests described above.',
        icon: '🎯',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Submit a ticket',
            description:
              'Admin → AI & Data → Support Queue → New Ticket. Set a priority and describe the issue with as much specificity as you can — the affected project/issue key, what you expected, what happened instead. Vague tickets take longer to act on because the first reply is usually just someone asking for the details you could have included up front.',
          },
          {
            step: 2,
            title: 'Track ticket status',
            description:
              'Tickets move through Open → In Progress → Resolved (or Closed). There is no separate "Triaged" state — a ticket is either open and waiting, actively being worked, or done.',
          },
          {
            step: 3,
            title: 'What to expect',
            description:
              'There is no self-service escalation button today — if a ticket feels stuck, the right move is to reply on the ticket itself with any new context (e.g. "this is now blocking our sprint") rather than looking for an Escalate control, since none exists yet.',
          },
        ],
      },
      {
        id: 'timesheets-time-off-rates',
        title: 'Timesheets, Time Off & Rates',
        description: 'Approve submitted timesheets, review time-off requests, and configure billing/cost rates',
        overview:
          'These three admin tools all sit behind the Premium tier of time tracking (`ops_layer_premium`) — a separate gate from the base time-tracking feature that lets members log time at all. If a member can already log time on issues but you can\'t reach these pages, that\'s expected: base logging and these admin tools are gated independently.',
        icon: '💰',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Approve or reject submitted timesheets',
            description:
              'Admin → Team → Timesheets shows each member\'s submitted week with a status pill (submitted/approved/rejected). Approve directly, or Reject with a required note explaining what needs correcting.',
          },
          {
            step: 2,
            title: 'Review time-off requests',
            description:
              'Admin → Team → Time Off lists PTO/Sick/Holiday/Other requests filtered by status. Approve or Reject each — this is independent of the timesheet approval flag above.',
          },
          {
            step: 3,
            title: 'Configure billing and cost rates',
            description:
              'Admin → Team → Rates has two separate tabs: Billing Rates (external, used for client invoicing — can be scoped to a specific project) and Internal Cost Rates (used for margin/profitability tracking, no project scoping). Each rate can apply per-person, per-role, or workspace-wide (Global), with an hourly amount, currency, and an effective-from date.',
          },
        ],
        commonIssues: [
          {
            problem: 'These three pages all show a Premium-plan upsell message instead of the actual tool.',
            fix: 'That\'s the ops_layer_premium flag being off for this workspace — it\'s a separate tier from base time tracking. Upgrading the plan (or asking Forge to enable it) unlocks all three at once.',
          },
        ],
      },
      {
        id: 'recurring-issues',
        title: 'Recurring Issues',
        description: 'Auto-create the same issue every sprint, or every N sprints',
        overview:
          'Useful for the work that repeats on a schedule regardless of what else is planned — a deploy checklist, a security review, a standing audit. Templates seed real issues automatically the moment a sprint starts; there\'s no separate step to "run" them.',
        icon: '🔁',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Create a template',
            description:
              'Admin → Automation → Recurring Issues → "+ New." Set a title, project, schedule (Every sprint, or Every N sprints with N from 2-12), type, priority, and an optional description.',
          },
          {
            step: 2,
            title: 'Pause or resume without deleting',
            description:
              'Toggle a template Active/Paused instead of deleting it if you need to skip a stretch of sprints — paused templates are skipped when a sprint starts, but the template itself stays configured for later.',
          },
        ],
      },
      {
        id: 'integrations',
        title: 'Integrations',
        description: 'GitHub, Slack/Teams/Discord notifications, outbound webhooks, and the SDK/embed options',
        overview:
          'These are four independent integrations, not one combined settings page — worth knowing so you configure the right one for what you actually want (GitHub for PR/commit links on issues, Chat for team notifications, Webhooks for your own systems, SDK/Embed for capturing errors or emailing-in issues from outside Forge entirely).',
        icon: '🔌',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Connect GitHub',
            description:
              'Admin → Integrations → GitHub generates a webhook secret and shows you a URL to paste into your GitHub repo\'s own webhook settings (subscribed to Pull Request and Push events) — the connection is inbound from GitHub, not an OAuth/PAT flow on Forge\'s side. Mention an issue key like FORGE-123 in a PR title or body to link it; use "closes FORGE-123" to auto-close on merge.',
          },
          {
            step: 2,
            title: 'Connect Slack, Teams, or Discord',
            description:
              'Admin → Integrations → Chat — paste an incoming webhook URL per provider to get notifications on issue creation, new comments, and priority-changed-to-Urgent. Separately, a Slack Bot card enables inbound issue creation from Slack itself (a `/forge [title]` slash command and a 🐛 emoji reaction) if you provide a bot token, signing secret, and workspace ID.',
          },
          {
            step: 3,
            title: 'Set up outbound webhooks',
            description:
              'Admin → Integrations → Webhooks lets you register your own endpoint for issue.created, issue.updated, issue.deleted, and comment.created events. Each request is signed (HMAC-SHA256, header `X-Forge-Signature`) so you can verify it actually came from Forge. Use "Send test" before relying on it.',
          },
          {
            step: 4,
            title: 'SDK & Embed — three ways to get data in without the UI',
            description:
              'Admin → Integrations → SDK & Embed covers server-side API calls (create an issues:write API key), a drop-in browser script for automatic error capture (`ForgeSDK.init(...)`), and email-to-issue (an inbound email address per project that turns the subject into a title and the body into a description).',
          },
        ],
      },
      {
        id: 'admin-tools-data',
        title: 'Admin Tools & Data',
        description: 'Engineering Health, AI Usage, Release Notes, and Import/Export',
        overview:
          'A handful of admin-only pages that don\'t fit neatly under Team or Security — a health dashboard, an AI-usage view scoped to Think Tank, an AI release-notes generator, and the two data-movement tools (CSV import, CSV export).',
        icon: '🛠',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Engineering Health',
            description:
              'A dashboard of WIP count, blocked/unowned urgent issues, average cycle time, and weekly throughput, with a plain-language banner ("Board looks healthy" / "WIP is high" / etc.) summarizing overall state.',
          },
          {
            step: 2,
            title: 'AI Usage',
            description:
              'Shows Think Tank Sounding Board activity specifically (calls, input/output tokens this month) broken down by provider and by user — this does not cover every AI feature in Forge, just Sounding Board usage.',
          },
          {
            step: 3,
            title: 'Release Notes generator',
            description:
              'Pick a date range and optional project filter, click "✨ Generate release notes," and Grok categorizes completed issues into New Features / Bug Fixes / Improvements / Breaking Changes with a summary — "Copy as Markdown" to paste it wherever you actually publish release notes.',
          },
          {
            step: 4,
            title: 'Import issues from CSV',
            description:
              'Admin → AI & Data → Import Issues is a 3-step wizard: upload the CSV, map its columns to Forge fields (title is required), then review a preview — including any new categories it detected — before confirming. Rows that already exist (matched by an external ID) are skipped, not duplicated.',
          },
          {
            step: 5,
            title: 'Export data',
            description:
              'Admin → AI & Data → Export Data offers three fixed CSV downloads: Issues, Sprint Report, and Time Logs. For anything beyond these three, use the Custom Report Builder\'s export instead, which supports CSV, Excel, and PDF.',
          },
        ],
      },
    ],
  },
];
