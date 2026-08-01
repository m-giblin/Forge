import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
// eslint-disable-next-line no-restricted-imports -- impersonation client-select: ctx.impersonating chooses service vs user JWT, all DB calls go through repos (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import IntegrationSnippets from "./IntegrationSnippets";
import WidgetEmbed from "./WidgetEmbed";
import PageHeader from "@/components/patterns/PageHeader";
import Note from "@/components/patterns/admin/Note";

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
    <div className="space-y-6 pb-8">
      <PageHeader title="SDK & Embed" subtitle="Drop the Forge widget into your own product" />

      <div className="space-y-8 px-6">
        {/* ── Browser SDK / widget embed ───────────────────────────────────── */}
        <div>
          <h2 className="text-[12.5px] font-bold text-[#20201d]">Browser SDK — auto error capture</h2>
          <p className="mt-1 text-[11.5px] text-[#726e60]">
            One script tag. Unhandled errors and promise rejections are captured automatically, deduplicated by
            fingerprint, and filed as issues.
          </p>
          <div className="mt-4">
            <WidgetEmbed baseUrl={baseUrl} projectKey={projects[0]?.key ?? "YOUR_KEY"} />
          </div>
          <p className="mt-3 text-[11px] text-[#a19d90]">
            The SDK also exposes <code className="font-mono">ForgeSDK.captureError(err)</code> and{" "}
            <code className="font-mono">ForgeSDK.captureMessage(msg)</code> for manual reporting. Identical errors
            are automatically grouped.
          </p>
        </div>

        {/* ── Server-side API ───────────────────────────────────────────────── */}
        <div>
          <h2 className="text-[12.5px] font-bold text-[#20201d]">Server-side API</h2>
          <p className="mt-1 text-[11.5px] text-[#726e60]">
            Add a &ldquo;Report issue&rdquo; button to your own app — issues land straight in this workspace.
          </p>
          <div className="mt-4 space-y-4">
            <div className="fw-card px-4 py-4 text-[12.5px] text-[#4a473e]">
              <p>
                <span className="font-semibold">1.</span> Create a key on the{" "}
                <Link href={`/${slug}/admin/api-keys`} className="font-semibold text-[#b7452f] hover:underline">
                  API keys
                </Link>{" "}
                page (give it the <code className="font-mono">issues:write</code> scope).
              </p>
              <p className="mt-1.5">
                <span className="font-semibold">2.</span> Pick the target project below, store the key as{" "}
                <code className="font-mono">FORGE_API_KEY</code> on your server, and drop the snippet into your
                backend — issues appear here instantly.
              </p>
              <p className="mt-1.5">
                <span className="font-semibold">3.</span> Your endpoint: <code className="font-mono">{baseUrl}/api/v1/issues</code>
              </p>
            </div>
            <Note icon="⚠" tone="warning">
              <span className="font-semibold">Keep the key server-side.</span> It&rsquo;s a secret with write
              access to this workspace. A browser &ldquo;Report&rdquo; button should call <em>your</em> backend,
              which calls Forge — never put the key in front-end code.
            </Note>
            <IntegrationSnippets
              baseUrl={baseUrl}
              projects={projects.map((p) => ({ key: p.key, name: p.name }))}
            />
          </div>
        </div>

        {/* ── Email-to-issue ────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-[12.5px] font-bold text-[#20201d]">Email-to-issue</h2>
          <p className="mt-1 text-[11.5px] text-[#726e60]">
            Forward emails to a project-specific address and they land as issues automatically.
          </p>
          <div className="mt-4 fw-card px-4 py-4 space-y-3 text-[12.5px] text-[#4a473e]">
            <p>Set up an inbound email webhook (Postmark, SendGrid, or Mailgun) pointing to:</p>
            <pre className="overflow-x-auto rounded-[6px] bg-[#20201d] p-3 text-[11px] text-[#e8e4d8]">{`POST ${baseUrl}/api/email/inbound`}</pre>
            <p>The recipient address encodes the target project:</p>
            <div className="space-y-1 rounded-[6px] border border-[#e3ded0] bg-[#f4f2eb] p-3 font-mono text-[11px] text-[#4a473e]">
              {projects.map((p) => (
                <div key={p.key}>
                  <span className="text-[#a19d90]">{p.key.toLowerCase()}@</span>
                  <span className="font-semibold">{slug}</span>
                  <span className="text-[#a19d90]">.yourmaildomain.com</span>
                  <span className="ml-2 text-[#a19d90]">→ {p.name}</span>
                </div>
              ))}
              {projects.length === 0 && <div className="text-[#a19d90]">No projects yet — create one first.</div>}
            </div>
            <p className="text-[11px] text-[#a19d90]">
              Set <code className="font-mono">INBOUND_EMAIL_SECRET</code> in your environment and configure your
              mail provider to send it as the <code className="font-mono">x-webhook-secret</code> header. Subject
              becomes the issue title; body becomes the description.
            </p>
          </div>
        </div>

        {/* ── Comments & time tracking ──────────────────────────────────────── */}
        <div>
          <h2 className="text-[12.5px] font-bold text-[#20201d]">Comments &amp; time tracking</h2>
          <p className="mt-1 text-[11.5px] text-[#726e60]">
            Read an issue&rsquo;s comment thread, or log/read time against it, from outside Forge — useful for a
            sync integration, a billing system, or a CI pipeline leaving status updates.
          </p>
          <div className="mt-4 fw-card px-4 py-4 space-y-4 text-[12.5px] text-[#4a473e]">
            <div>
              <p className="font-semibold text-[#20201d]">Comments</p>
              <p className="mt-1 text-[11px] text-[#a19d90]">
                <code className="font-mono">issues:read</code> to list, <code className="font-mono">issues:write</code> to post.
              </p>
              <pre className="mt-2 overflow-x-auto rounded-[6px] bg-[#20201d] p-3 text-[11px] text-[#e8e4d8]">{`GET  ${baseUrl}/api/v1/issues/{id}/comments
POST ${baseUrl}/api/v1/issues/{id}/comments`}</pre>
            </div>
            <div>
              <p className="font-semibold text-[#20201d]">Time logs</p>
              <p className="mt-1 text-[11px] text-[#a19d90]">
                <code className="font-mono">issues:read</code> to list, <code className="font-mono">issues:write</code> for the rest.
                <code className="font-mono ml-1">user_id</code> must be an existing member of this workspace, not an email.
              </p>
              <pre className="mt-2 overflow-x-auto rounded-[6px] bg-[#20201d] p-3 text-[11px] text-[#e8e4d8]">{`GET    ${baseUrl}/api/v1/issues/{id}/time-logs
POST   ${baseUrl}/api/v1/issues/{id}/time-logs
PATCH  ${baseUrl}/api/v1/issues/{id}/time-logs/{logId}
DELETE ${baseUrl}/api/v1/issues/{id}/time-logs/{logId}`}</pre>
            </div>
            <p className="text-[11px] text-[#a19d90]">
              Full request/response examples and field reference: see{" "}
              <Link href={`/${slug}/docs`} className="font-semibold text-[#b7452f] hover:underline">
                API docs
              </Link>{" "}
              → API reference → Comments / Time tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
