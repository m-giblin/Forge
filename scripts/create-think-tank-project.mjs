import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY  = process.env.FORGE_SELF_API_KEY;
const API_URL  = "http://localhost:3100";

const svc = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

// 1. Tenant + founder
const { data: tenant } = await svc.from("tenants").select("id,slug,name").eq("slug","forge").single();
console.log("Tenant:", tenant.name, tenant.id);
const { data: founder } = await svc.from("users").select("id,email").eq("email","founder@forge.dev").maybeSingle();
console.log("Founder:", founder?.email);

// 2. Create project TT
const { data: existing } = await svc.from("projects").select("id,key,name").eq("tenant_id",tenant.id).eq("key","TT").maybeSingle();
let projectId;
if (existing) {
  console.log("Project already exists:", existing.name, existing.id);
  projectId = existing.id;
} else {
  const { data: project, error } = await svc.from("projects").insert({
    tenant_id: tenant.id, key: "TT", name: "Think Tank Solution", lead_user_id: founder?.id ?? null,
  }).select("id,key,name").single();
  if (error) { console.error("Error:", error.message); process.exit(1); }
  console.log("Created project:", project.name, project.key, project.id);
  projectId = project.id;
}

// 3. Create all tickets via API
const post = async (title, description, status, priority) => {
  const r = await fetch(`${API_URL}/api/v1/issues`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, status, priority, type: "task", project: "TT" }),
  });
  const j = await r.json();
  if (!r.ok) { console.error("Issue error:", j); return null; }
  return j.data;
};

console.log("\n--- Creating Sprint 1 tickets (in_progress) ---");

