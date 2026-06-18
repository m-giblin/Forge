import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import IntegrationSnippets from "./IntegrationSnippets";

export default async function IntegrationPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const h = await headers();
  const host = h.get("host") ?? "localhost:3100";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const client = ctx.impersonating ? createSupabaseServiceClient() : await createSupabaseServerClient();
  const projects = await projectsRepo(client).listByTenant(ctx.tenant.id);

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Integration</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Add a &ldquo;Report issue&rdquo; button to your own app &mdash; issues land straight in this workspace.
      </p>

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          <p>
            <span className="font-medium">1.</span> Create a key on the{" "}
            <Link href={`/${slug}/admin/api-keys`} className="font-medium text-neutral-900 underline">
              API keys
            </Link>{" "}
            page (give it the <code className="rounded bg-neutral-100 px-1">issues:write</code> scope).
          </p>
          <p className="mt-1.5">
            <span className="font-medium">2.</span> Pick the target project below, store the key as{" "}
            <code className="rounded bg-neutral-100 px-1">FORGE_API_KEY</code> on your server, and drop
            the snippet into your backend &mdash; issues appear here instantly.
          </p>
          <p className="mt-1.5">
            <span className="font-medium">3.</span> Your endpoint:{" "}
            <code className="rounded bg-neutral-100 px-1">{baseUrl}/api/v1/issues</code>
          </p>
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="font-semibold">Keep the key server-side.</span> It&rsquo;s a secret with write
          access to this workspace. A browser &ldquo;Report&rdquo; button should call <em>your</em> backend, which
          calls Forge &mdash; never put the key in front-end code.
        </div>

        <IntegrationSnippets
          baseUrl={baseUrl}
          projects={projects.map((p) => ({ key: p.key, name: p.name }))}
        />
      </div>
    </section>
  );
}
