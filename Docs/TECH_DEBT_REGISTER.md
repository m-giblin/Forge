# Forge Tech Debt Register — 2026-07-08

## Executive Summary

Full audit of 102 page.tsx files, 62 API route.ts files, and 23 component .tsx files across the Forge codebase (83 613 total lines). The codebase is in generally good shape for a sprint-1 SaaS product: no debug console.log pollution, no TypeScript compiler errors (tsc passes clean), and no dangerouslySetInnerHTML. Three categories of pre-existing debt were found: 54 ESLint errors (mostly React Compiler violations that don't crash the app but indicate correctness risk), broken internal navigation links, and zero loading.tsx skeletons on any page.

**Fixed this session:** 5 broken links, 2 raw `<a>` → `<Link>` conversions, 6 loading skeletons created.

**Remaining:** 54 ESLint errors across ~40 files, 10+ raw `<img>` instead of next/image, 116 ESLint warnings, 60+ pages still missing loading.tsx, stale orphan files in repo root.

---

## Fixed This Session ✅

| Category | Files Changed | What Was Done |
|---|---|---|
| Broken href (dead links) | reports/cycle-time/page.tsx, reports/aging/page.tsx, reports/scheduled/page.tsx | `/admin/billing` → `/{slug}/billing` — gating screens sent users to a 404 |
| Raw `<a>` → Next.js `<Link>` | think-tank/[id]/IdeaDetail.tsx, admin/roles/page.tsx | Internal navigation using raw anchor tags; added Link import |
| Missing loading.tsx | [tenant]/loading.tsx, board/loading.tsx, issues/loading.tsx, projects/loading.tsx, think-tank/loading.tsx, admin/loading.tsx | Created pulse-animation skeletons for 6 high-traffic page groups |

---

## Remaining Debt

### 🔴 Critical — Fix Before Launch

**1. React Hooks called inside callbacks — design/page.tsx lines 2052, 2117**
- File: `src/app/design/page.tsx`
- Issue: `useState` called inside array `.map()` callbacks — violates Rules of Hooks, will crash at runtime when array length changes
- Fix: Extract each map item into a named component that owns its own state
- Why it matters: Active bug, not just a lint warning

**2. useState called conditionally — design/page.tsx line 231**
- File: `src/app/design/page.tsx`
- Issue: Hook call inside conditional branch — guaranteed to cause subtle state corruption bugs
- Fix: Move hook calls to top of component unconditionally

**3. Components created during render — CustomReportClient.tsx lines 307-322**
- File: `src/app/[tenant]/reports/custom/CustomReportClient.tsx`
- Issue: React Compiler flags `Cannot create components during render` — inline component definitions recreated on every render, breaking reconciliation and memoization
- Fix: Hoist the component definitions outside the parent component function

**4. `<a>` navigating to internal page route — design/workflow/page.tsx line 1507**
- File: `src/app/design/workflow/page.tsx`
- Issue: `<a href="/design">` triggers full page reload instead of client navigation; ESLint flags it 8 times (counts per lint rule variant)
- Fix: Replace with `<Link href="/design">` from next/link

---

### 🟠 High — Fix Within 2 Sprints

**5. setState called synchronously inside useEffect — 12 locations**
- Files: AgingClient.tsx:33, BurndownClient.tsx:35, CycleTimeClient.tsx:49, ScheduledClient.tsx:45, SprintPanel.tsx:34, MorningClient.tsx:82, TimesheetClient.tsx:527, PortalClient.tsx:85, admin/ai/page.tsx:98, MobileSidebar.tsx:74, ReportBugButton.tsx, SpaceViewClient.tsx
- Issue: React Compiler's "Calling setState synchronously within an effect can trigger cascading renders" — causes waterfall re-renders and potential infinite loops under Concurrent Mode
- Fix: Wrap in `setTimeout(() => setState(...), 0)` or restructure effect dependencies; or derive value directly without intermediate state

**6. Cannot access refs during render — SpaceViewClient.tsx line 119**
- File: `src/app/[tenant]/spaces/[spaceId]/SpaceViewClient.tsx`
- Issue: Ref read during render phase — unreliable, will produce inconsistent values with SSR
- Fix: Move ref access into useEffect or event handler

**7. Unused named exports causing dead code — lib/services/**
- Files: `src/lib/services/chatNotifications.ts` (`getWebhookUrl` unused), `src/lib/services/issues.ts` (`_impersonating` unused), `src/lib/services/platform.ts` (`projectsRepo` unused), `src/lib/services/standupDigest.ts` (`projectMap` unused)
- Fix: Delete the dead variables or exports; straightforward 1-line removals

**8. Stale files in repo root**
- Files: `Forge-Academy-Landing.html`, `Forge-Academy-Module1-Animatic.html`, `Forge-Academy-Module1-Script.docx`, `Forge-Academy-Training-Plan.docx`, `Your-First-Forge-Video-Guide.docx`
- Status: Deleted from working tree but not committed — they show as `deleted` in `git status`
- Fix: `git add` the deletions and commit

**9. `require()` imports in test and extension files**
- Files: `src/lib/api/keys.test.ts:38-40`, `forge-vscode/src/extension.ts:23`
- Issue: ESLint `@typescript-eslint/no-require-imports` errors — inconsistent module style, blocks ESLint clean runs
- Fix: Convert to `import` syntax

---

### 🟡 Medium — Fix Within 1 Month

**10. 60+ pages missing loading.tsx**
- All `[tenant]/admin/*`, `[tenant]/reports/*`, `[tenant]/spaces/*`, `[tenant]/time`, `[tenant]/roadmap`, `[tenant]/calendar`, `[tenant]/inbox`, `[tenant]/settings`, `[tenant]/workload`, and most auth/public pages have no loading skeleton
- This session created 6 skeletons for the highest-traffic routes; the rest still show a blank flash on navigation
- Fix: Copy the pulse-animation pattern from the 6 created this session; ~30 min per batch of 10

**11. Raw `<img>` instead of next/image — 10 locations**
- Files: `signup/page.tsx`, `mfa-required/MfaWall.tsx`, `[tenant]/layout.tsx` (sidebar logo), `projects/[key]/WhiteboardsPanel.tsx` (board thumbnails), `components/marketing/LandingPage.tsx` (x2), `login/page.tsx`, `components/MobileSidebar.tsx` (x2), `components/ReportBugButton.tsx` (screenshot preview)
- Issue: No automatic optimization; larger LCP payloads; ESLint warns on each
- Fix: Replace with `<Image>` from `next/image` with explicit width/height; layout logo and landing page logo are highest-impact

**12. `children` passed as prop instead of JSX children — IssuesTable.tsx, IssueDetail.tsx**
- Files: `src/app/[tenant]/issues/IssuesTable.tsx:164`, `src/app/[tenant]/issues/[id]/IssueDetail.tsx:385`
- Issue: `react/no-children-prop` — works at runtime but is an anti-pattern that breaks some tooling
- Fix: Convert `<Component children={x} />` to `<Component>{x}</Component>`

**13. Unescaped quote characters in JSX — 6 locations**
- Files: `IssueDetail.tsx:172`, `SprintPanel.tsx:319`, `ReleaseNotesGenerator.tsx:49`, and 3 more
- Issue: `"` character literal in JSX must be `&ldquo;`/`&rdquo;` or template string; technically valid HTML but ESLint errors
- Fix: `npx eslint --fix` handles these automatically

**14. Unused eslint-disable directives — 4 files**
- Files: `boardMonitor.ts:1`, `morningBriefing.ts:8`, `sla.ts:2`, `standupDigest.ts:8`
- Issue: `// eslint-disable-next-line no-restricted-imports` directives where the rule no longer fires — ESLint reports as errors; creates noise in CI
- Fix: Remove the stale directives

**15. Undefined rule reference — components/AiDisclosureBanner.tsx line 13**
- File: `src/components/AiDisclosureBanner.tsx`
- Issue: ESLint config references `react/no-unstable-default-props` which is not installed — always errors
- Fix: Remove the eslint-disable comment that references the missing rule, or add the rule's plugin

**16. `prefer-const` violation — spaces/[spaceId]/page.tsx:119**
- File: `src/app/[tenant]/spaces/[spaceId]/page.tsx`
- Issue: `accessUrl` declared with `let` but never reassigned — trivial fix
- Fix: Change `let accessUrl` to `const accessUrl`

---

### 🟢 Low / Nice To Have

**17. `any` types in tenant-client.ts**
- File: `src/lib/supabase/tenant-client.ts` lines 32, 37, 42, 51, 58
- Return types on the fluent query builder are typed `: any` — loses type safety on all tenant DB calls
- Fix: Type against Supabase's generated types once the DB schema types are generated

**18. `any` in gitWebhook service**
- File: `src/lib/services/gitWebhook.ts:48`
- `payload: any` parameter — narrow to a union of known GitHub webhook event shapes

**19. `any` cast in IssueKeyExtension**
- File: `src/components/spaces/IssueKeyExtension.tsx:122`
- `props: any` in a ReactNodeViewRenderer callback — low risk (TipTap API) but makes the component untyped

**20. design/workflow/page.tsx — 1547 lines**
- This is a design preview/prototype file. At 1547 lines with duplicate lint errors it should either be cleaned up or excluded from ESLint with `/* eslint-disable */` at the top since it is not production code

**21. FOR_FORGE_publish-metrics.ts orphan file**
- File: `src/app/api/internal/publish-metrics/FOR_FORGE_publish-metrics.ts`
- This appears to be a draft/reference copy sitting next to the real `route.ts`. It will be included in the build. Delete or move to Docs/

---

## Structural Issues (Systemic Patterns)

**React Compiler compatibility gap.** The codebase has 20+ React Compiler lint errors (`Cannot call impure function during render`, `Calling setState synchronously within an effect`, `Cannot create components during render`). These come from `eslint-plugin-react-compiler` which enforces rules needed for React's upcoming compiler optimization. The pattern is pervasive across report clients and board components — it suggests these files were written without the React Compiler ruleset active and haven't been revisited. Each violation is a latent correctness bug under Concurrent Mode even without the compiler enabled.

**No loading.tsx discipline.** The project grew from sprint 1 with no established pattern for loading states. 60+ routes have none. Adding loading skeletons was never in the PR checklist. Establish a rule: every new page.tsx ships with a sibling loading.tsx.

**ESLint not blocking CI.** With 54 errors, `npm run check` exits non-zero but PRs still merge (the errors predate this session). Either enforce `lint-staged` to block merges, or do a single dedicated lint-cleanup sprint to get to zero errors, then enforce from there.

**Oversized files.** Five files exceed 1000 lines (design/page.tsx at 3269, TimesheetClient.tsx at 1330, IssueDetail.tsx at 1214, TimelineClient.tsx at 1096, think-tank/actions.ts at 1095). These are not bugs but will accumulate future debt fastest — any bug fix requires reading a wall of code.

---

## Action Order (Next 3 Sprint Priorities)

1. **React Hooks correctness sweep** — Fix the `useState` in callback (design/page.tsx 2052/2117) and `setState` in effects pattern across the ~12 report/board client files. These are the only issues that can cause silent runtime bugs under React 19 Concurrent Mode. Budget: 1 sprint, 2 engineers, ~4h each.

2. **ESLint zero-errors sprint** — Fix the 54 errors: unescaped entities (auto-fixable), stale eslint-disable directives (delete), `prefer-const` (1 line), `children` prop pattern (2 files), `<a>` → `<Link>` in design/workflow. Goal: `npm run check` exits 0 so CI can enforce it going forward. Budget: 1 day.

3. **Loading skeleton completion** — Create loading.tsx for all remaining admin, reports, spaces, and settings pages using the 6 created this session as a template. Batch 10 at a time per PR. Budget: 2–3h total, can be parallelized.
