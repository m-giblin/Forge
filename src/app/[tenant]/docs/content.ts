export type DocStep = {
  step: number;
  title: string;
  description: string;
  tip?: string;
};

export type DocSection = {
  id: string;
  title: string;
  description: string;
  icon: string;
  steps: DocStep[];
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
        description: 'Morning dashboard, Inbox, and end-of-day habits for staying on top of work',
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
        icon: '🗂️',
        roles: ['owner', 'admin', 'member', 'viewer'],
        steps: [
          {
            step: 1,
            title: 'Understand the columns',
            description:
              'The Board tab shows the active sprint as a Kanban board. Default columns are Open, In Progress, In Review, and Done. Your admin may have configured additional custom columns via Project Settings.',
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
        description: 'Create projects, configure categories, and invite your team',
        icon: '🏗️',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Create a project',
            description:
              'Go to Projects in the sidebar and click New Project. Enter a name, key (short prefix like FORGE or WEB), and description. The key prefixes all issue identifiers in that project (e.g. FORGE-42) and cannot be changed after issues are created.',
          },
          {
            step: 2,
            title: 'Configure issue categories',
            description:
              'In Project Settings → Categories, add the issue types your team uses (Bug, Feature, Task, Spike, etc.). Categories drive the issue type icon on cards and can be used in filters and reports.',
            tip: 'Keep categories under 6. Too many types cause teams to pick wrong categories, which pollutes velocity reports.',
          },
          {
            step: 3,
            title: 'Set up priority levels',
            description:
              'Forge ships with Critical, High, Medium, Low. In Project Settings → Priorities you can rename or reorder them. Priority affects SLA policy matching — Critical issues typically have the shortest response SLA.',
          },
          {
            step: 4,
            title: 'Invite team members',
            description:
              'In Project Settings → Members, add workspace members to the project. Members not on a project can still see it but cannot create issues or be assigned. Owner and admin roles can manage all projects without explicit membership.',
          },
          {
            step: 5,
            title: 'Configure SLA policies',
            description:
              'In Project Settings → SLAs, create rules that match on priority or category and set response and resolution time targets. Forge shows a live countdown clock on matching issues and highlights breached SLAs in red.',
          },
        ],
      },
      {
        id: 'sprint-management',
        title: 'Sprint Management',
        description: 'Create sprints, fill the backlog, and track velocity over time',
        icon: '⚡',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Create a sprint',
            description:
              'In the Board tab, click Manage Sprints → New Sprint. Set a name (e.g. Sprint 12), start date, and end date. Two-week sprints are the default cadence.',
          },
          {
            step: 2,
            title: 'Add issues to the sprint',
            description:
              'In the Issues list, select issues using the checkbox column, then click Add to Sprint from the bulk action bar. Alternatively drag issues from the Backlog column on the Board view.',
            tip: 'Velocity only counts issues moved to Done before sprint completion. Issues closed after carry-over do not count toward the previous sprint.',
          },
          {
            step: 3,
            title: 'Start the sprint',
            description:
              'Click Start Sprint in Manage Sprints. This locks the sprint scope and starts SLA clocks on all issues in the sprint. The Board will switch to show the active sprint by default.',
          },
          {
            step: 4,
            title: 'Track velocity',
            description:
              'The Reports tab → Velocity Chart shows story points completed per sprint. Use this at planning to set a realistic scope — teams that consistently over-commit burn out; teams that under-commit lose momentum.',
          },
          {
            step: 5,
            title: 'Complete the sprint',
            description:
              'Click Complete Sprint at the end of the sprint period. Forge asks what to do with unfinished issues: move to backlog or carry over to the next sprint. Document the carry-over reason in the sprint notes.',
          },
        ],
      },
      {
        id: 'roadmap-planning',
        title: 'Roadmap Planning',
        description: 'Visualize project timelines, milestones, and dependencies',
        icon: '🗺️',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Open the Roadmap',
            description:
              'Click Roadmap in the sidebar. Projects appear as horizontal bars across a timeline. Use the zoom controls (top-right) to switch between weekly, monthly, and quarterly views.',
          },
          {
            step: 2,
            title: 'Add a project to the roadmap',
            description:
              'Click Add to Roadmap on any project card. Set the planned start and end dates. These are planning dates, not sprint dates — a project\'s roadmap span can cover multiple sprints.',
          },
          {
            step: 3,
            title: 'Set milestones',
            description:
              'Click on a project bar to open its roadmap detail panel. Add milestones (diamonds on the timeline) for major releases or review gates. Milestones trigger a notification to project watchers when their date arrives.',
          },
          {
            step: 4,
            title: 'Link dependencies',
            description:
              'Drag from one project bar end to another project bar to create a dependency arrow. Forge warns you visually if a dependency\'s end date is after the dependent project\'s start date.',
            tip: 'Dependencies are visual only in v1 — Forge does not block sprint creation based on them. Use them for stakeholder presentations and planning conversations.',
          },
        ],
      },
      {
        id: 'pr-risk-gates',
        title: 'PR Risk Gates',
        description: 'Review and approve AI-flagged high-risk changes before they reach Done',
        icon: '🚨',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'What triggers a gate',
            description:
              'When a developer runs PR Impact Prediction and the result is High or Critical risk, Forge automatically opens a Risk Gate on that issue. The issue is blocked — it cannot be moved to Done until the gate is approved or denied by a PM or Admin. Medium risk issues surface as a warning on your dashboard but do not block. The prediction reads the issue\'s title, description, and any linked PR titles — it does not read code diffs or CI results, so it is a judgment aid, not a static analysis tool.',
          },
          {
            step: 2,
            title: 'Find gated issues',
            description:
              'Open Mission Control (the morning briefing page) and look for the PR Risk Overview widget in your PM section. It shows two lists: Risk Gates — Needs Your Approval (blocked issues waiting for review) and Medium Risk — Monitor (open issues flagged medium risk, not blocking). Click any row to jump directly to the ticket.',
            tip: 'The stat strip at the top of Mission Control shows a live Risk Gates count. If it is non-zero at standup time, check it before the daily meeting.',
          },
          {
            step: 3,
            title: 'Review a gated issue',
            description:
              'Open the issue. In the AI Actions sidebar section, you will see the PR Impact badge and a Risk Gate Review panel. Read the AI summary, concerns, and suggestions. Then choose Approve (the issue may proceed to Done) or Deny (the issue remains blocked). A reason is required for either decision.',
            tip: 'A gate older than 24 hours shows a red ⏰ stale indicator on the dashboard. Stale gates mean a developer is waiting — prioritize these.',
          },
          {
            step: 4,
            title: 'Write a useful reason',
            description:
              'The reason you enter is posted as a system comment on the ticket and is permanently visible in the audit trail. If approving: note that you reviewed the concerns and what the developer confirmed was addressed. If denying: be specific about what must be fixed before you will approve — vague denials create back-and-forth.',
          },
          {
            step: 5,
            title: 'The audit trail',
            description:
              'Every PR Impact action is logged as a system comment: prediction run, gate opened, gate approved or denied (with reason and actor), action items created. This trail is permanent — use it in post-mortems, compliance reviews, or to understand the history of a risky change months later.',
          },
          {
            step: 6,
            title: 'When gates auto-lift',
            description:
              'If the developer re-runs the analysis and the result drops to Medium or Low, the gate is lifted automatically without needing your approval. You will see a "gate lifted" system comment on the ticket. The PM Risk Overview widget will remove the issue from the blocked list.',
          },
        ],
      },
      {
        id: 'stakeholder-reporting',
        title: 'Stakeholder Reporting',
        description: 'RAG status, report exports, and weekly automated emails',
        icon: '📊',
        roles: ['owner', 'admin', 'member'],
        steps: [
          {
            step: 1,
            title: 'Open Stakeholder view',
            description:
              'Click Stakeholder in the sidebar. Projects are grouped by RAG status (Red/Amber/Green) with a one-line summary for each. This view is designed for leadership who want portfolio health at a glance.',
          },
          {
            step: 2,
            title: 'Set RAG status',
            description:
              'Click the colored dot next to a project name to cycle through Green, Amber, Red. A text field appears — add a brief status note that stakeholders will see. Keep it to one sentence.',
            tip: 'Update RAG status every Friday before the weekly email sends. Stale green when a project is actually red destroys stakeholder trust fast.',
          },
          {
            step: 3,
            title: 'Export a report',
            description:
              'Click Export in the Stakeholder header. Choose PDF or CSV. The PDF export is formatted for sharing in Slack or email — it includes the RAG status, summary notes, and open issue counts per project.',
          },
          {
            step: 4,
            title: 'Schedule weekly reports',
            description:
              'In Project Settings → Notifications, enable Weekly Stakeholder Email. Forge sends the current RAG snapshot every Monday morning to all project watchers — no manual action required each week.',
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
      },
      {
        id: 'think-tank',
        title: 'Think Tank',
        description: 'Submit ideas, vote, and link approved ideas to project issues',
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
        title: 'Workspace Setup',
        description: 'Configure workspace identity, invite members, and set global defaults',
        icon: '⚙️',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Configure workspace settings',
            description:
              'Go to Settings (gear icon in sidebar). Set workspace name, logo URL, and default timezone. These appear in all email notifications and exported PDF reports — use your company name exactly as stakeholders know it.',
          },
          {
            step: 2,
            title: 'Invite team members',
            description:
              'In Settings → Members, click Invite. Enter email addresses one per line. Choose a default role: Member for developers, Viewer for stakeholders and clients, Admin for team leads. Invites expire after 7 days.',
            tip: 'Send invites in batches by role — it is easier to paste a list of dev emails at once than to change roles individually after the fact.',
          },
          {
            step: 3,
            title: 'Manage roles',
            description:
              'Click a member\'s name to open their profile. Change their role via the Role dropdown. Role changes take effect immediately — no re-login required. Demoting an admin to member removes their access to Settings and all project admin panels.',
          },
          {
            step: 4,
            title: 'Configure custom fields',
            description:
              'In Settings → Custom Fields, add fields that appear on all issues: text, number, date, single-select, or multi-select. Custom fields are workspace-wide and appear in the issue detail panel and CSV exports.',
          },
        ],
      },
      {
        id: 'roles-permissions',
        title: 'Roles & Permissions',
        description: 'System roles control access. Job titles are display labels. Understanding the difference.',
        icon: '🛡',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'The four system roles',
            description:
              'Forge has four permission tiers. Owner: full control — billing, workspace deletion, and managing everyone including other admins. Admin: manage members, settings, projects, and all issues. Member: create and edit issues, comment, and use the board. Viewer: read-only access — can see everything but cannot create, edit, or comment. System roles are set per workspace in Settings → Members.',
          },
          {
            step: 2,
            title: 'Job titles are display-only labels',
            description:
              'Job titles (Developer, PM, QA Engineer, Team Lead, etc.) are organizational labels — they appear on board cards, assignment dropdowns, and the member list. They do NOT change what a person can see or do. A "Team Lead" with a Member role has exactly the same permissions as any other Member. Job titles help teammates identify who is who; system roles control access.',
            tip: 'Think of it this way: system role = what you can do. Job title = who you are. Assign the system role that matches the access level needed, then add the job title for clarity.',
          },
          {
            step: 3,
            title: 'Recommended role pairings',
            description:
              'Common patterns for small to mid-size teams: Developers → Member role. QA Engineers → Member role. Product Managers → Member or Admin role (Admin if they manage sprint scope). Team Leads → Member or Admin depending on whether they need settings access. Stakeholders and clients → Viewer role (read-only, cannot modify anything). External consultants → Viewer or Member depending on their involvement.',
          },
          {
            step: 4,
            title: 'Changing a member\'s role',
            description:
              'Go to Settings → Members. Find the member in the table and use the Role dropdown to change their system role. Role changes take effect immediately — no re-login required. Promoting a Member to Admin gives instant access to Settings; demoting an Admin to Member removes that access immediately.',
            tip: 'Always keep at least two Owners in the workspace. If the sole Owner leaves, you may lose administrative access to billing and workspace settings.',
          },
          {
            step: 5,
            title: 'Setting job titles (AI/Enterprise)',
            description:
              'If your workspace has the Job Titles feature enabled, a Job Title column appears in Settings → Members. Click "Add title…" next to any member and select from the predefined list — Developer, Designer, QA Engineer, Product Manager, Team Lead, Scrum Master, Stakeholder, Consultant, DevOps, Data Analyst. Members can hold multiple titles (e.g. Developer + Team Lead). Titles appear as colored chips on board cards and in the assignment picker.',
          },
        ],
      },
      {
        id: 'feature-flags',
        title: 'Feature Flags',
        description: 'Enable or disable Think Tank, Dashboards, and Roadmap per workspace',
        icon: '🚩',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Access feature flags',
            description:
              'In Settings → Features, you will see all toggleable features for this workspace. Each flag can be enabled globally or restricted by role. Changes take effect instantly — no page reload needed.',
            tip: 'Use feature flags to roll out new features gradually to a pilot group before enabling workspace-wide.',
          },
          {
            step: 2,
            title: 'Enable Think Tank',
            description:
              'Toggle \'Think Tank\' to ON to allow members to submit and vote on ideas. Toggle it OFF to hide the Think Tank sidebar entry for all members instantly. Existing ideas are preserved when the flag is toggled off.',
          },
          {
            step: 3,
            title: 'Enable Dashboards',
            description:
              'Toggle \'Dashboards\' to show the Reports tab in the sidebar. Disable it for workspaces that only need basic issue tracking — fewer tabs reduces cognitive load for smaller teams.',
          },
          {
            step: 4,
            title: 'Enable Roadmap',
            description:
              'The Roadmap feature is gated separately from Dashboards. Enable it only after your projects have enough issues and timeline data to make the visual meaningful. Empty roadmaps confuse stakeholders.',
          },
        ],
      },
      {
        id: 'api-keys',
        title: 'API Keys',
        description: 'Create and manage API keys for integrations and automation',
        icon: '🔑',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Create an API key',
            description:
              'In Settings → API Keys, click New Key. Give it a descriptive name (e.g. \'GitHub Actions CI\' or \'Zapier Integration\'). The key is shown once immediately after creation — copy it to your secrets manager before closing the dialog.',
          },
          {
            step: 2,
            title: 'Set key scopes',
            description:
              'Choose scopes: read (GET only), write (GET + POST + PATCH), or admin (full access including DELETE and settings changes). Use the minimum scope the integration needs.',
            tip: 'Never use admin scope for third-party integrations. If a tool is compromised, admin-scoped keys can delete issues and change member roles.',
          },
          {
            step: 3,
            title: 'Use the API',
            description:
              'The Forge REST API base URL is your workspace URL + /api (e.g. forge.app/acme-corp/api). Pass the key in the Authorization header as \'Bearer YOUR_KEY\'. Full API reference is available at /api/docs within your workspace.',
          },
          {
            step: 4,
            title: 'Rotate or revoke keys',
            description:
              'Keys do not expire automatically. Revoke a key immediately if it is leaked via Settings → API Keys → trash icon. Create a replacement key before revoking to avoid integration downtime.',
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        description: 'SSO, permissions, SLA policies, and the audit log',
        icon: '🔒',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Configure SSO',
            description:
              'In Settings → Security → SSO, enter your identity provider\'s SAML metadata URL or OIDC configuration. Test SSO before enabling enforcement — SSO enforcement prevents password login for all members.',
            tip: 'Enable SSO before enforcing it. Confirm at least 2 admins can authenticate via the IdP before enforcing — otherwise you risk locking everyone out.',
          },
          {
            step: 2,
            title: 'Review the permission matrix',
            description:
              'Settings → Security → Permissions shows what each role (owner/admin/member/viewer) can do across all features. In v1 this matrix is read-only — contact Forge support to request custom permission configurations.',
          },
          {
            step: 3,
            title: 'Set SLA policies',
            description:
              'In Settings → SLA Policies, create rules like \'Critical issues must have a first response within 4 hours.\' Forge tracks these and shows a countdown clock on matching open issues. Breached SLAs are highlighted in red.',
          },
          {
            step: 4,
            title: 'Review the audit log',
            description:
              'Settings → Audit Log shows all significant actions: member added, role changed, issue deleted, API key created. Each entry has a timestamp and actor. Export as CSV filtered by date range for compliance reviews.',
          },
        ],
      },
      {
        id: 'compliance',
        title: 'Compliance',
        description: 'GDPR data requests, audit log exports, and retention configuration',
        icon: '📋',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Handle GDPR data export requests',
            description:
              'When a member requests their data, go to Settings → Compliance → Data Requests. Click New Request, select the member, choose type Export. Forge prepares a ZIP file containing all their issues, comments, and activity within 24 hours.',
          },
          {
            step: 2,
            title: 'Process deletion (right-to-erasure) requests',
            description:
              'Create a Data Request of type Delete. Forge anonymizes the member\'s name and email in all issues and comments (replacing with \'Deleted User\') and permanently deletes their account.',
            tip: 'Deletion is irreversible. Download the member\'s data export first and store it per your legal hold policy before processing the deletion.',
          },
          {
            step: 3,
            title: 'Export the audit log',
            description:
              'The audit log at Settings → Audit Log is the primary record for compliance reporting. Export it as CSV for a given date range to share with auditors or legal teams.',
          },
          {
            step: 4,
            title: 'Configure data retention',
            description:
              'In Settings → Compliance → Retention, configure how long closed issues and audit log entries are retained before automatic deletion. Default is unlimited — set a specific period only if required by your data residency policy.',
          },
        ],
      },
      {
        id: 'support',
        title: 'Support',
        description: 'Submit tickets, use AI triage, and escalate unresolved issues',
        icon: '🎯',
        roles: ['owner', 'admin'],
        steps: [
          {
            step: 1,
            title: 'Submit a support ticket',
            description:
              'In Settings → Support, click New Ticket. Include your workspace slug, steps to reproduce, any error messages, and the affected issue ID (e.g. FORGE-42). Without these details, triage takes significantly longer.',
          },
          {
            step: 2,
            title: 'Use AI triage suggestions',
            description:
              'After submission, Forge AI reviews your ticket and suggests related documentation and known issues. If the AI suggestion resolves your issue, mark the ticket Resolved — it helps train the triage model.',
          },
          {
            step: 3,
            title: 'Check ticket status',
            description:
              'Open support tickets appear in Settings → Support → My Tickets. Status moves Open → Triaged → In Progress → Resolved. You receive an Inbox notification on each status change.',
          },
          {
            step: 4,
            title: 'Escalate an unresolved ticket',
            description:
              'If a ticket is Triaged but has had no human response within 24 hours, click Escalate. This pings the on-call support engineer and upgrades ticket priority to High. Use escalation sparingly to keep it effective.',
          },
        ],
      },
    ],
  },
];