const s1 = [
  ["TT-1: Shared DB Safety Audit + Migration Plan",
   "Before writing any code, audit the existing Supabase schema to confirm no naming conflicts with planned Think Tank tables (think_tanks, ideas, idea_comments, idea_ai_turns). Map foreign key dependencies. Confirm migration order. All migrations must be additive only — no changes to existing tables. Founder signs off before any migration is applied.\n\nAC:\n- No naming conflicts confirmed\n- Migration order documented\n- Each migration identified as purely additive\n- Existing Forge + Travli functionality unaffected\n\n⚠️ DB Risk: Low — read-only audit only.",
   "in_progress", "urgent"],
  ["TT-2: Data Model — Migrations for Think Tank Tables",
   "Create and apply migrations for all Phase 1 tables: think_tanks, ideas, idea_comments, idea_ai_turns. Extend projects table with linked_idea_id (additive only). RLS required on all new tables.\n\nTables:\n- think_tanks (id, tenant_id, name, description, created_by)\n- ideas (id, tenant_id, think_tank_id, title, description, status, is_private, tags[], created_by, assigned_to, linked_project_id, converted_at)\n- idea_comments (id, idea_id, tenant_id, body, author_id, parent_id for threading)\n- idea_ai_turns (id, idea_id, tenant_id, user_id, pills[], user_input, prompt_sent, ai_response, provider)\n- ALTER TABLE projects ADD COLUMN linked_idea_id (IF NOT EXISTS)\n\nAC:\n- All 4 tables created with correct columns + FK constraints\n- RLS enabled on all new tables including is_private visibility rules\n- schema_migrations entries inserted\n- NOTIFY pgrst reload schema run after each table\n- npm run test:isolation + npm run test:api pass\n\n⚠️ DB Risk: Medium — new tables + one column addition to projects.",
   "in_progress", "urgent"],
  ["TT-3: AIService Abstraction Layer",
   "Build src/lib/services/ai.ts (server-only) with provider routing, prompt construction, pill-to-prompt mapping, and injection protection.\n\nRequirements:\n- GrokProvider + ClaudeProvider behind common interface\n- Provider selected from tenant config (default: Grok)\n- Pill definitions in src/lib/ai/pills.ts — 8 starter pills\n- Prompt structure: [SYSTEM] → [IDEA CONTEXT - user data] → [DISCUSSION SUMMARY - user data] → [PILL INSTRUCTIONS] → [USER FREE TEXT]\n- User content injected as quoted data, never as bare instructions (injection protection)\n- Context management: if idea+comments exceed 80% of token limit, summarize older comments (keep last 20 verbatim)\n- Rate limit check before every call\n- Retry once on timeout\n- Server-only — API keys never reach client\n\nAC:\n- AIService interface implemented\n- Both providers working\n- Pill mapping in one maintainable file\n- Prompt injection protection verified\n- Unit tests for prompt construction\n\n⚠️ DB Risk: None.",
   "in_progress", "high"],
  ["TT-4: Think Tank UI — Listing Page + Empty State",
   "Main Think Tank landing page at /{tenant}/think-tank. Shows all ideas, create button, filters, search.\n\nAC:\n- Route /{tenant}/think-tank exists and is in sidebar nav\n- Idea cards show: title, status badge (color-coded), assigned to, tags, comment count, last activity\n- Filter by: status, tag, assigned-to\n- Search by title + description (debounced)\n- Private ideas show lock icon; non-admins cannot see others' private ideas\n- Empty state: illustration + explanation + 'Create your first idea' CTA (not a blank page)\n- First-time onboarding banner if tenant has 0 think_tanks: explains the Idea→Discuss→AI→Project flow\n- Responsive layout\n\n⚠️ DB Risk: None — read-only.",
   "in_progress", "high"],
  ["TT-5: Idea CRUD + Status Workflow",
   "Create, view, edit, archive ideas. Status workflow: new → researching → maturing → ready → converted (terminal) | archived (terminal).\n\nAC:\n- Create form: title (required), description (markdown), tags, assigned-to, private toggle\n- Idea detail page: /{tenant}/think-tank/{idea-id}\n- Edit: creator + admin only\n- Status transitions: forward-only from UI (can't go backward from converted/archived)\n- Archive: moves to archived, hidden from default list (accessible via filter)\n- is_private toggle: only creator + owner/admin can see private ideas\n- Assigned-to: any tenant member\n- Tags: free-form text[], comma-separated input\n- Ideas get a key: TT-1, TT-2 etc. (consistent with issue key pattern)\n\n⚠️ DB Risk: None beyond TT-2 migrations.",
   "in_progress", "high"],
  ["TT-6: Threaded Comments on Ideas",
   "Discussion threads on ideas. One level of nesting. No file attachments in Phase 1.\n\nAC:\n- Comments in chronological order, replies indented under parent\n- Reply button opens inline reply box\n- Edit own comment within 15 minutes of posting (locked after)\n- Delete own comment: soft delete, shows [deleted] placeholder to preserve thread\n- Admin can delete any comment\n- @mention highlights tenant member names (notifications Phase 2)\n- Markdown rendering in comment body\n- Comment count shown on idea card\n- Pagination: 50 comments, load more for older\n- No file attachments (Phase 2)\n\n⚠️ DB Risk: None beyond TT-2.",
   "in_progress", "high"],
  ["TT-7: AI Sounding Board — Pill-Driven, Single-Turn",
   "The core AI interaction surface on the idea detail page. Pills + free text → AIService → structured response.\n\nAC:\n- 'AI Sounding Board' section on idea detail page\n- 8 pills displayed as multi-select chips (highlight when selected)\n- Free text input (optional — pills alone are sufficient)\n- 'Ask the AI' button disabled until at least one pill or free text present\n- Loading state: spinner + Thinking… text\n- Response in styled card with markdown rendering\n- Previous AI responses shown as collapsible history (newest first)\n- Each history entry: date, pills used, first 2 lines + expand to full\n- Error states: timeout → user-friendly message; rate limit → retry time shown\n- AI turn saved to idea_ai_turns after every successful response\n- Context sent: idea title + description + last 20 comments + older summary if any\n\n⚠️ DB Risk: None beyond TT-2.",
   "in_progress", "high"],
  ["TT-8: AI Security — Prompt Injection + Rate Limiting + Disclosure",
   "Security ticket. Must be complete before TT-7 moves to in_review.\n\nAC:\n- Prompt injection protection: system instructions and user-supplied content cleanly separated with explicit delimiters. User content never treated as instructions.\n- Prompt structure enforced in AIService: [SYSTEM] [IDEA CONTEXT - user provided] [DISCUSSION SUMMARY - user provided] [PILL INSTRUCTIONS] [USER QUESTION - user provided]\n- Rate limiting: AI endpoint protected by existing rate limiter. Default 20 calls/tenant/hour. Super-admin configurable per tenant.\n- Data residency disclosure: first AI interaction per user shows dismissible banner: 'Your idea content will be sent to [Provider] for analysis. Do not include information you are not authorized to share externally.' Stored per user (localStorage) so only shown once.\n- Audit trail: every AI call writes to idea_ai_turns including full prompt sent and response received\n- Security review checklist completed and noted in ticket comment before close\n\n⚠️ DB Risk: Low — uses localStorage for disclosure preference to avoid schema change.",
   "in_progress", "urgent"],
  ["TT-9: Basic Idea Search",
   "Search across ideas within a tenant. Respects visibility (private ideas only visible to creator + admins).\n\nAC:\n- Search input in Think Tank listing header\n- Searches: title, description, tags (case-insensitive, partial match)\n- Respects is_private RLS — other users' private ideas never appear\n- Results update as user types (debounced 300ms)\n- Highlights matched term in results\n- 'No results' empty state\n\n⚠️ DB Risk: None — read-only.",
   "in_progress", "medium"],
  ["TT-10: Convert Idea to Project",
   "One-button conversion of a matured idea to a Forge project. Fast and simple — no wizard in Phase 1.\n\nSpec:\n- What transfers: title → project name, description → project description, tags → notes\n- What does NOT transfer: comments, AI turns, linked issues (Phase 2)\n- Idea after conversion: status = converted (terminal), shows link to project, no further field editing (comments still allowed)\n\nAC:\n- Convert button visible only when status = ready and not already converted\n- Confirmation modal before proceeding\n- Creates new project via existing createProject service\n- Sets ideas.linked_project_id + ideas.status = converted + ideas.converted_at\n- Sets projects.linked_idea_id (reverse link)\n- Success toast + 'View Project →' link\n- Error: idea state unchanged (atomic)\n- Audit log entry created\n\n⚠️ DB Risk: Low — uses existing project creation path. Requires linked_idea_id column from TT-2.",
   "in_progress", "medium"],
  ["TT-11: RLS Audit — All Phase 1 Think Tank Tables",
   "Dedicated RLS verification pass before Phase 1 is called done. Not part of TT-2 — this is a separate review and test pass.\n\nAC:\n- Document which RLS policies exist on each new table and what they allow/deny\n- Test with two different tenant users: confirm zero cross-tenant data leakage\n- Test is_private: non-admin member cannot see another member's private idea\n- Test converted idea: read-only for non-admins post-conversion\n- npm run test:isolation — all 6 checks pass\n- npm run test:api — all checks pass\n- Any gap found → fixed before Phase 2 begins\n\n⚠️ DB Risk: None — may result in RLS policy corrections only.",
   "in_progress", "high"],
];

