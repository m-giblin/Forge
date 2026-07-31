# Security Audit Fixes — 2026-07-29

Working through all 9 findings from `Docs/Forge-Worx-Security-Audit-2026-07-29.xlsx`, in the order requested: 4 High, 2 Medium, 2 Low, 1 Info. Recommendations already reviewed and approved — proceeding without further check-ins.

---

## High #1 — sla_events cross-tenant RLS gap

**Status: fixed, migration drafted (needs you to run it).**

`supabase/migrations/0122_rls_gap_fixes.sql` (already drafted by the audit agent) drops the "service role manage sla_events" policy — it had no `for`/`to` clause, so it applied to every authenticated user of every tenant, not just the service role, letting anyone read/write/delete any other tenant's SLA events directly via PostgREST.

Verified safe before accepting it as-is:
- Grepped every real access path to `sla_events` (`src/lib/repositories/slaPolicies.ts`, `src/lib/services/sla.ts`) — confirmed the only real caller explicitly uses `createSupabaseServiceClient()` (comment: "service-role: SLA cron needs cross-tenant access"), which bypasses RLS entirely via `BYPASSRLS`. Dropping this redundant policy cannot break any real write path.
- Confirmed the remaining `"members read sla_events"` policy (fixed for the uuid-mismatch bug back in migration `0103`) is correctly tenant-scoped and untouched.
- Noted for the record: migration `0103`'s own comment says this policy was "intentional, not touched" during an earlier RLS sweep — that earlier call was itself the mistake (misreading `using(true)` as "service-role only" when it's actually PUBLIC without an explicit `to` clause). Worth remembering this exact misunderstanding could recur elsewhere.

**Needs you to run**: `supabase/migrations/0122_rls_gap_fixes.sql`.

---

## High #2 — GuestPageClient authorization bypass

**Status: fixed and fully verified. No migration needed.**

Root cause: `src/app/shared/page/page.tsx` (a Server Component) was fetching the full page row — including `body` — and passing it as a prop to the client component `GuestPageClient.tsx`, which only *rendered* it behind a `phase === "view"` gate. React Server Components serialize every prop passed into a Client Component into the initial RSC flight payload sent to the browser on first load, regardless of what the client conditionally renders. So anyone holding a `/shared/page?share=<id>` link could read the real page body straight out of the page source/RSC payload before ever passing the email-domain magic-link gate — the client-side check was cosmetic, not a real authorization boundary.

Fix — moved the real content fetch behind an explicit, separately-authenticated API call:
- New `src/app/api/spaces/guest/content/route.ts`: the only place a guest's page body is ever returned. Requires a `sessionToken` + `shareId`, validates the session against `guest_sessions` (must be un-revoked, unexpired, matching `share_id`) using the same `sha256(token.toLowerCase())` scheme as the existing `verify/session` route, then re-fetches `page_shares` → `pages` (title/body/icon/updated_at/spaces) via the service-role client and returns it only on success.
- `src/app/shared/page/page.tsx`: now selects only cosmetic pre-gate metadata (`title`, `icon`, `space name/icon`) — explicitly no longer selects `body` or `updated_at`. Nothing sensitive is in the initial payload regardless of what the client does with it.
- `src/app/shared/page/GuestPageClient.tsx`: fetches real content client-side via the new route, only after a session token has already passed verification (either a fresh magic-token verify or a valid stored session). Removed the now-dead `sessionToken` state that this refactor made unused.
- Confirmed the existing middleware allowlist (`src/lib/supabase/middleware.ts:85`, `path.startsWith("/api/spaces/guest")`) already covers the new route — no middleware change needed.

