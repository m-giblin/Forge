import { connection } from "next/server";
import LoginPageClient from "./LoginPageClient";

// CSP nonces require dynamic rendering (Next.js docs, Content-Security-Policy
// guide: "Static Rendering Requirement"). A statically-prerendered page's
// HTML is generated once at build time with no nonce, then served verbatim
// by the CDN alongside a freshly per-request-generated CSP header from
// proxy.ts — the browser has no reason to trust any script tag on the page
// and blocks every single one. Confirmed live on production: zero script
// tags carried a nonce attribute at all, so no JS ever ran, so the entire
// sign-in flow was dead for anyone without an already-valid session.
//
// The usual fix (`export const dynamic = "force-dynamic"`) did NOT work
// here even after a clean rebuild — this page has no server-side data
// fetch of its own for Next's static analysis to key off, and the plain
// client component behind it (Suspense + useSearchParams) wasn't enough
// to keep it out of static optimization on this Next version. `connection()`
// is next/server's other documented mechanism for the same requirement —
// it forces a real per-request wait, which is what actually removed the
// page from the static route list on rebuild.
export default async function LoginPage() {
  await connection();
  return <LoginPageClient />;
}