for (const [title, desc, status, priority] of s1) {
  const issue = await post(title, desc, status, priority);
  if (issue) console.log(`  ✅ ${issue.key}: ${issue.title.substring(0,60)}`);
  else console.log(`  ❌ Failed: ${title.substring(0,60)}`);
}

console.log("\n--- Creating Sprint 2 tickets (todo) ---");

const s2 = [
  ["TT-P2-1: Persistent AI Conversation History (Multi-Turn)", "Store and resume AI context across sessions within an idea. User can continue a prior AI conversation. Context strategy: last 5 AI turns verbatim + running summary of older turns per idea. Multi-turn context sent to AI on each new request.", "todo", "high"],
  ["TT-P2-2: AI Context Summarization (Automated)", "When idea context approaches provider token limit, auto-generate and store a rolling summary. Summary updated on each new AI turn. Prevents silent context window overflow.", "todo", "high"],
  ["TT-P2-3: Idea Voting / Ranking", "Up-vote only (thumbs up). Vote count visible. Anonymous to other members (admins can see voter list for moderation). One vote per idea per member. Remove vote allowed. Vote button on idea card + detail page.", "todo", "medium"],
  ["TT-P2-4: Staleness Indicators + Review Dates", "Last activity relative timestamp on idea cards. Optional review-by date per idea. Visual indicator when review date has passed. No automated emails — visual only in Phase 2.", "todo", "medium"],
  ["TT-P2-5: Notifications for Think Tank", "Wire Think Tank events into existing Forge notification system. Events: new comment on idea you created or are assigned to, @mention in comment, idea status changed by someone else, idea converted to project.", "todo", "medium"],
  ["TT-P2-6: Custom Pills Per Tenant", "Tenant admin can add/edit/remove AI pills in Admin → Think Tank Settings. Default pills always present and cannot be deleted. Custom pills appear after defaults. Stored in think_tank_pills table per tenant.", "todo", "medium"],
  ["TT-P2-7: Idea Templates", "3-4 default templates seeded at Think Tank creation: Product Feature, Process Improvement, New Market Opportunity, Technical Debt. Each pre-populates description structure and suggests default pills. Tenant admin can create custom templates in Phase 3.", "todo", "low"],
  ["TT-P2-8: File Attachments on Comments", "Images and documents on comments. Security requirements: type allowlist (pdf, png, jpg, gif, docx, xlsx — no executables), 10MB per file, 100MB/tenant/month, tenant-scoped storage, signed expiring download URLs (24hr), no public URLs.", "todo", "medium"],
  ["TT-P2-9: Export Idea to Document", "Export a single idea (title, description, comments, AI turn summaries) to PDF or .docx. For sharing with stakeholders not in the system.", "todo", "low"],
  ["TT-P2-10: Audit Log Integration for AI Turns", "Surface idea_ai_turns data in the tenant Activity Log (Admin → Activity). Filter by AI interaction event type. Admins see who asked what, when, and which pills were used.", "todo", "medium"],
  ["TT-P2-11: BYO LLM Key Schema (Design Only)", "Design and create encrypted key storage schema (tenant_ai_keys table) so Phase 3 BYO LLM doesn't require a schema rework. Table created, UI not built until Phase 3. Keys: AES-256-GCM encrypted, never logged, never in API responses.", "todo", "high"],
];