Live-verified end-to-end with real test data (a real `page_shares` row against a real Spaces page with real body content, plus real `guest_tokens`/`guest_sessions` rows), all three legs:
1. **Pre-gate leak closed** — raw `curl` of `/shared/page?share=<id>` before any verification: response contains the safe title but zero occurrences of the real body text.
2. **Invalid session rejected** — `POST /api/spaces/guest/content` with a fabricated session token → `401 {"error":"Session expired or invalid."}`.
3. **Valid session serves real content** — `POST /api/spaces/guest/content` with a genuinely valid, correctly-hashed session token → `200` with the real `title`/`body`/`icon`/`updatedAt`/`spaces`.

All test rows (`page_shares`, `guest_tokens`, `guest_sessions`) deleted afterward. `npx tsc --noEmit` and `npx eslint` both clean (one `no-restricted-imports` warning on `page.tsx:1` confirmed pre-existing via `git stash`, left untouched).

Side note for the record: while constructing the test `guest_tokens` row, found the live table has no `email` column (only `email_hash`) even though migration `0083_spaces.sql`'s tracked schema includes one — another instance of the schema-drift pattern already flagged for Task #9 (`ticket_comments`/`request_throttle`). Not a security issue on its own (email_hash-only is actually the more privacy-conscious state), just noting it for whenever the migration history gets reconciled.

**Needs you to run**: nothing — no migration required for this fix.

---

## High #3 — platform_config bug (14 files reference a table that doesn't exist)

**Status: fixed. No migration needed.**

Root cause: 13 files across the codebase queried a table called `platform_config` — it does not exist anywhere in the migration history or the live schema (confirmed via the live PostgREST OpenAPI schema, not just grep). The real per-tenant key-value settings table is `tenant_settings` (migration `0010`, columns `tenant_id`/`key`/`value`, primary key `(tenant_id, key)`). Every one of these reads/writes was silently no-oping: reads always returned no row (falling through to a default), writes always failed against a nonexistent table — and none of the affected call sites checked the returned `{error}`, so the failures were invisible. Concretely this meant: the tenant IP allowlist has never actually enforced (both on the app-proxy path and the API-key gate path), Slack/Teams/Discord webhook config was never persisted, the standup digest / board-health digest cron jobs generated their payloads but never cached them, and the Think Tank "blind voting" toggle and admin notification settings (standup email recipients) silently reset to defaults on every page load.

`src/lib/services/figmaIntegration.ts` was the one file already using the correct `tenant_settings` table (from an earlier fix this session) — its doc comment flagging this exact bug in the other 13 files is what the audit agent picked up on. That comment is now stale and removed.

Fixed, file by file:
- `src/lib/services/ipAllowlist.ts` — `getIpAllowlist`/`saveIpAllowlist`/`clearIpAllowlist` now query `tenant_settings` and throw on `{error}` instead of silently swallowing it.
- `src/lib/services/slack.ts` — `getSlackConfig`/`saveSlackConfig`/`clearSlackConfig`/`getTenantByWorkspaceId` same fix.
- `src/lib/services/chatNotifications.ts` — `getWebhookUrl` (dead/unused, left as-is otherwise), `saveChatWebhook`/`removeChatWebhook`/`getChatWebhooks` same fix.
- `src/lib/services/standupDigest.ts` — digest persistence (`generateStandupDigest`), Slack delivery lookup (`sendStandupToSlack`), email recipient lookup (`sendStandupEmail`), and `getLatestStandupDigest` all fixed.
- `src/lib/services/boardMonitor.ts` — digest persistence and `getLatestBoardHealth` fixed.
- `src/lib/services/morningBriefing.ts` — stale comment only (no query in this file; it reads the standup digest via the now-fixed `standupDigest.ts`).
- `src/lib/api/gate.ts` — the API-key gate's own inline IP-allowlist read was a second, independent copy of the same bug; replaced it entirely with a call to the now-fixed `getIpAllowlist()` helper instead of duplicating the query, so there's exactly one place this logic lives.
- `src/proxy.ts` — same duplication, same fix: the app-level IP-allowlist check (used for every tenant page load, not just the API) now calls `getIpAllowlist()` instead of re-querying `platform_config` directly.
- `src/app/[tenant]/think-tank/page.tsx`, `src/app/[tenant]/admin/think-tank/page.tsx` — blind-voting-setting reads fixed to query `tenant_settings`; added an explicit `console.error` on read failure (kept fail-open/non-throwing here since these are page renders, matching the existing resilience style elsewhere in the app).
- `src/app/[tenant]/admin/think-tank/actions.ts` — `setBlindVotingAction` (a Server Action) now throws on `{error}` so a failed save surfaces to the UI instead of silently no-oping.
- `src/app/[tenant]/admin/notifications/page.tsx`, `src/app/[tenant]/admin/notifications/actions.ts` — these already had the correct generic `tenantSettings.ts` helper (`getTenantSettings`/`setTenantSetting`) in scope for other keys (email branding) but bypassed it with a raw `platform_config` query just for `standup_email_recipients`. Folded that key into the existing helper calls instead — simpler and now correct; the standalone service-role import/read was removed as no longer needed.

