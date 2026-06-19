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
      <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
        <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Coming soon</span>
        <h1 className="mt-4 text-3xl font-bold text-neutral-900">{feature ? feature.title : "More coming soon"}</h1>
        <p className="mx-auto mt-3 max-w-md text-neutral-600">
          {feature ? feature.blurb : "We're building beyond bug tracking. This feature is on the way."}
        </p>

        {feature && (
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
            {feature.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-neutral-700">
                <span className="mt-0.5 text-indigo-500">→</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href={`/${slug}/board`} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            Go to the board
          </Link>
          <Link href={`/${slug}/issues`} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            View issues
          </Link>
        </div>
      </div>
    </main>
  );
}