for (const [title, desc, status, priority] of s2) {
  const issue = await post(title, desc, status, priority);
  if (issue) console.log(`  ✅ ${issue.key}: ${issue.title.substring(0,60)}`);
  else console.log(`  ❌ Failed: ${title.substring(0,60)}`);
}

console.log("\n--- Creating Phase 3 / Backlog tickets ---");

const s3 = [
  ["TT-P3-1: BYO LLM Support (Tenant-Level AI Provider Config)", "Full tenant-level AI provider configuration in Admin → Settings → AI Provider. Options: Platform Default (Grok), Premium (Claude Sonnet), BYO (user API key). Encrypted key storage from TT-P2-11. Key rotation without downtime. Keys never in logs/responses.", "backlog", "medium"],
  ["TT-P3-2: Usage & Cost Tracking Per Tenant", "Track AI call counts and estimated token cost per tenant per month. Super-admin sees all tenants. Tenant owner/admin sees own usage. Configurable soft caps (warning) and hard caps (blocks AI calls).", "backlog", "medium"],
  ["TT-P3-3: Decision Capture (Formal Decisions Table)", "decisions table linked to ideas and projects. Append-only (content hash on creation, audit trail on modification). Mark as Decision action in comment thread. Referenced in project conversion and portals.", "backlog", "medium"],
  ["TT-P3-4: Wiki-Style Project Portal", "Secure document space per project. Optionally created at idea-to-project conversion, pre-populated with idea content, AI summaries, and decisions. Collaborative editing (one editor at a time with lock), rich text, version history.", "backlog", "low"],
  ["TT-P3-5: AI Facilitator Mode", "Proactive AI suggestions: idea stale >14 days with no AI interaction → suggest a pill. Thread reaches 20+ comments with no AI → offer Summarize. Opt-in per tenant.", "backlog", "low"],
  ["TT-P3-6: Idea Maturation Scoring", "Automated scoring of idea completeness: description length, comment count, AI interactions, assigned-to, status age. Score as progress bar on idea card. Suggests next action based on score.", "backlog", "low"],
  ["TT-P3-7: Advanced Think Tank Permissions", "Fine-grained permissions within Think Tanks beyond owner/admin/member: Contributor (comment only), Viewer (read-only). Configurable per Think Tank.", "backlog", "low"],
  ["TT-P3-8: Cross-Idea Intelligence (Similar Ideas)", "AI-powered similar ideas surfacing when creating a new idea. Prevents duplicate effort. Keyword + semantic similarity.", "backlog", "low"],
  ["TT-P3-9: Custom Idea Templates (Tenant-Created)", "Full template editor in Admin. Custom fields per template type. Extends Phase 2 defaults.", "backlog", "low"],
];

for (const [title, desc, status, priority] of s3) {
  const issue = await post(title, desc, status, priority);
  if (issue) console.log(`  ✅ ${issue.key}: ${issue.title.substring(0,60)}`);
  else console.log(`  ❌ Failed: ${title.substring(0,60)}`);
}

console.log("\n✅ Done. Think Tank Solution project populated.");
