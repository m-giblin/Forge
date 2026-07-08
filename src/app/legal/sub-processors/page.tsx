import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sub-processors — Forge",
  description: "List of third-party sub-processors used by Forge to deliver the service.",
};

const UPDATED = "2026-07-08";

const SUB_PROCESSORS = [
  {
    vendor: "Supabase, Inc.",
    purpose: "Hosted PostgreSQL database, authentication, and file storage",
    location: "United States (AWS us-east-1)",
    link: "https://supabase.com/privacy",
  },
  {
    vendor: "Vercel, Inc.",
    purpose: "Application hosting and edge network (Next.js runtime)",
    location: "United States / Global CDN",
    link: "https://vercel.com/legal/privacy-policy",
  },
  {
    vendor: "xAI (X Corp.)",
    purpose: "AI language model inference (Grok) for AI Digest, Standup summaries, and Think Tank features",
    location: "United States",
    link: "https://x.ai/privacy",
  },
  {
    vendor: "Postmark / ActiveCampaign, Inc.",
    purpose: "Transactional email delivery (inbound email-to-issue, notifications)",
    location: "United States",
    link: "https://postmarkapp.com/privacy-policy",
  },
  {
    vendor: "Slack Technologies (Salesforce)",
    purpose: "Optional Slack bot notifications (per-tenant, opt-in only)",
    location: "United States",
    link: "https://slack.com/intl/en-gb/privacy-policy",
  },
];

export default function SubProcessorsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 mb-8 block">
          ← Forge
        </Link>

        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Sub-processors</h1>
        <p className="text-sm text-neutral-500 mb-8">Last updated: {UPDATED}</p>

        <div className="prose prose-neutral max-w-none">
          <p className="text-neutral-700 leading-relaxed">
            Forge uses the following sub-processors to deliver its services. Each sub-processor is
            required, under their own standard data protection terms, to process personal data only on
            documented instructions and under appropriate technical and organisational measures. Where a
            sub-processor supports EU/UK data transfers, we rely on their published Standard Contractual
            Clauses (SCCs); dedicated Forge-executed DPAs with individual sub-processors are being put in
            place on a rolling basis and are not yet complete for every vendor listed below.
          </p>

          <p className="text-neutral-700 leading-relaxed">
            We will notify you of any new sub-processors or material changes to this list with at least
            30 days&apos; notice via email and in-app notification.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Purpose</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {SUB_PROCESSORS.map((sp) => (
                <tr key={sp.vendor} className="hover:bg-neutral-50/60">
                  <td className="px-4 py-4 font-medium text-neutral-900 align-top whitespace-nowrap">
                    <a href={sp.link} target="_blank" rel="noopener noreferrer" className="hover:underline text-indigo-700">
                      {sp.vendor}
                    </a>
                  </td>
                  <td className="px-4 py-4 text-neutral-700 align-top">{sp.purpose}</td>
                  <td className="px-4 py-4 text-neutral-500 align-top whitespace-nowrap">{sp.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 rounded-xl border border-indigo-100 bg-indigo-50 p-6">
          <h2 className="text-sm font-semibold text-indigo-900 mb-1">Request a Data Processing Agreement with Forge</h2>
          <p className="text-sm text-indigo-800 mb-4">
            This is separate from the sub-processor terms above — it&apos;s the agreement between{" "}
            <strong>your organisation and Forge</strong> covering how we process your data. If you need a
            signed DPA (e.g. for GDPR compliance), email us at{" "}
            <a href="mailto:privacy@forge.app" className="underline font-medium">privacy@forge.app</a>.
            We will respond within 5 business days with a standard DPA for review and countersignature.
          </p>
          <p className="text-xs text-indigo-600">
            For GDPR purposes, Forge acts as a Data Processor for customer data and as a Data Controller
            for account and billing data. Standard Contractual Clauses (SCCs) are available on request for
            international data transfers.
          </p>
        </div>

        <p className="mt-8 text-xs text-neutral-400">
          Questions? Contact <a href="mailto:privacy@forge.app" className="underline">privacy@forge.app</a>
        </p>
      </div>
    </div>
  );
}
