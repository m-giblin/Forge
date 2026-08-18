import { connection } from "next/server";
import SignupPageClient from "./SignupPageClient";

// See src/app/login/page.tsx for the full explanation — nonce-based CSP
// requires dynamic rendering, and `connection()` is the mechanism that
// actually achieved it on this Next version (plain `export const dynamic
// = "force-dynamic"` did not, even after a clean rebuild).
export default async function SignupPage() {
  await connection();
  return <SignupPageClient />;
}
