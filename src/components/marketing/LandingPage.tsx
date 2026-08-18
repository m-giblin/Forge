import Link from "next/link";
import WaitlistForm from "./WaitlistForm";

const FAQS = [
  {
    q: "What counts as a seat?",
    a: "One seat = one active user who can log in and interact with issues. Stakeholders who only receive scheduled PDF/email reports don't need a seat.",
  },
  {
    q: "Can I import from Jira?",
    a: "Jira CSV export is on our roadmap. In the meantime, our team can help you migrate your issues and history manually — reach out at hello@forge-worx.com and we'll get you set up.",
  },
  {
    q: "How is this different from Linear or Jira?",
    a: "Linear is beautiful but reporting-thin. Jira is powerful but built for process-heavy orgs. Forge-Worx is the middle lane: clean enough for developers, analytics-deep enough for the PM and exec team. And you own your data on a schema you can actually query.",
  },
];

const SOFTWARE_APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Forge-Worx",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Issue tracking that ties every ticket to the code that shipped it — sprint boards, backlog, roadmap, and reporting for teams who'd rather be delivering than configuring.",
  offers: {
    "@type": "Offer",
    priceCurrency: "USD",
  },
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--fw-cream)] text-[#20201d] antialiased font-[family-name:var(--font-inter)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APP_JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <header className="fw-grunge sticky top-0 z-50 border-b border-[var(--fw-sidebar-border)] bg-[var(--fw-sidebar-3)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2">
            <img src="/forge-logo.svg" alt="Forge-Worx" className="h-24 w-24 object-contain drop-shadow-md" />
          </div>

          <nav className="hidden md:flex items-center gap-6 text-base text-[var(--fw-text-dim)]">
            <a href="#features" className="hover:text-[var(--fw-text-bright)] transition-colors font-medium">Features</a>
            <a href="#pricing" className="hover:text-[var(--fw-text-bright)] transition-colors font-medium">Pricing</a>
            <a href="#how-it-works" className="hover:text-[var(--fw-text-bright)] transition-colors font-medium">How It Works</a>
            <a href="#faq" className="hover:text-[var(--fw-text-bright)] transition-colors font-medium">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-[var(--fw-text-dim)] hover:text-[var(--fw-text-bright)] transition-colors"
            >
              Sign In
            </Link>
            <span className="cursor-not-allowed rounded-lg border border-[var(--fw-sidebar-border)] px-4 py-2 text-sm font-semibold text-[var(--fw-text-dimmer)]">
              Coming Soon
            </span>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section
        className="fw-grunge relative overflow-hidden pt-20 pb-24"
        style={{ background: "linear-gradient(165deg, var(--fw-sidebar-1) 0%, var(--fw-sidebar-2) 55%, var(--fw-sidebar-3) 100%)" }}
      >
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[var(--fw-rust)]/20 blur-[120px]" />
          <div className="absolute right-0 bottom-0 h-[300px] w-[500px] rounded-full bg-[var(--fw-rust-dark)]/15 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--fw-rust)]/30 bg-[var(--fw-rust)]/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#e29a7e] uppercase mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e29a7e] animate-pulse" />
            Built for engineering-led product teams
          </div>

          {/* Headline — Challenger reframe starts here */}
          <h1 className="font-[family-name:var(--font-manrope)] text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--fw-text-bright)] leading-[1.05] mb-6">
            Your team ships code.<br />
            <span className="text-[#c0603f]">
              Does your board know why it matters?
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg md:text-xl text-[var(--fw-text-dim)] leading-relaxed mb-10">
            Forge-Worx turns sprint execution into executive intelligence — automatically.
            Stop losing Fridays to manual status reports. Stop defending your team&apos;s output
            with gut feel. Start showing the data that wins trust.
          </p>

          <div id="hero-waitlist">
            <WaitlistForm variant="hero" />
          </div>

          <div className="mt-5 flex items-center justify-center">
            <a
              href="#features"
              className="text-base font-semibold text-[var(--fw-text-dim)] hover:text-[var(--fw-text-bright)] transition-all"
            >
              See what&rsquo;s inside →
            </a>
          </div>

        </div>
      </section>

      {/* ── PRODUCT SHOT ─────────────────────────────────────── */}
      <div className="relative z-[5] mx-auto max-w-5xl px-6" style={{ marginTop: "-56px" }}>
        <div className="overflow-hidden rounded-[10px] border border-[var(--fw-cream-border)] bg-[#eeece4] shadow-[0_30px_70px_rgba(20,18,14,0.25)]">
          <div className="flex items-center gap-2 border-b border-[#100f0d] bg-[#26241f] px-4 py-2.5">
            <span className="h-[9px] w-[9px] rounded-full bg-[#c0392b]" />
            <span className="h-[9px] w-[9px] rounded-full bg-[#c9791d]" />
            <span className="h-[9px] w-[9px] rounded-full bg-[#3f7d4c]" />
            <div className="flex-1 text-center text-[11.5px] text-[#736e5c]">app.forge-worx.com/board</div>
          </div>
          <div className="flex gap-3.5 bg-[#eeece4] px-6 py-5">
            <div className="hidden w-[150px] shrink-0 flex-col gap-2 sm:flex">
              <div className="h-[11px] w-[70%] rounded-[3px] bg-[#dcd7c8]" />
              <div className="mt-1.5 h-2 w-[90%] rounded-[3px] bg-[#e3ded0]" />
              <div className="h-2 w-[80%] rounded-[3px] bg-[#e3ded0]" />
              <div className="h-2 w-[85%] rounded-[3px] bg-[#e3ded0]" />
              <div className="h-2 w-[60%] rounded-[3px] bg-[#e3ded0]" />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { color: "#3a6ea8", cards: [{ w: "80%", tag: "#eaf1f8", avatar: "#5c6a9e" }, { w: "60%", tag: "#f1efe9", avatar: "#3f7d4c" }] },
                { color: "#c9791d", cards: [{ w: "70%", tag: "#fdf1de", avatar: "#b0567c" }, { w: "85%", tag: "#eaf1f8", avatar: "#c9791d" }] },
                { color: "#7a4fa0", cards: [{ w: "65%", tag: "#f4ecfa", avatar: "#7a4fa0" }] },
                { color: "#3f7d4c", cards: [{ w: "75%", tag: "#e9f3ea", avatar: "#3a8a94" }, { w: "50%", tag: "#f1efe9", avatar: "#5c6a9e" }] },
              ].map((col, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: col.color }} />
                    <div className="h-2 w-[50px] rounded-[3px] bg-[#dcd7c8]" />
                  </div>
                  {col.cards.map((c, j) => (
                    <div key={j} className="rounded-[5px] border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] p-2.5">
                      <div className="mb-[7px] h-[7px] w-[40%] rounded-[2px] bg-[#d3cdbc]" />
                      <div className="mb-[9px] h-2 rounded-[2px] bg-[#e3ded0]" style={{ width: c.w }} />
                      <div className="flex items-center justify-between">
                        <span className="h-3.5 w-3.5 rounded-[3px]" style={{ background: c.tag }} />
                        <span className="h-[18px] w-[18px] rounded-full" style={{ background: c.avatar }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── THE CHALLENGER REFRAME ───────────────────────────── */}
      <section className="bg-[var(--fw-sidebar-2)] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-[#e29a7e] mb-3">The uncomfortable truth</p>
            <h2 className="font-[family-name:var(--font-manrope)] text-3xl md:text-4xl font-extrabold text-[var(--fw-text-bright)]">
              You&rsquo;re measuring the wrong thing.
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-[var(--fw-text-dim)] text-lg">
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
                color: "text-[#e29a7e]",
              },
              {
                stat: "4 days",
                label: "Average lag between a delivery event and when leadership hears about it",
                sub: "Decisions are made on stale data every single week.",
                color: "text-orange-400",
              },
            ].map((s) => (
              <div key={s.stat} className="rounded-2xl border border-[#3a382f] bg-[var(--fw-sidebar-1)]/50 p-8">
                <p className={`font-[family-name:var(--font-manrope)] text-5xl font-extrabold mb-2 ${s.color}`}>{s.stat}</p>
                <p className="text-[var(--fw-text-bright)] font-semibold mb-2">{s.label}</p>
                <p className="text-sm text-[var(--fw-text-dim)]">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMERCIAL TEACHING SECTION ─────────────────────── */}
      <section className="bg-[var(--fw-cream)] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--fw-rust-dark)] mb-3">What top teams do differently</p>
            <h2 className="font-[family-name:var(--font-manrope)] text-3xl md:text-4xl font-extrabold text-[#20201d]">
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
              <div key={i} className="grid md:grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-[var(--fw-cream-border)]">
                <div className="bg-[var(--fw-cream-bg)] p-6 border-b md:border-b-0 md:border-r border-[var(--fw-cream-border)]">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#a19d90] mb-3">Before</p>
                  <p className="text-[#4a473e] leading-relaxed">{row.before}</p>
                </div>
                <div className="bg-[#fbeee9] p-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5 shrink-0">{row.icon}</span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--fw-rust-dark)] mb-3">With Forge-Worx</p>
                      <p className="text-[#20201d] font-medium leading-relaxed">{row.after}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section id="features" className="bg-[var(--fw-sidebar-3)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-[#e29a7e] mb-3">What you get</p>
            <h2 className="font-[family-name:var(--font-manrope)] text-3xl md:text-4xl font-extrabold text-[var(--fw-text-bright)]">
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
              <div key={f.title} className="group rounded-2xl border border-[#2a2820] bg-[var(--fw-sidebar-2)] p-6 hover:border-[var(--fw-rust)]/60 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{f.icon}</span>
                  {f.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                      f.badge === "PRO"
                        ? "bg-[var(--fw-rust)]/20 text-[#e29a7e]"
                        : "bg-[var(--fw-rust-dark)]/25 text-[#e29a7e]"
                    }`}>
                      {f.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[var(--fw-text-bright)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--fw-text-dim)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────── */}
      <section id="pricing" className="bg-[#eae6da] py-[70px]">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-10 text-center">
            <h2 className="font-[family-name:var(--font-manrope)] text-[28px] font-extrabold text-[#20201d] mb-2.5">
              Simple pricing, built for small teams
            </h2>
            <p className="text-sm text-[#726e60]">No per-seat surprises. Switch plans anytime.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                name: "Starter", price: "$0", subtitle: "Up to 5 users",
                features: ["Sprint board & backlog", "1 project", "Basic reporting"],
                dark: false, btnLabel: "Join waitlist", href: "#hero-waitlist",
              },
              {
                name: "Team", price: "$12", subtitle: "Per user / month",
                features: ["Everything in Starter", "Unlimited projects", "Roadmap & reports", "Priority support"],
                dark: true, btnLabel: "Join waitlist", href: "#hero-waitlist",
              },
              {
                name: "Scale", price: "$24", subtitle: "Per user / month",
                features: ["Everything in Team", "SSO & advanced permissions", "Audit log", "Dedicated onboarding"],
                dark: false, btnLabel: "Talk to sales", href: "mailto:hello@forge-worx.com?subject=Scale%20plan",
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-[10px] px-6 py-[26px] ${
                  p.dark
                    ? "border border-[#100f0d] shadow-[0_20px_40px_rgba(20,18,14,0.2)]"
                    : "border border-[var(--fw-cream-border)] bg-white"
                }`}
                style={p.dark ? { background: "linear-gradient(165deg,#26281f,#181a16)" } : undefined}
              >
                <div className={`mb-2 text-[13px] font-bold ${p.dark ? "text-[#e29a7e]" : "text-[#5c6a52]"}`}>{p.name}</div>
                <div className="mb-1.5 flex items-baseline gap-1.5">
                  <div className={`font-[family-name:var(--font-manrope)] text-[34px] font-extrabold ${p.dark ? "text-[#f2eee2]" : "text-[#20201d]"}`}>
                    {p.price}
                  </div>
                  <div className={`text-[12.5px] ${p.dark ? "text-[#a39d89]" : "text-[#a19d90]"}`}>/ month</div>
                </div>
                <div className={`mb-5 text-[12.5px] ${p.dark ? "text-[#a39d89]" : "text-[#a19d90]"}`}>{p.subtitle}</div>
                <div className="mb-6 flex flex-col gap-2.5">
                  {p.features.map((f) => (
                    <div key={f} className={`flex items-center gap-2 text-[12.5px] ${p.dark ? "text-[#d8d3c2]" : "text-[#4a473e]"}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={p.dark ? "#e29a7e" : "#5c6a52"} strokeWidth="3" className="shrink-0">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </div>
                  ))}
                </div>
                <a
                  href={p.href}
                  className={`block rounded-[5px] py-[11px] text-center text-[13px] font-bold transition ${
                    p.dark
                      ? "border border-[#5e2c1f] text-[#f2e9d8] hover:brightness-110"
                      : "border border-[var(--fw-cream-border)] text-[#20201d] hover:bg-[var(--fw-cream-bg)]"
                  }`}
                  style={p.dark ? { background: "linear-gradient(160deg,#9a5138,#6e3324)" } : undefined}
                >
                  {p.btnLabel}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" className="bg-[var(--fw-cream)] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--fw-rust-dark)] mb-3">Dead simple to start</p>
            <h2 className="font-[family-name:var(--font-manrope)] text-3xl md:text-4xl font-extrabold text-[#20201d]">
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
                <div className="font-[family-name:var(--font-manrope)] mb-4 text-5xl font-extrabold text-[#e8d2c8] leading-none">{s.step}</div>
                <h3 className="text-lg font-bold text-[#20201d] mb-2">{s.title}</h3>
                <p className="text-[#726e60] text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="bg-[var(--fw-cream)] py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--fw-rust-dark)] mb-3">FAQ</p>
            <h2 className="font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-[#20201d]">Questions we get every week</h2>
          </div>

          <div className="divide-y divide-[var(--fw-cream-border)]">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-5 cursor-pointer">
                <summary className="flex items-center justify-between text-base font-semibold text-[#20201d] list-none">
                  {faq.q}
                  <span className="ml-4 shrink-0 text-[#a19d90] group-open:rotate-180 transition-transform text-xl leading-none">↓</span>
                </summary>
                <p className="mt-3 text-[#726e60] leading-relaxed text-sm">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section
        className="py-20"
        style={{ background: "linear-gradient(160deg, #9a5138, #6e3324)" }}
      >
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-[family-name:var(--font-manrope)] text-4xl md:text-5xl font-extrabold text-[#f2e9d8] mb-4">
            Ship better. Report smarter.<br />Win more trust.
          </h2>
          <p className="text-[#e8d2c8] text-lg mb-8 max-w-xl mx-auto">
            Self-serve signup opens soon. Leave your email and we&apos;ll let you know the moment it does.
          </p>
          <WaitlistForm />
          <p className="mt-4 text-[#e8d2c8] text-sm">
            Already a customer?{" "}
            <Link href="/login" className="text-white underline underline-offset-2 hover:no-underline">
              Sign in here
            </Link>
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-[var(--fw-sidebar-3)] border-t border-[#2a2820] py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <div className="mb-3">
                <img src="/forge-logo.svg" alt="Forge-Worx" className="h-16 w-16 object-contain drop-shadow-md" />
              </div>
              <p className="text-sm text-[var(--fw-text-dimmer)] max-w-xs">
                Sprint intelligence for engineering-led product teams. Ship. Report. Win.
              </p>
            </div>

            <nav className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm text-[var(--fw-text-dim)]">
              <span className="text-[var(--fw-text-dimmer)]">Coming Soon</span>
              <Link href="/login" className="hover:text-[var(--fw-text-bright)] transition-colors">Sign In</Link>
              <a href="#features" className="hover:text-[var(--fw-text-bright)] transition-colors">Features</a>
              <a href="mailto:hello@forge-worx.com" className="hover:text-[var(--fw-text-bright)] transition-colors">Contact</a>
              <Link href="/legal/privacy" className="hover:text-[var(--fw-text-bright)] transition-colors">Privacy</Link>
            </nav>
          </div>

          <div className="mt-10 border-t border-[#2a2820] pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-[var(--fw-text-dimmer)]">
            <p>© 2026 Forge-Worx. All rights reserved.</p>
            <p>Forge-Worx is a product of <span className="text-[var(--fw-text-dim)]">Forge Labs, Inc.</span></p>
          </div>
        </div>
      </footer>

    </div>
  );
}