Verified: `npx tsc --noEmit` clean project-wide. `npx eslint` on all 13 touched files: 0 errors; the 6 warnings present are all confirmed pre-existing via `git stash`/lint/`git stash pop` (unused `no-restricted-imports` eslint-disable directives and two unrelated unused-var warnings in `chatNotifications.ts`/`standupDigest.ts`) — none introduced by this fix.

No live functional re-test of each downstream feature (Slack notify, digest emails, etc.) was done beyond typecheck/lint, since these are config-persistence bugs with no cross-tenant/security-boundary risk once fixed — the RLS posture on `tenant_settings` (select-only for members, all writes via service-role) was already correct and untouched.

**Needs you to run**: nothing — no migration required for this fix.

---

## High #4 — Next.js 16.2.9 vulnerable to multiple CVEs

**Status: fixed. No migration needed.**

`next@16.2.9` and everything below `16.2.11` carries several disclosed CVEs, most severity high: a middleware/proxy authorization bypass in App Router apps using Turbopack + a single locale (GHSA-6gpp-xcg3-4w24), a Server Actions DoS (GHSA-m99w-x7hq-7vfj), SSRF via Server Actions on custom servers (GHSA-89xv-2m56-2m9x) and via rewrites with an attacker-controlled destination hostname (GHSA-p9j2-gv94-2wf4), plus several moderate cache-confusion and unauthenticated Server-Function-disclosure issues.

Upgraded `next` → `16.2.12` and `eslint-config-next` → `16.2.12` in lockstep (both direct deps, matching versions is required). This is a patch-level bump within the same minor series, not a major version — per this repo's `AGENTS.md` warning that this fork has custom conventions, I treated even a patch bump with real caution: full rebuild, typecheck, lint, and a live browser smoke test rather than assuming a patch bump is risk-free.

Re-running `npm audit` after the bump surfaced two more high-severity issues that were previously masked by the direct Next.js CVEs: `next`'s own bundled `postcss@8.4.31` (path traversal / arbitrary `.map` file disclosure via `sourceMappingURL`, GHSA-r28c-9q8g-f849 and related) and bundled `sharp@0.34.5` (inherited libvips CVEs, GHSA-f88m-g3jw-g9cj). Neither is a direct dependency of this project — both are pinned inside Next's own dependency tree — so fixed them via `package.json` `overrides` (`postcss` → `^8.5.24`, `sharp` → `^0.35.3`) rather than waiting on upstream Next.js to re-bundle newer versions.

