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
    <section className="space-y-8">
      {/* ── Server-side API ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Server-side API</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Add a &ldquo;Report issue&rdquo; button to your own app — issues land straight in this workspace.
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
              the snippet into your backend — issues appear here instantly.
            </p>
            <p className="mt-1.5">
              <span className="font-medium">3.</span> Your endpoint:{" "}
              <code className="rounded bg-neutral-100 px-1">{baseUrl}/api/v1/issues</code>
            </p>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <span className="font-semibold">Keep the key server-side.</span> It&rsquo;s a secret with write
            access to this workspace. A browser &ldquo;Report&rdquo; button should call <em>your</em> backend,
            which calls Forge — never put the key in front-end code.
          </div>
          <IntegrationSnippets
            baseUrl={baseUrl}
            projects={projects.map((p) => ({ key: p.key, name: p.name }))}
          />
        </div>
      </div>

      {/* ── Browser SDK (auto error capture) ─────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Browser SDK — auto error capture</h2>
        <p className="mt-1 text-sm text-neutral-500">
          One script tag. Unhandled errors and promise rejections are captured automatically, deduplicated by fingerprint, and filed as issues.
        </p>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 space-y-3 text-sm text-neutral-700">
          <p>
            <span className="font-medium">1.</span> Create an API key with only the{" "}
            <code className="rounded bg-neutral-100 px-1">issues:write</code> scope — this key is safe to expose in the browser.
          </p>
          <p>
            <span className="font-medium">2.</span> Drop this before <code className="rounded bg-neutral-100 px-1">{`</body>`}</code>:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-neutral-950 p-4 text-xs text-neutral-100 leading-relaxed">{`<script src="${baseUrl}/forge-sdk.js"></script>
<script>
  ForgeSDK.init({
    apiKey: "fk_your_key_here",
    endpoint: "${baseUrl}/api/v1/issues",
    projectKey: "${projects[0]?.key ?? "YOUR_KEY"}",
    environment: "production",
    // Optional: suppress noisy errors
    ignoreErrors: [/ResizeObserver/, /ChunkLoadError/],
  });
</script>`}</pre>
          <p className="text-xs text-neutral-500">
            The SDK also exposes <code className="rounded bg-neutral-100 px-1">ForgeSDK.captureError(err)</code> and{" "}
            <code className="rounded bg-neutral-100 px-1">ForgeSDK.captureMessage(msg)</code> for manual reporting from try/catch blocks.
            Identical errors are automatically grouped — you won&rsquo;t get 500 duplicate issues from a single bug.
          </p>
        </div>
      </div>

      {/* ── Email-to-issue ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Email-to-issue</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Forward emails to a project-specific address and they land as issues automatically.
        </p>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 space-y-3 text-sm text-neutral-700">
          <p>
            Set up an inbound email webhook (Postmark, SendGrid, or Mailgun) pointing to:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-neutral-950 p-3 text-xs text-neutral-100">{`POST ${baseUrl}/api/email/inbound`}</pre>
          <p>
            The recipient address encodes the target project:
          </p>
          <div className="space-y-1 rounded-lg bg-neutral-50 border border-neutral-200 p-3 font-mono text-xs text-neutral-700">
            {projects.map((p) => (
              <div key={p.key}>
                <span className="text-neutral-500">{p.key.toLowerCase()}@</span>
                <span className="font-semibold">{slug}</span>
                <span className="text-neutral-500">.yourmaildomain.com</span>
                <span className="ml-2 text-neutral-400">→ {p.name}</span>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="text-neutral-400">No projects yet — create one first.</div>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Set <code className="rounded bg-neutral-100 px-1">INBOUND_EMAIL_SECRET</code> in your environment and configure your mail provider to send it as the{" "}
            <code className="rounded bg-neutral-100 px-1">x-webhook-secret</code> header. Subject becomes the issue title; body becomes the description.
          </p>
        </div>
      </div>
    </section>
  );
}
