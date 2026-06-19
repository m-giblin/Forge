import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";

// Protected dashboard. Proves the human path end-to-end: the page only renders
// the tenants RLS allows this signed-in user to see.
export default async function Home() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  // A regular user with exactly one workspace goes straight to its hub. Super
  // admins (who span tenants) and anyone in multiple workspaces see the picker.
  if (!ctx.isSuperAdmin && ctx.memberships.length === 1) {
    redirect(`/${ctx.memberships[0].tenant.slug}`);
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold tracking-tight text-neutral-900">Forge</span>
          <div className="flex items-center gap-3">
            {ctx.isSuperAdmin && (
              <Link
                href="/admin"
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Platform Admin
              </Link>
            )}
            <span className="text-sm text-neutral-500">{ctx.authUser.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-xl font-semibold text-neutral-900">Your workspaces</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Tenants you belong to. Isolation is enforced by RLS — you only see your own.
        </p>

        {ctx.memberships.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            You&rsquo;re not a member of any workspace yet.
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {ctx.memberships.map((m) => (
              <li key={m.tenant.id}>
                <Link
                  href={`/${m.tenant.slug}`}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm transition hover:border-neutral-300 hover:shadow"
                >
                  <div>
                    <p className="font-medium text-neutral-900">{m.tenant.name}</p>
                    <p className="text-xs text-neutral-400">/{m.tenant.slug}</p>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
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