Verified:
- `npx tsc --noEmit` clean.
- `npm run build` — full production build succeeds, all routes compile (static + dynamic + the Proxy/Middleware bundle).
- `npx eslint .` — 34 errors present both before and after the upgrade (confirmed via a temporary side-by-side reinstall of the old `16.2.9`/`eslint-config-next@16.2.9` pair, same 34 errors, same rules — all `react-hooks/*` strict-mode findings, pre-existing and unrelated to this bump, out of scope for this fix).
- Live smoke test: restarted the dev server, confirmed `▲ Next.js 16.2.12 (Turbopack)` in the startup banner, loaded `/login` (fully rendered, form interactive), logged in as `founder@forge.dev` (temporarily removed the dev account's MFA enrollment via the repo's existing `scripts/dev-unenroll-mfa.mjs` dev-only helper — a pre-existing tool for exactly this, not something added this session), reached `/travli/board` and confirmed a real, data-heavy authenticated page renders correctly: active sprint burndown, AI Sprint Intelligence banner, backlog counts, SLA banner, all functioning.
- `npm audit` after the fix: 0 findings attributable to Next.js, postcss, or sharp. 4 remaining findings (`brace-expansion`, `exceljs`, `js-yaml`, `uuid`) are unrelated pre-existing issues, already covered by Task #12 (Low priority, next in the queue after Medium).

**Needs you to run**: nothing — no migration required for this fix. `package-lock.json` was updated by `npm install`; you'll want to `git add`/commit `package.json` and `package-lock.json` together when you're ready to commit this batch of fixes.

---

## Medium #1 — ticket_comments/request_throttle schema drift

**Status: fixed, migration drafted (needs you to run it).**

Two tables exist live with zero matching migration file anywhere in `supabase/migrations/` (confirmed via exhaustive case-insensitive grep, not just a quick search): `ticket_comments` and `request_throttle`. This means the tracked schema history — normally the authoritative source for this project — could not confirm whether `ticket_comments` had RLS enabled or any tenant-scoped policy at all. A genuine audit blind spot, not a "found it disabled" finding.

`supabase/migrations/0123_ticket_comments_rls_drop_request_throttle.sql` (drafted, not run):
- `ticket_comments`: enables RLS and adds `ticket_comments_select`/`ticket_comments_insert` policies scoped to `has_tenant_role(tenant_id, ['owner','admin'])` — mirroring the sibling `support_tickets` table's existing policy pattern from migration `0054` exactly, per the audit's own recommendation. Both `alter table ... enable row level security` and `drop policy if exists` + `create policy` are idempotent, so this is safe to run regardless of whatever the live (unknown) prior state actually was.
- `request_throttle`: dropped entirely. Confirmed unused — zero references anywhere in `src/` or `supabase/migrations/` (grepped both), and confirmed live via the audit as 0 rows vs. `rate_limit_buckets` (the real, actively-used rate-limiter table backing `rl_increment()` from migration `0012`) at 760 rows.

Verified before drafting:
- Grepped every real access path to `ticket_comments` (`src/lib/repositories/ticketComments.ts`) and its three callers (`src/app/[tenant]/admin/support/actions.ts`, `src/app/[tenant]/support/actions.ts`, `src/app/admin/support/actions.ts`) — all three go through the service-role client (`BYPASSRLS`), with explicit `tenant_id` filtering everywhere except the intentional cross-tenant super-admin console read. So this fix is defense-in-depth against a hypothetical future anon/JWT-based access path, not a fix for an actively-exploitable hole in current app code.
- Confirmed the live column shapes via the PostgREST OpenAPI schema (not just migration files) before writing the policy: `ticket_comments.tenant_id` FKs to `tenants.id`, `ticket_comments.ticket_id` FKs to `support_tickets.id` — matches the repository's TypeScript type exactly, so the policy's `tenant_id`-based scoping is against the right column.
- `request_throttle`'s live columns (`id`, `bucket`, `created_at`) have no FK relationships to anything else — safe to drop outright, no cascade concerns.

**Needs you to run**: `supabase/migrations/0123_ticket_comments_rls_drop_request_throttle.sql`.

---

## Medium #2 — no rate limiting on /api/signup

**Status: fixed and live-verified. No migration needed.**

