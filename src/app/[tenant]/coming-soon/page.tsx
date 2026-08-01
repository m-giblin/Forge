import Link from "next/link";

const FEATURES: Record<string, { title: string; blurb: string; bullets: string[] }> = {
  dashboards: {
    title: "Dashboards",
    blurb: "Your command center — a live read on where everything stands the moment you log in.",
    bullets: [
      "Mission Control: what changed, what needs you, what shipped this week",
      "Throughput, cycle time, and delivery forecasting",
      "Mine / My Team / Org views",
    ],
  },
  project_portal: {
    title: "Project Portal",
    blurb: "Every project gets a home that says where it stands and where it's going.",
    bullets: [
      "Health, go-live countdown, and an explainable “needs attention” read",
      "Progress, lightweight Timeline, and Costs (budget vs. spend)",
      "Provenance: the origin, decisions, and sign-offs behind the project",
    ],
  },
  think_tank: {
    title: "Think Tank",
    blurb: "Where ideas get pressure-tested before they become projects.",
    bullets: [
      "Capture and discuss ideas with your team",
      "A decision log + cross-functional sign-offs",
      "Convert a ready idea straight into a project",
    ],
  },
};

export default async function ComingSoonPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { tenant: slug } = await params;
  const { f } = await searchParams;
  const feature = (f && FEATURES[f]) || null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="fw-card p-10 text-center">
        <span className="inline-block rounded-full border border-[var(--fw-cream-border)] bg-[#f1efe9] px-3 py-1 text-[11px] font-semibold text-[#726e60]">Coming soon</span>
        <h1 className="mt-4 font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-[#20201d]">{feature ? feature.title : "More coming soon"}</h1>
        <p className="mx-auto mt-3 max-w-md text-[#726e60]">
          {feature ? feature.blurb : "We're building beyond bug tracking. This feature is on the way."}
        </p>

        {feature && (
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
            {feature.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-[#4a473e]">
                <span className="mt-0.5 text-[var(--fw-rust)]">→</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href={`/${slug}/board`}
            className="rounded-[5px] border border-[var(--fw-rust-border)] px-4 py-2 text-sm font-bold text-[#f2e9d8] transition"
            style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
          >
            Go to the board
          </Link>
          <Link href={`/${slug}/issues`} className="rounded-[5px] border border-[var(--fw-cream-border)] px-4 py-2 text-sm font-medium text-[#4a473e] hover:bg-[var(--fw-cream-bg)] transition">
            View issues
          </Link>
        </div>
      </div>
    </main>
  );
}
