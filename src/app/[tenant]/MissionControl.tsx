"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { MissionControlData, ThroughputWeek } from "@/lib/services/missionControl";
import { AiDisclosureFooter } from "@/components/AiBadge";
import NeedsYouCards from "./NeedsYouCard";
import PageHeader from "@/components/patterns/PageHeader";

/**
 * Mission Control — the tenant login hub ("Design E"), wired to REAL issue data.
 * The "Engineering Intelligence" band's DORA four-keys are computed from real
 * deployments + code_events (see lib/services/dora.ts) — not sample data. A
 * tenant with no Git/CI connection yet simply has no deployment rows, so those
 * tiles show "—" and a connect-git prompt instead of a fabricated number.
 *
 * Visual layer restyled to the Ember Rust design system per
 * `Redesigning Spring board layout/HANDOFF.md` §4/§5/§7 — data queries and
 * section structure are unchanged, only markup/className.
 */


function ThroughputBars({ data }: { data: ThroughputWeek[] }) {
  const w = 460, h = 140, pad = 8, barTop = 16, barBottom = 118;
  const max = Math.max(1, ...data.map((d) => d.done));
  const bw = (w - pad * 2) / data.length;
  const barH = barBottom - barTop;
  const y = (v: number) => barBottom - (v / max) * barH;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 140 }}>
      <line x1={pad} y1={barBottom} x2={w - pad} y2={barBottom} stroke="#e3ded0" strokeWidth="1" />
      {data.map((d, i) => {
        const barW = bw * 0.55;
        const cx = pad + bw * i + (bw - barW) / 2;
        const top = y(d.done);
        return (
          <g key={i}>
            {d.done > 0 && (
              <text x={cx + barW / 2} y={top - 4} textAnchor="middle" fontSize="11" fill="#726e60">{d.done}</text>
            )}
            <rect
              x={cx}
              y={top}
              width={barW}
              height={Math.max(3, barBottom - top)}
              fill={d.done === 0 ? "#e3ded0" : "#8c4632"}
              rx="3"
            />
            <text x={cx + barW / 2} y={h - 4} textAnchor="middle" fontSize="11" fill="#a19d90">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}


export default function MissionControl({ slug, data, members = [] }: {
  slug: string;
  data: MissionControlData;
  members?: { userId: string; label: string }[];
}) {
  const { scope, canSeeTeam, stats } = data;
  const router = useRouter();
  const sp = useSearchParams();
  const activeProject = sp.get("project") ?? "";

  const scopeTab = (key: "mine" | "team", label: string) => (
    <Link
      href={`/${slug}?scope=${key}`}
      className={`rounded-md px-4 py-1.5 text-[12.5px] font-semibold transition ${
        scope === key
          ? "bg-[var(--fw-rust-dark)] text-[var(--fw-cream)]"
          : "text-[#4a473e] hover:text-[#20201d]"
      }`}
    >
      {label}
    </Link>
  );

  function onProjectChange(key: string) {
    const params = new URLSearchParams(sp.toString());
    if (key) params.set("project", key);
    else params.delete("project");
    router.push(`/${slug}?${params.toString()}`);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const scopeCopy = scope === "mine" ? "Here's your day" : "Here's your team";

  return (
    <main className="w-full">
      <PageHeader
        title={`${greeting}${data.greetingName ? `, ${data.greetingName}` : ""} 👋`}
        subtitle={`${dateLabel} · ${scopeCopy}`}
        right={
          canSeeTeam ? (
            <>
              {scope === "team" && data.portfolio.length > 1 && (
                <select
                  value={activeProject}
                  onChange={(e) => onProjectChange(e.target.value)}
                  className="rounded-md border border-[var(--fw-cream-border)] bg-[var(--fw-cream)] px-3 py-1.5 text-[12.5px] text-[#4a473e] outline-none focus:border-[#8c4632]"
                >
                  <option value="">All projects</option>
                  {data.portfolio.map((p) => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                </select>
              )}
              <div className="inline-flex gap-[5px] rounded-md bg-[#e3ded0] p-[3px]">
                {scopeTab("mine", "Mine")}
                {scopeTab("team", "My Team")}
              </div>
            </>
          ) : null
        }
      />

      <div className="mx-auto max-w-[1180px] space-y-4 px-6 py-5">
        {/* AI Digest banner */}
        <div className="fw-grunge flex gap-[13px] rounded-[7px] border border-[var(--fw-rust-border)] bg-[var(--fw-sidebar-1)] p-[15px_18px]" style={{ backgroundImage: "linear-gradient(160deg, var(--fw-sidebar-1), var(--fw-sidebar-3))" }}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-[var(--fw-rust-border)] bg-[var(--fw-rust-dark)] text-[15px] font-extrabold text-[var(--fw-cream)]">
            ✦
          </div>
          <div className="flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[var(--fw-rust)]">AI digest</span>
              <span className="text-[10px] text-[var(--fw-text-dimmer)]">Updated now</span>
            </div>
            <p className="text-[12.5px] leading-[1.55] text-[var(--fw-text-bright)]">{data.narrative}</p>
            <AiDisclosureFooter model="Grok (xAI)" />
            {stats.open > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--fw-text-dim)]">
                {stats.inProgress > 0 && <span>🏃 {stats.inProgress} in progress</span>}
                {stats.overdue > 0 && <span>🔥 {stats.overdue} overdue</span>}
                {stats.doneThisWeek > 0 && <span>✅ {stats.doneThisWeek} shipped this week</span>}
                {stats.unassigned > 0 && <span>⚠️ {stats.unassigned} unassigned</span>}
              </div>
            )}
          </div>
        </div>

        {/* Headline stats (real counts) — each tile links to filtered issues */}
        <div className="grid grid-cols-5 gap-3">
          <StatTile label="Open" value={stats.open} hint={scope === "mine" ? "assigned to you" : "across your team"} href={`/${slug}/issues?status=todo,in_progress,in_review,backlog`} />
          <StatTile label="In progress" value={stats.inProgress} hint="being worked now" tone="progress" href={`/${slug}/issues?status=in_progress`} />
          <StatTile label="Overdue" value={stats.overdue} hint="past due date" tone="danger" href={`/${slug}/issues?sort=due&dir=asc`} />
          <StatTile label="Shipped this week" value={stats.doneThisWeek} hint="moved to done" tone="good" href={`/${slug}/issues?status=done`} />
          <StatTile label="Unassigned" value={stats.unassigned} hint="need an owner" tone="danger" href={`/${slug}/issues?assignee=none`} />
        </div>

        <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-3.5">
          {/* Throughput + cycle (real) */}
          <div className="fw-card p-[16px_18px]">
            <h2 className="mb-3.5 font-[family-name:var(--font-manrope)] text-[14px] font-extrabold text-[#20201d]">Throughput</h2>
            <ThroughputBars data={data.throughput} />
            <div className="mt-2.5 flex items-center justify-between border-t border-[#e3ded0] pt-2.5">
              <span className="text-[11px] text-[#a19d90]">Avg cycle time</span>
              <span className="text-[11.5px] font-bold text-[#20201d]">
                {data.avgCycleDays != null ? `${data.avgCycleDays} days` : "—"}
              </span>
            </div>
          </div>

          {/* Needs you (real). self-start + capped scroll so a long list never
              stretches the row and pushes the portfolio below the fold. */}
          <div className="fw-card self-start p-[16px_18px]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-manrope)] text-[14px] font-extrabold text-[#20201d]">Needs you</h2>
              {data.attention.some((a) => a.urgent) && (
                <span className="rounded-full bg-[#fbeae8] px-2 py-0.5 text-[11px] font-semibold text-[#c0392b]">
                  {data.attention.filter((a) => a.urgent).length} urgent
                </span>
              )}
            </div>
            {data.attention.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--fw-cream-border)] p-6 text-center text-[12.5px] text-[#726e60]">
                🎉 You&rsquo;re all clear. Nothing needs your attention.
              </div>
            ) : (
              <>
                <NeedsYouCards slug={slug} items={data.attention} members={members} />
                <Link
                  href={`/${slug}/issues`}
                  className="mt-3 block text-center text-[11px] font-semibold text-[#726e60] hover:text-[#20201d]"
                >
                  View all in Issues →
                </Link>
              </>
            )}
          </div>

          {/* Portfolio (real) */}
          <div className="fw-card p-[16px_18px]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-manrope)] text-[14px] font-extrabold text-[#20201d]">Portfolio</h2>
              {data.portfolio.length > 0 && (
                <Link href={`/${slug}/projects`} className="text-[11px] font-semibold text-[#726e60] hover:text-[#20201d]">
                  All projects →
                </Link>
              )}
            </div>
            {data.portfolio.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--fw-cream-border)] p-5 text-center text-[12.5px] text-[#726e60]">
                No projects yet. Ideas graduate from <Link href={`/${slug}/think-tank`} className="font-semibold text-[#8c4632] hover:underline">Think Tank</Link> into projects.
              </div>
            ) : (
              <div className="flex flex-col gap-[13px]">
                {data.portfolio.map((p) => {
                  const barColor = p.pctDone >= 75 ? "#3f7d4c" : p.pctDone >= 40 ? "#3a6ea8" : "#b7452f";
                  return (
                    <Link key={p.id} href={`/${slug}/projects/${p.key}`} className="block">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: barColor }} aria-hidden="true" />
                        <span className="flex-1 truncate text-[12.5px] font-semibold text-[#20201d]">{p.name}</span>
                        <span className="text-[11px] text-[#a19d90]">{p.pctDone}% done</span>
                      </div>
                      <p className="mb-1.5 pl-[15px] text-[11px] text-[#a19d90]">
                        {p.open} open · {p.inProgress} in progress · {p.done} done
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#e3ded0]">
                        <div className="h-full" style={{ width: `${p.pctDone}%`, backgroundColor: barColor }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Engineering Intelligence — real issue-based metrics */}
        <div className="fw-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-manrope)] text-[14px] font-extrabold text-[#20201d]">Engineering intelligence</h2>
            <span className="rounded-full bg-[#eaf1f8] px-2 py-0.5 text-[10px] font-extrabold text-[#3a6ea8]">LIVE</span>
          </div>
          <p className="mb-4 text-[12.5px] text-[#726e60]">
            Issue-based metrics. Connect a Git/CI provider to unlock commit→deploy DORA four-keys.
          </p>

          <div className="grid grid-cols-4 gap-3">
            <MetricTile
              label="Lead time"
              value={data.avgCycleDays != null ? `${data.avgCycleDays}d` : "—"}
              sub="avg issue cycle"
              good={data.avgCycleDays != null && data.avgCycleDays < 7}
            />
            <MetricTile
              label="Velocity"
              value={data.weeklyVelocity != null ? `${data.weeklyVelocity}/wk` : "—"}
              sub="issues shipped (4wk avg)"
              good={data.weeklyVelocity != null && data.weeklyVelocity > 0}
            />
            <MetricTile
              label="Bug rate"
              value={data.bugFailRate != null ? `${data.bugFailRate}%` : "—"}
              sub="bugs of closed issues"
              good={data.bugFailRate != null && data.bugFailRate < 20}
            />
            <MetricTile
              label="Bug cycle"
              value={data.avgBugCycleDays != null ? `${data.avgBugCycleDays}d` : "—"}
              sub="avg bug resolution time"
              good={data.avgBugCycleDays != null && data.avgBugCycleDays < 5}
            />
          </div>

          {data.dora.totalDeployments > 0 ? (
            <>
              <div className="mb-1 mt-5 flex items-center gap-2">
                <h3 className="text-[13px] font-bold text-[#20201d]">DORA four-keys</h3>
                <span className="rounded-full bg-[#e9f3ea] px-2 py-0.5 text-[10px] font-extrabold text-[#3f7d4c]">LIVE</span>
                <span className="text-[11px] text-[#a19d90]">— last {data.dora.windowDays} days, {data.dora.totalDeployments} deploy{data.dora.totalDeployments !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <MetricTile
                  label="Deploy frequency"
                  value={data.dora.deploymentsPerWeek != null ? `${data.dora.deploymentsPerWeek}/wk` : "—"}
                  sub="successful deploys"
                  good={data.dora.deploymentsPerWeek != null && data.dora.deploymentsPerWeek >= 1}
                />
                <MetricTile
                  label="Lead time"
                  value={data.dora.leadTimeHours != null ? `${Math.round(data.dora.leadTimeHours)}h` : "—"}
                  sub="PR merge → deploy"
                  good={data.dora.leadTimeHours != null && data.dora.leadTimeHours < 24}
                />
                <MetricTile
                  label="Change failure rate"
                  value={data.dora.changeFailureRatePct != null ? `${data.dora.changeFailureRatePct}%` : "—"}
                  sub="deploys that failed"
                  good={data.dora.changeFailureRatePct != null && data.dora.changeFailureRatePct < 15}
                />
                <MetricTile
                  label="MTTR"
                  value={data.dora.mttrHours != null ? `${Math.round(data.dora.mttrHours)}h` : "—"}
                  sub="failure → recovery"
                  good={data.dora.mttrHours != null && data.dora.mttrHours < 24}
                />
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-md border border-[var(--fw-cream-border)] bg-[#fdf1de] px-4 py-2.5 text-[11.5px] text-[#c9791d]">
              🔗 Connect GitHub/GitLab in <Link href={`/${slug}/admin/settings/git`} className="font-semibold underline">Git settings</Link> to unlock deploy frequency, lead time, change failure rate, and MTTR from real deployment data.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatTile({
  label, value, hint, tone = "default", href,
}: {
  label: string; value: number; hint: string;
  tone?: "default" | "good" | "warn" | "danger" | "progress"; href?: string;
}) {
  const valueColor = {
    default: "#20201d",
    good: "#3f7d4c",
    warn: "#c9791d",
    danger: "#c0392b",
    progress: "#c9791d",
  }[tone];
  const inner = (
    <>
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">{label}</p>
      <p className="mt-0.5 font-[family-name:var(--font-manrope)] text-[23px] font-extrabold" style={{ color: valueColor }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[#a19d90]">{hint}</p>
    </>
  );
  if (href) return (
    <Link href={href} className="fw-card group block px-[17px] py-[15px] transition hover:border-[#c3bda9]">
      {inner}
      <p className="mt-1 text-[11px] font-semibold text-[#a19d90] opacity-0 transition-opacity group-hover:opacity-100">
        View all →
      </p>
    </Link>
  );
  return <div className="fw-card px-[17px] py-[15px]">{inner}</div>;
}

function MetricTile({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className="fw-card p-4">
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.07em] text-[#a19d90]">{label}</p>
      <p
        className="mt-2 font-[family-name:var(--font-manrope)] text-[23px] font-extrabold"
        style={{ color: value === "—" ? "#c3bda9" : good ? "#3f7d4c" : "#20201d" }}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#a19d90]">{sub}</p>
    </div>
  );
}
