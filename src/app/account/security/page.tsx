import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import MfaPanel from "./MfaPanel";

export default async function SecurityPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Account Security</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage two-factor authentication and login security for your account.
          </p>
        </div>
        <MfaPanel />
      </div>
    </main>
  );
}
