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
    ],
  },
];