`/api/signup` (`src/app/api/signup/route.ts`) is a fully public, unauthenticated endpoint that creates a real Supabase auth user, a new tenant, an owner membership, and starts a 14-day trial — on every single call, with zero rate limiting. An obvious target for mass account creation / spam-trial abuse.

Fixed by applying the project's existing `getRateLimiter()` abstraction (same one already used by `api/spaces/guest/request`, `api/auth/login`, and others) — 10 requests per IP per hour, matching the exact pattern already used for `api/spaces/guest/request`. The check runs first, before any body parsing or validation, so a flood of requests can't even reach the (much more expensive) auth-user-creation path.

Live-verified against the running dev server: sent 11 rapid `POST /api/signup` requests from the same spoofed IP (`X-Forwarded-For`) — the first 10 correctly passed through to normal body validation (`400 "All fields are required."`, since the test payload was intentionally empty to avoid creating real accounts), and the 11th was correctly blocked with `429 {"error":"Too many signup attempts from this IP. Please wait before trying again."}`. Confirmed the limit is IP-scoped, not global: a request from a different spoofed IP immediately after was unaffected (`400`, not `429`).

Scope note: `/api/signup/check-slug` (a lightweight, read-only, non-mutating typeahead lookup used while the user is still typing a workspace name) was left untouched — it wasn't part of the audit finding, doesn't create anything, and rate-limiting it would degrade the real-time typeahead UX for no real security benefit.

`npx tsc --noEmit` and `npx eslint` both clean on the modified file.

**Needs you to run**: nothing — no migration required for this fix.

---

## Low #1 — no magic-number validation on file uploads

**Status: fixed and live-verified. No migration needed.**

`requestUploadUrlAction` (`src/app/[tenant]/issues/[id]/actions.ts`) validated the uploaded file's type by checking the client-declared `contentType` string against an allowlist — but the actual file bytes never pass through app code at all. Uploads go straight from the browser to Supabase Storage via a signed URL (`XMLHttpRequest` PUT in `IssueAttachments.tsx`), so the "content-type check" was purely trusting whatever the client claimed; a spoofed `Content-Type` (or a fetch() call bypassing the UI entirely) would sail straight through with arbitrary bytes stored under a trusted-looking filename/extension.

