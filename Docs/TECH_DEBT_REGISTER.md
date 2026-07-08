# Forge Tech Debt Register — 2026-07-08

Audited: 102 page.tsx, 40+ route.ts, ~70 components, ~84k total lines

---

## Executive Summary

TypeScript compiler is clean (0 errors). No debug console.log pollution. No XSS vectors (zero dangerouslySetInnerHTML). All 100+ nav routes verified to have corresponding page.tsx. The dominant debt is the React Compiler rule set (38 ESLint errors in report/board/admin clients) which flags real correctness risks — setState called synchronously in effects, hooks called conditionally, components created inside render. These predate the compiler migration and need a focused sweep before the first production release.

---

## Fixed This Session ✅

| Category | Files Changed | What Was Done |
|---|---|---|
| Broken billing upgrade links | reports/aging, cycle-time, scheduled | <a> → Link pointing to correct /${slug}/billing (admin/billing doesn't exist) |
| Raw anchor tags for internal nav | think-tank/IdeaDetail.tsx, admin/roles/page.tsx | Converted to Next.js Link |
| Loading skeletons created | [tenant], board, issues, projects, think-tank | 5 new loading.tsx files |
| no-require-imports | src/lib/api/keys.test.ts | require("node:crypto") → top-level ES import |
| no-unescaped-entities | admin/flags/FeatureFlagsConsole.tsx, PlansConsole.tsx | Escaped JSX string quotes |
| prefer-const | src/app/api/spaces/guest/request/route.ts | let accessUrl → const accessUrl |
| no-html-link-for-pages | src/app/design/workflow/page.tsx | Raw anchor → Link for /design route |
| no-children-prop | SpaceViewClient.tsx | Renamed children: PageMeta[] prop → subPages: PageMeta[] |
| M-03 custom_values JSONB | issues.ts, import/actions.ts | sanitizeCustomValues() caps keys (50) and value length (500 chars) |
| HMAC API key script | scripts/issue-api-key.mjs | Was SHA-256, now HMAC-SHA256 matching runtime auth.ts |

---

## Remaining Debt Register

### CRITICAL — Fix Before Launch

**React Compiler violations (38 ESLint errors)**
These are correctness bugs, not style nits. The React Compiler catches patterns that cause cascading re-renders and stale closures.

| File | Lines | Violation | Fix |
|---|---|---|---|
| reports/custom/CustomReportClient.tsx | 61, 237, 307-322 | setState in effect; useState inside callback; components created during render | Refactor chart component creation out of render; move setState after async boundary |
| issues/[id]/IssueTimePanel.tsx | 80 | setState synchronously in effect | Wrap in setTimeout(0) or restructure effect |
| morning/MorningClient.tsx | 82 | Calling impure function during render | Move into useEffect |
| reports/aging/AgingClient.tsx | 33 | setState synchronously in effect | Restructure |
| reports/burndown/BurndownClient.tsx | 35 | setState synchronously in effect | Restructure |
| board/SprintPanel.tsx | 34 | setState synchronously in effect | Restructure |
| issues/[id]/IssueDetail.tsx | 2052 | useState inside callback | Move hook to top level |
| spaces/[spaceId]/SpaceViewClient.tsx | 119 | Cannot access refs during render | Move ref access into useEffect |
| admin/security/page.tsx | 67 | Cannot call impure function during render | Extract to effect |
| admin/release-notes/ReleaseNotesGenerator.tsx | 49 | Cannot call impure function during render | Extract to effect |

**In-memory rate limiter (serverless unsafe)**
- File: src/app/api/me/export/route.ts:8
- Issue: const exportCooldowns = new Map() — module-level Map doesn't persist across Vercel serverless invocations. The 1-hour GDPR export cooldown silently doesn't work in production.
- Fix: Move to Supabase. Small migration: gdpr_export_log(user_id, exported_at). Check last row before proceeding.

**Email/domain inconsistency (brand coherence before launch)**
- Legal pages use both privacy@forge.app and privacy@forge-worx.com
- Outbound Resend from-address uses notifications@forge.app
- Support/billing use hello@forge-worx.com
- Fix: Decide one canonical domain. Extract to src/lib/constants/brand.ts. Update all references.

---

### HIGH — Fix Within 2 Sprints

**No error boundaries anywhere**
- Zero error.tsx files in the entire app. A server component throw shows users a raw Next.js error screen.
- Fix: Add src/app/[tenant]/error.tsx and src/app/admin/error.tsx. These two cover 90% of surfaces. Pattern: display error message + "Try refreshing" button.

**10 raw img tags in production components**
Prevents Next.js image optimization (WebP, lazy loading, CLS prevention).
- src/app/[tenant]/layout.tsx:121 — nav logo (renders on every page — highest priority)
- src/components/MobileSidebar.tsx:101,149 — mobile nav logos
- src/app/login/page.tsx:159 — 256x256 logo (large, no lazy load)
- src/app/signup/page.tsx:154 — logo
- src/components/marketing/LandingPage.tsx:112,594 — logos
- Fix: Replace with next/image Image for all static assets. Add width and height.

**IssueDetail.tsx at 1,214 lines**
- Single file handles: metadata, comments, time logging, attachments, AI triage, custom fields, activity, watchers.
- Fix: Extract IssueMetaPanel, IssueComments, IssueTimeline, IssueAITriage sub-components. Not urgent but blocks parallel sprint work on issue detail features.

---

### MEDIUM — Fix Within 1 Month

**54 pages still missing loading.tsx**
Priority order for high-traffic routes:
1. src/app/[tenant]/timeline/ — Gantt loads significant data
2. src/app/[tenant]/workload/ — member workload calculations
3. src/app/[tenant]/spaces/[spaceId]/ — wiki page tree
4. src/app/[tenant]/reports/velocity/, burndown/, cycle-time/
5. src/app/[tenant]/admin/members/, admin/fields/, admin/security/
6. src/app/admin/tenants/ and src/app/admin/tenants/[id]/

**Unused eslint-disable directives (7 warnings to clean up)**
- src/lib/services/morningBriefing.ts:8 — no-restricted-imports disable no longer needed
- src/lib/services/sla.ts:2 — same
- src/lib/services/standupDigest.ts:8 — same
- src/app/api/search/route.ts:3 — same
- Fix: Remove the directives. Run npm run check to confirm.

**Unused variables (3)**
- src/lib/services/issues.ts:42 — _impersonating assigned but unused
- src/lib/services/platform.ts:7 — projectsRepo imported but unused
- src/lib/services/standupDigest.ts:59 — projectMap built but unused

**Missing eslint plugin rule**
- src/app/[tenant]/admin/think-tank/actions.ts:13 — react/no-unstable-default-props not found
- Fix: npm update eslint-plugin-react

---

### LOW — Nice To Have

**Design prototype pages in production build**
- src/app/design/, src/app/design/admin/, src/app/design/workflow/ are ~5,500 lines of mockup that ship to production (not linked from nav).
- Fix: Move behind env-gated route or exclude from production deploy.

**forge-vscode/out/ included in lint scope**
- Compiled VS Code extension output being linted. Generates noise.
- Fix: Add forge-vscode/out/ to .eslintignore.

**Report download links using raw anchor tags**
- CustomReportClient.tsx:626,630 — Excel and PDF export links correctly use <a> (file downloads) but inconsistent with rest of codebase.
- Fix: Add explicit download attribute. Low priority.

---

## Structural / Systemic Issues

**React Compiler adoption without cleanup**: The codebase uses babel-plugin-react-compiler but many client components still use patterns the compiler flags as unsafe. These need a dedicated sweep sprint.

**No error boundary strategy**: Next.js App Router makes per-route error boundaries trivial to add, but none were added during the initial build. Zero error boundaries means any unexpected throw shows users a raw error screen.

**Monolith client components**: IssueDetail (1,214 lines), TimesheetClient (1,330 lines), CustomReportClient (700 lines) grew as feature-by-feature accumulation. This creates merge conflict risk and makes features harder to test in isolation.

**Email/domain split**: Two domain names (forge.app, forge-worx.com) used interchangeably across legal, support, outbound email, and in-app copy. Needs a business decision + cleanup pass before launch.

---

## Action Order — Next 3 Sprint Priorities

1. **React Compiler sweep** — CustomReportClient, AgingClient, BurndownClient, SprintPanel, IssueTimePanel, MorningClient. Attack file-by-file. Target: 38 errors → 0. Unlocks CI enforcement on the lint gate.

2. **Add error boundaries** — src/app/[tenant]/error.tsx + src/app/admin/error.tsx. Two files, ~30 lines each. Prevents raw error pages from reaching users.

3. **Fix in-memory GDPR export rate limiter** — Move the 1-hour cooldown to a Supabase row. Single-file fix, closes a silent production bug on Vercel.
