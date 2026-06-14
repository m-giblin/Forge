import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/super-admin";
import SignOutButton from "@/components/SignOutButton";

// Hard gate: anyone who isn't a platform super admin is bounced to "/" with no
// confirmation the console exists.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sa = await requireSuperAdmin();
  if (!sa) redirect("/");

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-lg font-bold tracking-tight text-white">
              Forge
            </Link>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">
              Platform Admin
            </span>
            <nav className="ml-3 flex items-center gap-1">
              <Link href="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800">
                Tenants
              </Link>
              <Link href="/admin/audit" className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800">
                Audit
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
              Exit to app
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
