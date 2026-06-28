import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy – Forge",
  description: "How Forge collects, uses, and protects your personal data.",
};

const EFFECTIVE_DATE = "June 28, 2026";
const CONTROLLER = "Forge-Worx, Inc.";
const CONTACT_EMAIL = "privacy@forge-worx.com";
const DPA_CONTACT = "privacy@forge-worx.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-neutral-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-neutral-400 mb-10">Effective date: {EFFECTIVE_DATE}</p>

      <Section title="1. Who we are">
        <p>
          {CONTROLLER} (&quot;Forge&quot;, &quot;we&quot;, &quot;us&quot;) operates the Forge issue-tracking platform at
          forge-worx.com. We are the data controller for personal data processed through the platform.
          Contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="2. Data we collect">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account data:</strong> name, email address, profile photo.</li>
          <li><strong>Workspace data:</strong> issues, comments, attachments, and other content you create.</li>
          <li><strong>Usage data:</strong> page views, feature interactions, session timestamps.</li>
          <li><strong>Technical data:</strong> IP address, browser type, device identifiers.</li>
          <li><strong>Communication data:</strong> support tickets and messages you send to us.</li>
        </ul>
      </Section>

      <Section title="3. Lawful basis for processing (EU/UK users)">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left py-2 pr-4 font-semibold">Processing activity</th>
              <th className="text-left py-2 font-semibold">Lawful basis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <Row a="Providing the platform and account management" b="Contract (Art. 6(1)(b) GDPR)" />
            <Row a="Sending transactional emails (password reset, invitations)" b="Contract (Art. 6(1)(b) GDPR)" />
            <Row a="Security logging and fraud prevention" b="Legitimate interest (Art. 6(1)(f) GDPR)" />
            <Row a="Product analytics and improvement" b="Legitimate interest (Art. 6(1)(f) GDPR)" />
            <Row a="Compliance with legal obligations" b="Legal obligation (Art. 6(1)(c) GDPR)" />
            <Row a="AI feature processing (triage, Think Tank)" b="Contract + Legitimate interest" />
          </tbody>
        </table>
      </Section>

      <Section title="4. How we use your data">
        <ul className="list-disc pl-5 space-y-1">
          <li>To provide, maintain, and improve the Forge platform.</li>
          <li>To authenticate you and secure your account.</li>
          <li>To send service-related notifications (no marketing without consent).</li>
          <li>To analyse aggregate usage and improve product features.</li>
          <li>To comply with legal and regulatory obligations.</li>
        </ul>
      </Section>

      <Section title="5. AI features">
        <p>
          Forge uses AI providers (currently xAI / Grok) for features including issue triage,
          Think Tank idea analysis, and digest generation. Issue text and idea content may be
          sent to these providers for processing. AI providers do not use your data to train
          their models. See our <Link href="/legal/ai-policy" className="underline">AI Use Policy</Link> for
          full details, including how to opt out of specific AI features.
        </p>
      </Section>

      <Section title="6. Data retention">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left py-2 pr-4 font-semibold">Data type</th>
              <th className="text-left py-2 font-semibold">Retention period</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <Row a="Account and workspace data" b="For the duration of your subscription, plus 90 days after account closure" />
            <Row a="Audit logs (actor labels)" b="3 years (legal obligation)" />
            <Row a="Security logs (IP, failed logins)" b="90 days" />
            <Row a="AI turn data" b="Retained until you request deletion or close your account" />
            <Row a="Support tickets" b="3 years" />
            <Row a="Backups" b="30 days rolling" />
          </tbody>
        </table>
      </Section>

      <Section title="7. Sub-processors">
        <p>
          We share data with a limited set of sub-processors necessary to operate the platform.
          See our <Link href="/legal/sub-processors" className="underline">Sub-Processor List</Link> for the
          current list including Supabase (database), Vercel (hosting), xAI (AI), Postmark (email),
          and Resend (transactional email). All sub-processors are bound by Data Processing Agreements.
          Standard Contractual Clauses (SCCs) are available on request at{" "}
          <a href={`mailto:${DPA_CONTACT}`} className="underline">{DPA_CONTACT}</a>.
        </p>
      </Section>

      <Section title="8. International transfers">
        <p>
          Forge is hosted on infrastructure located in the United States. If you are based in the
          EU/EEA or UK, your personal data is transferred to the US under Standard Contractual
          Clauses (EU Commission Decision 2021/914). Contact us to receive a copy.
        </p>
      </Section>

      <Section title="9. Your rights">
        <p className="mb-3">
          Depending on your location, you may have the following rights regarding your personal data:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Access (Art. 15 GDPR):</strong> Request a copy of your data via Account → Settings → Privacy → Download my data, or email us.</li>
          <li><strong>Rectification (Art. 16 GDPR):</strong> Correct inaccurate data via Account Settings, or email us.</li>
          <li><strong>Erasure (Art. 17 GDPR / CCPA):</strong> Request deletion via Account → Settings → Privacy → Request account deletion, or email us.</li>
          <li><strong>Restriction (Art. 18 GDPR):</strong> Request that we restrict processing while a dispute is pending. Email us.</li>
          <li><strong>Portability (Art. 20 GDPR):</strong> Receive your data in a structured, machine-readable format. Use the Download my data link above.</li>
          <li><strong>Objection (Art. 21 GDPR):</strong> Object to processing based on legitimate interests. Email us.</li>
          <li><strong>CCPA:</strong> California residents may request disclosure, deletion, or opt-out of sale of personal information. Forge does not sell personal information.</li>
        </ul>
        <p className="mt-3">
          We will respond to all verifiable requests within 30 days (extendable by 60 days for
          complex requests). To exercise your rights: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="10. Complaints">
        <p>
          EU/EEA residents have the right to lodge a complaint with their local supervisory authority.
          A list of EU data protection authorities is available at{" "}
          <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" className="underline" target="_blank" rel="noopener noreferrer">
            edpb.europa.eu
          </a>. We encourage you to contact us first at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> so we can address your concern directly.
        </p>
      </Section>

      <Section title="11. Cookies">
        <p>
          Forge uses strictly necessary session cookies for authentication. We do not use tracking
          cookies or third-party advertising cookies. Vercel Analytics may collect anonymized,
          aggregate usage metrics without cookies.
        </p>
      </Section>

      <Section title="12. Changes to this policy">
        <p>
          We will notify you of material changes to this policy by email or via an in-app notice
          at least 14 days before the changes take effect. The effective date at the top of this
          page reflects the most recent update.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          Data controller: {CONTROLLER}<br />
          Privacy enquiries: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a><br />
          DPA / SCC requests: <a href={`mailto:${DPA_CONTACT}`} className="underline">{DPA_CONTACT}</a>
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-3 text-neutral-900">{title}</h2>
      <div className="text-sm text-neutral-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Row({ a, b }: { a: string; b: string }) {
  return (
    <tr>
      <td className="py-2 pr-4 text-neutral-700">{a}</td>
      <td className="py-2 text-neutral-600">{b}</td>
    </tr>
  );
}