Fixed by adding a real, server-side check of the actual bytes, after the fact:
- New `src/lib/services/fileSignature.ts` — a small magic-number table for all 8 allowed content types (PNG/JPEG/GIF/WebP/PDF/docx/xlsx/doc/xls). OOXML types (docx/xlsx) and legacy OLE types (doc/xls) each share one container signature, so this confirms "genuinely a zip" / "genuinely an OLE compound file" rather than fully distinguishing docx from xlsx — enough to reject an executable or script renamed with an office extension, without needing to unzip and parse the file.
- New `confirmUploadAction` (`src/app/[tenant]/issues/[id]/actions.ts`) — called by the client immediately after its direct-to-storage upload succeeds. Reads back just the first 16 bytes of the object it now owns in storage via a ranged `fetch()` against the Storage REST API (the storage SDK's `download()` doesn't expose a `Range` header, so this avoids pulling the whole up-to-10MB object down just to check a few bytes), and checks them against the expected signature for the attachment's declared content type. A mismatch deletes both the storage object and the metadata row — no lingering "attachment" pointing at bytes that don't match what it claims to be.
- Added `getById` to `src/lib/repositories/issueAttachments.ts` (needed by the new action; didn't exist before).
- `IssueAttachments.tsx` now calls `confirmUploadAction` right after the XHR upload resolves, and only adds the attachment to the UI if it passes — otherwise it shows the same inline error the existing upload-failure UI already handles.

Live-verified end-to-end against the running dev server, on a real issue (`WEB-150` in the `travli` tenant), using synthetic file uploads (constructed `File`/`DataTransfer` objects dispatched through the real dropzone `<input>`):
1. **Spoofed file rejected**: a plain-text payload declared as `image/png` (`totally-a-photo.png`) uploaded, then was correctly rejected — the UI showed *"This file's content doesn't match its declared type and was rejected."*, and its `issue_attachments` row was confirmed gone from the database afterward (not just hidden in the UI).
2. **Legitimate file accepted**: a real 1×1 PNG (`real-pixel.png`, genuine PNG magic number) uploaded and was correctly accepted, appearing as a normal confirmed attachment with a thumbnail icon.

Test attachment and its storage object were deleted afterward. `npx tsc --noEmit` and `npx eslint` both clean on all four touched files.

**Needs you to run**: nothing — no migration required for this fix.

---

## Low #2 — minor dependency vulnerabilities

**Status: mostly fixed via a targeted override; two moderate findings left as an accepted, documented residual risk. No migration needed.**

Started from `npm audit`'s summary — `brace-expansion` (high), `exceljs` (moderate), `js-yaml` (high), `uuid` (moderate). A first pass of `npm audit fix` (no `--force`) surfaced a much bigger picture than that four-line summary suggested: every one of 17 flagged packages (`eslint`, `@eslint/eslintrc`, `@eslint/config-array`, `eslint-plugin-import`/`jsx-a11y`/`react`, `eslint-config-next`, `minimatch`, `glob`, `readdir-glob`, `rimraf`, `archiver`, `archiver-utils`, `zip-stream`, `exceljs`, `uuid`, plus `brace-expansion` itself) traced back to exactly **one** root CVE — a ReDoS/memory-exhaustion DoS in `brace-expansion` (GHSA-mh99-v99m-4gvg) — fanning out through two independent chains: eslint's own plugin ecosystem, and exceljs's bundled `archiver` (used to zip up generated `.xlsx` files). `js-yaml` resolved itself as a side effect once the eslint chain was current — it wasn't a separate issue.

First attempt (a blanket `overrides: { "brace-expansion": "^5.0.8" }`) **broke `eslint` outright** — `TypeError: expand is not a function` — because `eslint@9`'s own dependency, `minimatch@3.1.5`, expects `brace-expansion`'s old (1.x-line) calling convention, and forcing every consumer to the same v5 release doesn't respect that. Caught immediately by re-running `npx eslint .` right after applying it, before treating the fix as done.

Root-caused and fixed properly with a **nested** override instead of a blanket one — `eslint`'s own chain gets `brace-expansion@^1.1.17` (a real patch within its existing major line), while every other chain (which already tolerates the newer major fine) gets `^5.0.8`:
```json
"overrides": {
  "brace-expansion": "^5.0.8",
  "eslint": { "minimatch": { "brace-expansion": "^1.1.17" } }
}
```
Confirmed `1.1.17` is a genuine security patch — not just a random later 1.x release — by pulling both tarballs (`npm pack brace-expansion@1.1.15 brace-expansion@1.1.17`) and diffing the source directly: it adds an `EXPANSION_MAX_LENGTH` bound and rewrites the recursive expansion into an iterative one, with inline comments explicitly citing CVE-2026-14257. `npm audit`'s own range check (`<=5.0.7`) still flags this instance as vulnerable afterward — but that's a known limitation of GHSA's single-range advisory format, which can't express "patched independently per major line"; it doesn't know `1.1.17` contains the backported fix. Verified this is a tooling limitation, not a real gap, via the source diff above rather than trusting the scanner's count.

Verified nothing broke after the corrected override: `npx tsc --noEmit` clean, `npx eslint .` back to the same 34 errors / 125 warnings baseline (all independently confirmed pre-existing earlier in this session), `npm run build` succeeds, `npx vitest run` — 40/40 tests passing, and a direct functional smoke test of `exceljs` itself (write a real `.xlsx` with a worksheet + row, then read it back and confirm the values round-trip correctly) since its `archiver` dependency was in the affected chain.

**Two residual moderate findings, deliberately left as-is**: `exceljs` and its bundled `uuid@8.3.2`. `exceljs@4.4.0` is already the latest stable release (npm registry only has a `4.4.1-prerelease.0` above it) — there is no newer version to bump to, and `npm audit`'s suggested "fix" (`exceljs@3.4.0`) is an actual downgrade to an older, less-capable version, not a real fix. Checked exceljs's own source for how it actually calls the vulnerable API: it only ever calls `uuidv4()` with no arguments (`node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`) — the CVE itself (GHSA-w5hq-g745-h8pq) is specifically a missing bounds check in `v3`/`v5`/`v6` **when an explicit `buf` parameter is provided by the caller**, which never happens here. Forcing an override to `uuid@11.x` was considered and rejected: `uuid` v9+ changed its export shape from v8, so an override risks a `require`/import mismatch inside `exceljs` similar to the `brace-expansion`/`eslint` breakage just fixed, and there's no upstream `exceljs` release to validate against. Matches the original audit's own framing of this item as "optional, breaking change" — left as an accepted, low-real-world-risk residual, not silently dropped.

The devDependency-only eslint-v10 upgrade path (the "real" fix `npm audit` suggests for the eslint-chain packages) was deliberately not pursued here either, now that the root cause is patched by the override above — it would be a separate, larger effort (eslint 9→10 is a major version, with its own config/rule migration) for a tool that never processes attacker-controlled input in this pipeline (it only lints this repo's own source paths).

**Needs you to run**: nothing — no migration required. `package.json`/`package-lock.json` changes should be committed together with the Task #8 (Next.js) dependency changes.

---

## Info #1 — dead RLS policy on idea_comment_attachments

**Status: fixed, migration drafted (needs you to run it).**

Migration `0021_idea_comment_attachments.sql` created a select policy, `"tenant members read attachments"`, scoped by `memberships.user_id = auth.uid()`. That's the same uuid-mismatch bug migration `0103`'s sweep fixed everywhere else: `memberships.user_id` references `public.users(id)` (the app-level user row), not `auth.uid()` (the Supabase auth user id) — two different uuid spaces, so this policy's condition can never actually match a real row. It's been a permanent, silent no-op since the day it was created.

Migration `0103`'s own sweep added the real, correctly-scoped replacement policy — `"tenant members read idea attachments"` (note the extra word "idea"), using `public.current_app_user_id()`. But its `drop policy if exists "tenant members read idea attachments"` only matches that new name, not the original 0021 policy's name (`"tenant members read attachments"`) — so the dead policy was never actually dropped and has been sitting alongside the correct one ever since, undetected.

Harmless in practice: Postgres combines multiple permissive `select` policies with OR, and the dead one never contributes anything (its condition never matches), so real access has been governed entirely by the correct 0103 policy the whole time. Pure dead-code clutter, not a live security gap — matches the audit's own "Info" severity rating.

`supabase/migrations/0124_drop_dead_idea_comment_attachments_policy.sql` (drafted, not run) drops the dead `"tenant members read attachments"` policy by its exact original name, leaving the correct `"tenant members read idea attachments"` policy untouched.

**Needs you to run**: `supabase/migrations/0124_drop_dead_idea_comment_attachments_policy.sql`.

---

## Summary

All 9 findings from the 2026-07-29 security audit are now addressed: 4 High, 2 Medium, 2 Low, 1 Info. Three migrations are drafted and need you to run them, in order: `0122_rls_gap_fixes.sql`, `0123_ticket_comments_rls_drop_request_throttle.sql`, `0124_drop_dead_idea_comment_attachments_policy.sql`. Everything else (GuestPageClient fix, platform_config→tenant_settings rename, Next.js upgrade, signup rate limiting, upload magic-number validation, dependency overrides) is already live in the codebase with no migration needed — just needs a normal deploy. `package.json`/`package-lock.json` changed (Next.js 16.2.12 + eslint-config-next 16.2.12 + postcss/sharp/brace-expansion overrides) and should be committed alongside the code changes.

