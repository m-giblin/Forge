import Link from "next/link";

// ─── Pricing tier definitions ──────────────────────────────────────────────
const TIERS = [
  {
    name: "Basic",
    price: "$9",
    unit: "/seat/mo",
    description: "For small teams that need a better board.",
    features: [
      "Unlimited issues & projects",
      "Kanban + List views",
      "Sprint planning",
      "Burndown & Velocity charts",
      "5 GB storage",
      "Email support",
    ],
    cta: "Get started free",
    href: "/signup",
    highlight: false,
    badge: null,
  },
  {
    name: "Premium",
    price: "$19",
    unit: "/seat/mo",
    description: "For teams that need intelligence, not just tracking.",
    features: [
      "Everything in Basic",
      "Cycle Time & Issue Aging analytics",
      "Custom Report Builder (9 dimensions)",
      "Stakeholder PDF/Excel exports",
      "Scheduled automated reports",
      "AI Sprint Intelligence",
      "Priority support",
      "Unlimited storage",
    ],
    cta: "Start 14-day free trial",
    href: "/signup",
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Pro",
    price: null,
    unit: "",
    description: "SSO, advanced AI, custom integrations — coming soon.",
    features: [
      "Everything in Premium",
      "SSO / SAML authentication",
      "Advanced AI assistant",
      "Custom integrations & webhooks",
      "Dedicated customer success",
      "99.9% uptime SLA",
    ],
    cta: "Join waitlist",
    href: "mailto:hello@forge-worx.com?subject=Pro%20Waitlist",
    highlight: false,
    badge: "Coming Soon",
  },
  {
    name: "Enterprise",
    price: null,
    unit: "",
    description: "On-premise, custom models, white-glove onboarding.",
    features: [
      "Everything in Pro",
      "On-premise deployment option",
      "Custom AI fine-tuning",
      "Volume seat pricing",
      "Executive business review",
      "Custom SLA & contracts",
    ],
    cta: "Contact us",
    href: "mailto:hello@forge-worx.com?subject=Enterprise%20Inquiry",
    highlight: false,
    badge: "Coming Soon",
  },
];

