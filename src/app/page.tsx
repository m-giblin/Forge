import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";
import LandingPage from "@/components/marketing/LandingPage";

export default async function Home() {
  const ctx = await getSessionContext();

  // Unauthenticated visitors see the marketing landing page
  if (!ctx) return <LandingPage />;

  // Single-workspace users go straight to their hub
  if (!ctx.isSuperAdmin && ctx.memberships.length === 1) {
    redirect(`/${ctx.memberships[0].tenant.slug}`);
  }

  // Multi-workspace / super-admin → workspace picker
  return (
    <main className="min-h-screen bg-[var(--fw-cream)] font-[family-name:var(--font-inter)]">
      <header
        className="border-b border-[var(--fw-sidebar-border)]"
        style={{ background: `linear-gradient(170deg, var(--fw-sidebar-1) 0%, var(--fw-sidebar-2) 100%)` }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <span className="font-[family-name:var(--font-manrope)] text-lg font-bold tracking-tight text-[var(--fw-text-bright)]">Forge-Worx</span>
          <div className="flex items-center gap-3">
            {ctx.isSuperAdmin && (
              <Link
                href="/admin"
                className="rounded-lg bg-[var(--fw-rust)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--fw-rust-dark)] transition-colors"
              >
                Platform Admin
              </Link>
            )}
            <span className="text-sm text-[var(--fw-text-dim)]">{ctx.authUser.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-[family-name:var(--font-manrope)] text-xl font-semibold text-[#20201d]">Your workspaces</h1>
        <p className="mt-1 text-sm text-[var(--fw-text-dimmer)]">Select a workspace to continue.</p>

        {ctx.memberships.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--fw-cream-border)] bg-white p-8 text-center text-sm text-[var(--fw-text-dimmer)]">
            You&rsquo;re not a member of any workspace yet.{" "}
            <Link href="/signup" className="text-[var(--fw-rust)] hover:underline">Start a free trial</Link> to create one.
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {ctx.memberships.map((m) => (
              <li key={m.tenant.id}>
                <Link
                  href={`/${m.tenant.slug}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--fw-cream-border)] bg-white px-5 py-4 shadow-sm transition hover:border-[var(--fw-rust)] hover:shadow"
                >
                  <div>
                    <p className="font-medium text-[#20201d]">{m.tenant.name}</p>
                    <p className="text-xs text-[var(--fw-text-dimmer)]">/{m.tenant.slug}</p>
                  </div>
                  <span className="rounded-full bg-[var(--fw-cream-bg)] px-3 py-1 text-xs font-medium text-[#5c584a]">
                    {m.role}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
