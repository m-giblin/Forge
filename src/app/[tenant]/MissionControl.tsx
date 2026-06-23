"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { MissionControlData, ThroughputWeek } from "@/lib/services/missionControl";
import { AiDisclosureFooter } from "@/components/AiBadge";
import NeedsYouCards from "./NeedsYouCard";

/**
 * Mission Control — the tenant login hub ("Design E"), wired to REAL issue data.
 * The "Engineering Intelligence" band at the bottom is clearly badged PREVIEW:
 * those metrics (DORA, commit→deploy phases, Monte Carlo) need Git/CI data Forge
 * doesn't collect yet, so they render sample values behind a Preview badge.
 */


function ThroughputBars({ data }: { data: ThroughputWeek[] }) {
  const w = 460, h = 150, pad = 24;
  const max = Math.max(1, ...data.map((d) => d.done));
  const bw = (w - pad * 2) / data.length;
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} className="w-full">
      {[0, max].map((v) => (
        <line key={v} x1={pad} y1={y(v)} x2={w - pad} y2={y(v)} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      {data.map((d, i) => {
        const barW = bw * 0.55;
        const cx = pad + bw * i + (bw - barW) / 2;
        const top = y(d.done);
        return (
          <g key={i}>
            {d.done > 0 && (
              <text x={pad + bw * i + bw / 2} y={top - 5} textAnchor="middle" className="fill-neutral-500" fontSize="10" fontWeight="600">{d.done}</text>
            )}
            <rect x={cx} y={top} width={barW} height={Math.max(0, h - pad - top)} fill="#6366f1" rx="3" />
            <text x={pad + bw * i + bw / 2} y={h - pad + 13} textAnchor="middle" className="fill-neutral-400" fontSize="9">{d.label}</text>
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
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
        scope === key ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-5">
      {/* Header + scope toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {greeting}{data.greetingName ? `, ${data.greetingName}` : ""} 👋
          </h1>
          <p className="text-sm text-neutral-500">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {" · "}
            {scope === "mine" ? "Here's your day" : "Here's your team"}
          </p>
        </div>
        {canSeeTeam && (
          <div className="flex items-center gap-2">
            {scope === "team" && data.portfolio.length > 1 && (
              <select
                value={activeProject}
                onChange={(e) => onProjectChange(e.target.value)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 outline-none focus:border-neutral-400"
              >
                <option value="">All projects</option>
                {data.portfolio.map((p) => (
                  <option key={p.key} value={p.key}>{p.name}</option>
                ))}
              </select>
            )}
            <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-1">
              {scopeTab("mine", "Mine")}
              {scopeTab("team", "My Team")}
            </div>
          </div>
        )}
      </div>

      {/* AI Digest banner */}
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 flex gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-base font-bold shrink-0">✦</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">AI Digest</p>
            <span className="text-[10px] text-indigo-400">Updated now</span>
          </div>
          <p className="text-sm text-neutral-800 leading-relaxed">{data.narrative}</p>
          <AiDisclosureFooter model="Grok (xAI)" />
          {stats.open > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-indigo-700">
              {stats.inProgress > 0 && <span>🏃 {stats.inProgress} in progress</span>}
              {stats.doneThisWeek > 0 && <span>✅ {stats.doneThisWeek} shipped this week</span>}
              {stats.unassigned > 0 && <span>⚠️ {stats.unassigned} unassigned</span>}
            </div>
          )}
        </div>
      </div>

      {/* Headline stats (real counts) */}
      <div className="grid grid-cols-4 gap-3">
        <StatTile label="Open" value={stats.open} hint={scope === "mine" ? "assigned to you" : "across your team"} />
        <StatTile label="In progress" value={stats.inProgress} hint="being worked now" />
        <StatTile label="Shipped this week" value={stats.doneThisWeek} hint="moved to done" tone="good" />
        <StatTile label="Unassigned" value={stats.unassigned} hint="need an owner" tone={stats.unassigned > 0 ? "warn" : "default"} />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Throughput + cycle (real) */}
        <div className="col-span-2 bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-neutral-900">Throughput</h2>
            <span className="text-xs text-neutral-500">issues shipped / week · last 6 weeks</span>
          </div>
          <p className="text-sm text-neutral-500 mb-3">
            {data.avgCycleDays != null
              ? `Average cycle time (created → done): ${data.avgCycleDays} days.`
              : "Cycle time will appear once issues start completing."}
          </p>
          <ThroughputBars data={data.throughput} />
        </div>

        {/* Needs you (real). self-start + capped scroll so a long list never
            stretches the row and pushes the portfolio below the fold. */}
        <div className="self-start bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-neutral-900">Needs you</h2>
            {data.attention.some((a) => a.urgent) && (
              <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {data.attention.filter((a) => a.urgent).length} urgent
              </span>
            )}
          </div>
          {data.attention.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
              🎉 You&rsquo;re all clear. Nothing needs your attention.
            </div>
          ) : (
            <>
              <NeedsYouCards slug={slug} items={data.attention} members={members} />
              <Link
                href={`/${slug}/issues`}
                className="mt-3 block text-center text-xs font-medium text-neutral-600 hover:text-neutral-900"
              >
                View all in Issues →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Portfolio (real) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Portfolio</p>
          <Link href={`/${slug}/projects`} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
            All projects →
          </Link>
        </div>
        {data.portfolio.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            No projects yet. Ideas graduate from <Link href={`/${slug}/think-tank`} className="font-medium text-indigo-600 hover:underline">Think Tank</Link> into projects.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {data.portfolio.map((p) => (
              <Link
                key={p.id}
                href={`/${slug}/projects/${p.key}`}
                className="bg-white rounded-xl border border-neutral-200 p-4 transition hover:shadow-sm hover:border-neutral-300"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-neutral-500">{p.key}</span>
                  <span className="text-xs text-neutral-400">{p.pctDone}% done</span>
                </div>
                <p className="font-medium text-neutral-900 mt-1 truncate">{p.name}</p>
                <div className="mt-3 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${p.pctDone}%` }} />
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  {p.open} open · {p.inProgress} in progress · {p.done} done
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Engineering Intelligence — real issue-based metrics */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-semibold text-neutral-900">Engineering intelligence</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">LIVE</span>
        </div>
        <p className="text-sm text-neutral-500 mb-4">
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

        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5 text-xs text-amber-700">
          🔗 Connect GitHub/GitLab in <Link href={`/${slug}/admin/settings/git`} className="underline font-medium">Git settings</Link> to unlock deploy frequency, change failure rate, and MTTR from real CI data.
        </div>
      </div>
    </main>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "good" | "warn";
}) {
  const hintCls = tone === "good" ? "text-green-600" : tone === "warn" ? "text-orange-600" : "text-neutral-500";
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-neutral-900 mt-1">{value}</p>
      <p className={`text-xs mt-1 ${hintCls}`}>{hint}</p>
    </div>
  );
}

function MetricTile({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${value === "—" ? "text-neutral-300" : good ? "text-green-700" : "text-neutral-900"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-neutral-400">{sub}</p>
    </div>
  );
}