const FAQS = [
  {
    q: "What counts as a seat?",
    a: "One seat = one active user who can log in and interact with issues. Stakeholders who only receive scheduled PDF/email reports don't need a seat.",
  },
  {
    q: "Do I need a credit card for the trial?",
    a: "No. Start your 14-day Premium trial with just your work email. You'll only need a card when you decide to keep going.",
  },
  {
    q: "What happens when the trial ends?",
    a: "Your workspace automatically moves to the Basic tier. No data is lost — your issues, sprints, and history stay intact. Premium features are locked until you upgrade.",
  },
  {
    q: "Can I import from Jira?",
    a: "Yes. Forge-Worx can import your issues, epics, sprints, and history via CSV or our Jira migration tool. Most teams are up and running in under an hour.",
  },
  {
    q: "How is this different from Linear or Jira?",
    a: "Linear is beautiful but reporting-thin. Jira is powerful but built for process-heavy orgs. Forge-Worx is the middle lane: clean enough for developers, analytics-deep enough for the PM and exec team. And you own your data on a schema you can actually query.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased">

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">
              <span className="text-sm font-black text-white">F</span>
            </div>
            <span className="text-base font-bold tracking-tight text-white">Forge<span className="text-indigo-400">-Worx</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 pt-20 pb-24">
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute right-0 bottom-0 h-[300px] w-[500px] rounded-full bg-violet-600/15 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-indigo-300 uppercase mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Built for engineering-led product teams
          </div>

          {/* Headline — Challenger reframe starts here */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05] mb-6">
            Your team ships code.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300">
              Does your board know why it matters?
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg md:text-xl text-slate-300 leading-relaxed mb-10">
            Forge-Worx turns sprint execution into executive intelligence — automatically.
            Stop losing Fridays to manual status reports. Stop defending your team&apos;s output
            with gut feel. Start showing the data that wins trust.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-xl bg-indigo-500 px-8 py-3.5 text-base font-bold text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/25"
            >
              Start 14-Day Free Trial — No CC Required
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto rounded-xl border border-slate-700 px-8 py-3.5 text-base font-semibold text-slate-300 hover:border-slate-500 hover:text-white transition-all"
            >
              See what&rsquo;s inside →
            </a>
          </div>

          {/* Social proof strip */}
          <p className="mt-8 text-sm text-slate-500">
            14-day free Premium trial &nbsp;·&nbsp; Single workspace &nbsp;·&nbsp; Cancel anytime &nbsp;·&nbsp; Your data, always
          </p>
        </div>
      </section>

      {/* ── THE CHALLENGER REFRAME ───────────────────────────── */}
      <section className="bg-slate-900 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">The uncomfortable truth</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">
              You&rsquo;re measuring the wrong thing.
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-slate-400 text-lg">
              Most teams count issues closed. High-performing teams measure <em>flow</em>.
              That gap — between ticket velocity and delivery intelligence — is where trust gets won or lost.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                stat: "3.5 hrs",
                label: "Average time a PM spends building Friday status reports",
                sub: "Time you could spend on discovery, not documentation.",
                color: "text-red-400",
              },
              {
                stat: "61%",
                label: "Of sprint retro action items are forgotten by the next sprint",
                sub: "Because they live in a doc nobody checks twice.",
                color: "text-amber-400",
              },
              {
                stat: "4 days",
                label: "Average lag between a delivery event and when leadership hears about it",
                sub: "Decisions are made on stale data every single week.",
                color: "text-orange-400",
              },
            ].map((s) => (
              <div key={s.stat} className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-8">
                <p className={`text-5xl font-black mb-2 ${s.color}`}>{s.stat}</p>
                <p className="text-white font-semibold mb-2">{s.label}</p>
                <p className="text-sm text-slate-400">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMERCIAL TEACHING SECTION ─────────────────────── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">What top teams do differently</p>
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900">
              The shift from tracking to intelligence
            </h2>
          </div>

          <div className="space-y-6">
            {[
              {
                before: "Weekly status meetings consume 3 hours of your team's most productive time.",
                after: "Automated stakeholder reports go out Sunday night. Monday's standup is 15 minutes of decisions, not updates.",
                icon: "📬",
              },
              {
                before: "You're doing sprint retros based on how the team feels, not what the data shows.",
                after: "Cycle time and flow metrics surface exactly where work stalls — by assignee, priority, and type — so retros fix real problems.",
                icon: "📊",
              },
              {
                before: "When a VP asks 'how's the team performing?' you give a subjective answer.",
                after: "You pull a burndown PDF in 8 seconds. Velocity trend. P90 cycle time. Done ratio. The conversation changes.",
                icon: "📈",
              },
              {
                before: "Issue aging is invisible. Stale tickets sit until a stakeholder notices.",
                after: "Aging reports flag work that's been open 14, 30, or 60+ days — automatically. Nothing falls through the cracks.",
                icon: "⏱️",
              },
            ].map((row, i) => (
              <div key={i} className="grid md:grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-neutral-200">
                <div className="bg-neutral-50 p-6 border-b md:border-b-0 md:border-r border-neutral-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Before</p>
                  <p className="text-neutral-700 leading-relaxed">{row.before}</p>
                </div>
                <div className="bg-indigo-50 p-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5 shrink-0">{row.icon}</span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">With Forge-Worx</p>
                      <p className="text-neutral-800 font-medium leading-relaxed">{row.after}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section id="features" className="bg-slate-950 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">What you get</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">
              Everything your team needs. Nothing they don&rsquo;t.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: "🏃",
                title: "Kanban & Sprint Board",
                desc: "Fast, opinionated board. Drag issues, manage sprints, see exactly what's in flight — without a 47-tab settings menu.",
                badge: null,
              },
              {
                icon: "📉",
                title: "Burndown & Velocity",
                desc: "Real-time burndown that tracks story points and issue count. Velocity charts across sprints — no setup, no manual exports.",
                badge: null,
              },
              {
                icon: "⏳",
                title: "Cycle Time Analytics",
                desc: "P50/P90 cycle time by priority, type, assignee, and project. See where work stalls and fix the bottleneck — not the symptom.",
                badge: "PRO",
              },
              {
                icon: "🕰️",
                title: "Issue Aging Report",
                desc: "Surface tickets that have been open 14, 30, or 60+ days. Catch stale work before it becomes a stakeholder conversation.",
                badge: "PRO",
              },
              {
                icon: "🛠️",
                title: "Custom Report Builder",
                desc: "9 group-by dimensions × 3 metrics × 5 chart types. Build exactly the report your CTO wants — once, then save it.",
                badge: "PRO",
              },
              {
                icon: "📬",
                title: "Scheduled Reports",
                desc: "Send PDF/Excel reports to any stakeholder on any cadence. Weekly board updates. Monthly OKR snapshots. On autopilot.",
                badge: "PRO",
              },
              {
                icon: "📋",
                title: "Multi-Project Intelligence",
                desc: "Cross-project rollups, roadmap view, and workload capacity. Know what every team member is working on — and what they're overloaded with.",
                badge: null,
              },
              {
                icon: "💡",
                title: "AI Sprint Intelligence",
                desc: "Flags sprint risks before they hit. Spots patterns in your delivery history. Answers 'why did this sprint slip?' with data, not opinions.",
                badge: "COMING SOON",
              },
              {
                icon: "🔔",
                title: "Smart Notifications",
                desc: "Get notified on what matters: mentions, assignments, SLA breaches. Not noise. Role-based digests mean each person sees only their work.",
                badge: null,
              },
            ].map((f) => (
              <div key={f.title} className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-indigo-700/60 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{f.icon}</span>
                  {f.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                      f.badge === "PRO"
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}>
                      {f.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">Dead simple to start</p>
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900">
              From signup to first sprint report in under 30 minutes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Create your workspace",
                desc: "Sign up with your work email. Name your workspace. Invite your team. No Jira admin license. No IT ticket. Done in 5 minutes.",
              },
              {
                step: "02",
                title: "Import or start fresh",
                desc: "Bring your Jira issues over via CSV, or start clean. Create your first project, set up a sprint, and assign your backlog in minutes.",
              },
              {
                step: "03",
                title: "Intelligence starts immediately",
                desc: "The moment issues move through your board, the analytics light up. No configuration. No plugins. Burndown, cycle time, aging — all live.",
              },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="mb-4 text-5xl font-black text-indigo-100 leading-none">{s.step}</div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">{s.title}</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────── */}
      <section id="pricing" className="bg-slate-950 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">
              Per seat. Billed monthly. No surprises.
            </h2>
            <p className="mt-4 text-slate-400">Start your 14-day Premium trial free. Upgrade when you&rsquo;re ready.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  tier.highlight
                    ? "border-indigo-500 bg-indigo-950 ring-1 ring-indigo-500/50"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                {tier.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold ${
                    tier.highlight
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-700 text-slate-300"
                  }`}>
                    {tier.badge}
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-base font-bold text-white mb-1">{tier.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{tier.description}</p>
                </div>

                <div className="mb-6">
                  {tier.price ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">{tier.price}</span>
                      <span className="text-sm text-slate-400">{tier.unit}</span>
                    </div>
                  ) : (
                    <span className="text-2xl font-black text-slate-400">Custom</span>
                  )}
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="mt-0.5 shrink-0 text-indigo-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={tier.href}
                  className={`block w-full rounded-xl py-2.5 text-center text-sm font-bold transition-colors ${
                    tier.highlight
                      ? "bg-indigo-500 text-white hover:bg-indigo-400"
                      : tier.badge === "Coming Soon"
                      ? "border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300"
                      : "border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white"
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-slate-500">
            All plans billed per active seat per month. Annual billing available — contact us for a quote.
            Premium trial = full Premium features, 1 workspace, 14 days.
          </p>
        </div>
      </section>

      {/* ── WHY NOT JIRA ─────────────────────────────────────── */}
      <section className="bg-neutral-950 py-20 border-y border-slate-800">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white">
              &ldquo;We already have Jira / Linear / Asana.&rdquo;
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">
              We hear this every week. Here&rsquo;s the honest comparison:
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900">
                  <th className="px-5 py-3 text-left text-slate-400 font-semibold">Feature</th>
                  <th className="px-5 py-3 text-center text-slate-400 font-semibold">Jira</th>
                  <th className="px-5 py-3 text-center text-slate-400 font-semibold">Linear</th>
                  <th className="px-5 py-3 text-center text-indigo-300 font-bold">Forge-Worx</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Clean, fast UI", "⚠️ Complex", "✅ Fast", "✅ Fast"],
                  ["Sprint burndown", "✅ Plugin", "⚠️ Basic", "✅ Built-in"],
                  ["Cycle time analytics", "⚠️ Plugin $$$", "❌", "✅ Built-in"],
                  ["Stakeholder PDF reports", "⚠️ Plugin $$$", "❌", "✅ Built-in"],
                  ["Custom report builder", "⚠️ Eazybi $$$", "❌", "✅ Built-in"],
                  ["Scheduled email reports", "⚠️ Plugin", "❌", "✅ Built-in"],
                  ["Issue aging tracking", "⚠️ Manual", "❌", "✅ Built-in"],
                  ["AI-powered insights", "⚠️ Add-on", "⚠️ Limited", "✅ Built-in"],
                  ["Setup time", "😰 Weeks", "✅ Days", "✅ < 30 min"],
                  ["Price", "$$$ + plugins", "$$", "$"],
                ].map(([feature, jira, linear, forge]) => (
                  <tr key={feature} className="border-b border-slate-800 last:border-0 bg-slate-900/50 hover:bg-slate-900 transition-colors">
                    <td className="px-5 py-3 text-slate-300 font-medium">{feature}</td>
                    <td className="px-5 py-3 text-center text-slate-400">{jira}</td>
                    <td className="px-5 py-3 text-center text-slate-400">{linear}</td>
                    <td className="px-5 py-3 text-center text-indigo-300 font-semibold">{forge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">FAQ</p>
            <h2 className="text-3xl font-black text-neutral-900">Questions we get every week</h2>
          </div>

          <div className="divide-y divide-neutral-200">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-5 cursor-pointer">
                <summary className="flex items-center justify-between text-base font-semibold text-neutral-900 list-none">
                  {faq.q}
                  <span className="ml-4 shrink-0 text-neutral-400 group-open:rotate-180 transition-transform text-xl leading-none">↓</span>
                </summary>
                <p className="mt-3 text-neutral-500 leading-relaxed text-sm">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section className="bg-indigo-600 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Ship better. Report smarter.<br />Win more trust.
          </h2>
          <p className="text-indigo-200 text-lg mb-8 max-w-xl mx-auto">
            14 days free. Full Premium. One workspace. No credit card.
            Cancel any time — but most teams don&rsquo;t.
          </p>
          <Link
            href="/signup"
            className="inline-block rounded-xl bg-white px-10 py-4 text-base font-bold text-indigo-700 hover:bg-indigo-50 transition-colors shadow-xl shadow-indigo-900/30"
          >
            Start your free trial today →
          </Link>
          <p className="mt-4 text-indigo-300 text-sm">
            Already a customer?{" "}
            <Link href="/login" className="text-white underline underline-offset-2 hover:no-underline">
              Sign in here
            </Link>
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
                  <span className="text-xs font-black text-white">F</span>
                </div>
                <span className="text-base font-bold text-white">Forge<span className="text-indigo-400">-Worx</span></span>
              </div>
              <p className="text-sm text-slate-500 max-w-xs">
                Sprint intelligence for engineering-led product teams. Ship. Report. Win.
              </p>
            </div>

            <nav className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm text-slate-400">
              <Link href="/signup" className="hover:text-white transition-colors">Start Free Trial</Link>
              <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="mailto:hello@forge-worx.com" className="hover:text-white transition-colors">Contact</a>
              <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </nav>
          </div>

          <div className="mt-10 border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <p>© 2026 Forge-Worx. All rights reserved.</p>
            <p>Forge-Worx is a product of <span className="text-slate-500">Forge Labs, Inc.</span></p>
          </div>
        </div>
      </footer>

    </div>
  );
}
