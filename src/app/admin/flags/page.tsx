import { listGlobalFlags, listAllOverrides } from "@/lib/services/featureFlagsAdmin";
import { listTenants } from "@/lib/services/platform";
import FeatureFlagsConsole from "./FeatureFlagsConsole";

export default async function FlagsPage() {
  // Fail gracefully if migration 0032 hasn't been run yet (table absent) — the
  // console then shows a "run the migration" message instead of crashing.
  const tenants = await listTenants();
  const [flags, overrides] = await Promise.all([
    listGlobalFlags().catch(() => []),
    listAllOverrides().catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-white">Feature flags</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Stage the rollout. The bug tracker (Issues + Board) always ships. A global default gates
        each feature; a per-tenant override lets you give specific workspaces early access.
      </p>
      <FeatureFlagsConsole
        flags={flags}
        overrides={overrides}
        tenants={tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
      />
    </main>
  );
}
