import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Policy — Forge",
  description: "How Forge uses AI and handles your data.",
};

export default function AiPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 mb-8 block">
          ← Forge
        </Link>

        <h1 className="text-3xl font-bold text-neutral-900 mb-2">AI Use &amp; Data Policy</h1>
        <p className="text-sm text-neutral-500 mb-10">Last updated: 2026-06-27</p>

        <div className="space-y-8 text-neutral-700">
          <section>
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">What AI features Forge uses</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
              <li><strong>Issue triage</strong> — AI-generated severity suggestions and duplicate detection when a bug is filed.</li>
              <li><strong>Think Tank sounding board</strong> — AI lenses that challenge or expand on ideas you submit.</li>
              <li><strong>Standup &amp; AI digest</strong> — Summaries of open issues and sprint progress sent via email or Slack.</li>
              <li><strong>PR impact prediction</strong> — Risk analysis for linked pull requests.</li>
              <li><strong>Release notes</strong> — AI-generated summaries of completed issues for a date range.</li>
              <li><strong>Support triage</strong> — Initial guidance on incoming support tickets.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Which AI providers process your data</h2>
            <p className="text-sm leading-relaxed">
              By default, Forge routes AI requests to <strong>xAI (Grok)</strong>. Workspace admins can supply their own API keys for
              OpenAI, Anthropic (Claude), Google Gemini, or xAI — in that case, requests go directly to the provider you configure.
              See <Link href="/legal/sub-processors" className="underline text-indigo-700">our sub-processor list</Link> for details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">How your data is used</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
              <li>Issue text, comments, and project names may be sent to your configured AI provider to generate responses.</li>
              <li>No personal financial, health, or government ID data should be entered into Forge issues or comments.</li>
              <li><strong>Your data is never used to train AI models.</strong> We use inference-only API endpoints with zero data retention commitments from providers.</li>
              <li>AI inputs and outputs are logged in <code className="bg-neutral-100 px-1 rounded text-xs">idea_ai_turns</code> / <code className="bg-neutral-100 px-1 rounded text-xs">audit_log</code> for your own auditability. You can request deletion of this data via a GDPR/CCPA data deletion request.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Data retention</h2>
            <p className="text-sm leading-relaxed">
              AI interaction logs are retained for as long as your workspace is active. If you disable AI features in
              <strong> Admin → Settings → AI</strong>, no new AI requests are sent. Workspace owners can delete all AI
              interaction logs by submitting a data deletion request via <strong>Admin → Compliance</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Opting out</h2>
            <p className="text-sm leading-relaxed">
              Workspace owners and admins can disable AI features globally in <strong>Admin → Settings → AI</strong>.
              Individual users cannot opt out of workspace-level AI triage, but can opt out of personal email digests
              in <strong>Account → Preferences</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Contact</h2>
            <p className="text-sm leading-relaxed">
              Questions about AI data handling? Email{" "}
              <a href="mailto:privacy@forge.app" className="underline text-indigo-700">privacy@forge.app</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
