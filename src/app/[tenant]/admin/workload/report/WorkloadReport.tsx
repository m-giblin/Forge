"use client";

import { useEffect } from "react";
import type { WorkloadMember } from "../WorkloadClient";

interface Props {
  members: WorkloadMember[];
  activeSprint: { name: string; start_date: string | null; end_date: string | null } | null;
  workspaceName: string;
  weekStartIso: string;
  generatedAt: string;
  autoPrint?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtMins(m: number): string {
  if (m === 0) return "0h";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function pct(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

type StatusLevel = "healthy" | "watch" | "at_risk" | "overloaded";

function memberStatus(m: WorkloadMember): StatusLevel {
  const p = pct(m.loggedMinutesWeek, m.availableMinutesWeek);
  if (p > 110) return "overloaded";
  if (p > 90) return "at_risk";
  if (p > 70) return "watch";
  return "healthy";
}

const STATUS_LABELS: Record<StatusLevel, string> = {
  healthy: "On Track",
  watch: "Monitor",
  at_risk: "At Capacity",
  overloaded: "Overloaded",
};

const STATUS_COLORS: Record<StatusLevel, { bg: string; text: string; bar: string; dot: string }> = {
  healthy: { bg: "#f0fdf4", text: "#15803d", bar: "#22c55e", dot: "#16a34a" },
  watch: { bg: "#fffbeb", text: "#d97706", bar: "#f59e0b", dot: "#d97706" },
  at_risk: { bg: "#fff7ed", text: "#c2410c", bar: "#f97316", dot: "#ea580c" },
  overloaded: { bg: "#fef2f2", text: "#b91c1c", bar: "#ef4444", dot: "#dc2626" },
};

// ── Horizontal bar (inline SVG for print reliability) ─────────────────────

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div style={{ width: "100%", background: "#f1f5f9", borderRadius: 4, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
    </div>
  );
}

// ── Donut-style utilization ring ──────────────────────────────────────────

function UtilRing({ pct: p, color }: { pct: number; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(p, 100) / 100 * circ;
  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={36} cy={36} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
      <circle
        cx={36} cy={36} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x={36} y={40} textAnchor="middle" fontSize={13} fontWeight="700" fill={color}>{p}%</text>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function WorkloadReport({ members, activeSprint, workspaceName, weekStartIso, generatedAt, autoPrint }: Props) {
  // When autoPrint=true: print immediately on load, then close the tab
  useEffect(() => {
    if (!autoPrint) return;
    const id = setTimeout(() => {
      window.print();
      window.addEventListener("afterprint", () => window.close(), { once: true });
    }, 400);
    return () => clearTimeout(id);
  }, [autoPrint]);

  // Summary stats
  const totalCapMins = members.reduce((s, m) => s + m.availableMinutesWeek, 0);
  const totalLogMins = members.reduce((s, m) => s + m.loggedMinutesWeek, 0);
  const totalEstMins = members.reduce((s, m) => s + m.estimatedMinutesSprint, 0);
  const overloadedCount = members.filter((m) => memberStatus(m) === "overloaded").length;
  const atRiskCount = members.filter((m) => memberStatus(m) === "at_risk").length;
  const utilPct = pct(totalLogMins, totalCapMins);
  const sprintCovPct = pct(totalEstMins, totalCapMins);

  const overloadedMembers = members.filter((m) => memberStatus(m) === "overloaded" || memberStatus(m) === "at_risk");
  const underutilizedMembers = members.filter((m) => {
    const p = pct(m.loggedMinutesWeek, m.availableMinutesWeek);
    return p < 30 && m.availableMinutesWeek > 0;
  });

  const weekEnd = new Date(weekStartIso);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Overall team health rating
  const teamRating: StatusLevel =
    overloadedCount > 0 ? "overloaded"
    : atRiskCount > 1 ? "at_risk"
    : utilPct > 80 ? "watch"
    : "healthy";

  const TEAM_STATUS_LABELS: Record<StatusLevel, string> = {
    healthy: "Team is healthy and well-distributed.",
    watch: "Team utilization is elevated — monitor closely.",
    at_risk: "Multiple members near capacity — rebalancing recommended.",
    overloaded: "One or more members are overloaded — immediate action required.",
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1.2cm 1.5cm; size: A4; }
          .page-break { page-break-before: always; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
      `}</style>

      {/* Print / Back buttons — hidden when printing and in auto-print mode */}
      {!autoPrint && (
        <div className="no-print" style={{ position: "fixed", top: 16, right: 16, zIndex: 50, display: "flex", gap: 8 }}>
          <button
            onClick={() => window.history.back()}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#1e293b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            🖨 Print / Save PDF
          </button>
        </div>
      )}

      {/* ── Report body ── */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 40px 80px", color: "#1e293b", lineHeight: 1.5 }}>

        {/* ── Cover header ── */}
        <div style={{ borderBottom: "3px solid #1e293b", paddingBottom: 24, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>
                Forge-Worx · {workspaceName}
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
                Team Workload Report
              </h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                {fmtDate(weekStartIso)} – {fmtDateShort(weekEnd.toISOString())}
                {activeSprint && ` · ${activeSprint.name}`}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: STATUS_COLORS[teamRating].bg,
                  border: `1.5px solid ${STATUS_COLORS[teamRating].bar}`,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[teamRating].dot, display: "inline-block" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLORS[teamRating].text }}>
                  Team Health: {STATUS_LABELS[teamRating]}
                </span>
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, textAlign: "right" }}>
                Generated {new Date(generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          </div>
        </div>

        {/* ── Executive Summary ── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>
            Executive Summary
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
            {[
              { label: "Team Capacity", value: fmtMins(totalCapMins), sub: `${members.length} members · this week` },
              {
                label: "Utilization Rate",
                value: `${utilPct}%`,
                sub: `${fmtMins(totalLogMins)} logged`,
                color: utilPct > 90 ? "#dc2626" : utilPct > 70 ? "#d97706" : "#16a34a",
              },
              {
                label: "Sprint Coverage",
                value: `${sprintCovPct}%`,
                sub: `${fmtMins(totalEstMins)} estimated`,
                color: sprintCovPct > 100 ? "#dc2626" : sprintCovPct > 80 ? "#d97706" : "#1e293b",
              },
              {
                label: "Risk Members",
                value: String(overloadedCount + atRiskCount),
                sub: `${overloadedCount} overloaded · ${atRiskCount} at capacity`,
                color: overloadedCount > 0 ? "#dc2626" : atRiskCount > 0 ? "#d97706" : "#16a34a",
              },
            ].map((tile) => (
              <div
                key={tile.label}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "16px 18px",
                }}
              >
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 6px" }}>{tile.label}</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: tile.color ?? "#0f172a", margin: "0 0 2px", lineHeight: 1 }}>{tile.value}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{tile.sub}</p>
              </div>
            ))}
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#475569" }}>
            <strong style={{ color: "#1e293b" }}>Summary: </strong>
            {TEAM_STATUS_LABELS[teamRating]}{" "}
            {utilPct < 40 && members.length > 0
              ? "Current week logging is low — ensure timers are being used consistently to maintain accurate data."
              : utilPct > 85
              ? "Consider redistributing assignments or adjusting sprint scope to prevent burnout."
              : "Capacity is being used efficiently across the team."}
            {activeSprint && ` Sprint "${activeSprint.name}" ends ${activeSprint.end_date ? fmtDateShort(activeSprint.end_date) : "TBD"}.`}
          </div>
        </section>

        {/* ── Utilization rings ── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>
            Team Utilization Overview
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {members.map((m) => {
              const status = memberStatus(m);
              const colors = STATUS_COLORS[status];
              const utilP = pct(m.loggedMinutesWeek, m.availableMinutesWeek);
              return (
                <div
                  key={m.userId}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "14px 18px",
                    background: colors.bg,
                    border: `1.5px solid ${colors.bar}`,
                    borderRadius: 10,
                    minWidth: 110,
                  }}
                >
                  <UtilRing pct={utilP} color={colors.bar} />
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", margin: 0, textAlign: "center" }}>{m.name}</p>
                  <p style={{ fontSize: 10, color: colors.text, fontWeight: 600, margin: 0 }}>{STATUS_LABELS[status]}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Detailed capacity table ── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>
            Detailed Capacity Breakdown
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#1e293b", color: "#fff" }}>
                {["Team Member", "Role", "Available", "Logged", "Utilization", "Sprint Issues", "Estimated", "Sprint Coverage"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const status = memberStatus(m);
                const colors = STATUS_COLORS[status];
                const utilP = pct(m.loggedMinutesWeek, m.availableMinutesWeek);
                const sprintP = pct(m.estimatedMinutesSprint, m.availableMinutesWeek);
                return (
                  <tr
                    key={m.userId}
                    style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a" }}>{m.name}</td>
                    <td style={{ padding: "10px 12px", color: "#64748b", textTransform: "capitalize" }}>{m.role}</td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>{m.hoursPerWeek}h</td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>{fmtMins(m.loggedMinutesWeek)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 60 }}>
                          <Bar value={m.loggedMinutesWeek} max={m.availableMinutesWeek} color={colors.bar} />
                        </div>
                        <span style={{ color: colors.text, fontWeight: 700, fontSize: 11, minWidth: 30 }}>{utilP}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#475569", textAlign: "center" }}>{m.assignedIssueCount}</td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>{fmtMins(m.estimatedMinutesSprint)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 60 }}>
                          <Bar value={m.estimatedMinutesSprint} max={m.availableMinutesWeek} color={sprintP > 100 ? "#ef4444" : "#6366f1"} />
                        </div>
                        <span style={{ color: sprintP > 100 ? "#dc2626" : "#4f46e5", fontWeight: 700, fontSize: 11, minWidth: 30 }}>{sprintP}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ background: "#1e293b", color: "#fff", fontWeight: 700 }}>
                <td style={{ padding: "10px 12px" }} colSpan={2}>Totals</td>
                <td style={{ padding: "10px 12px" }}>{Math.round(totalCapMins / 60)}h</td>
                <td style={{ padding: "10px 12px" }}>{fmtMins(totalLogMins)}</td>
                <td style={{ padding: "10px 12px" }}>{utilPct}%</td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>{members.reduce((s, m) => s + m.assignedIssueCount, 0)}</td>
                <td style={{ padding: "10px 12px" }}>{fmtMins(totalEstMins)}</td>
                <td style={{ padding: "10px 12px" }}>{sprintCovPct}%</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ── Risk & Recommendations ── */}
        {(overloadedMembers.length > 0 || underutilizedMembers.length > 0) && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>
              Risk Alerts & Recommendations
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {overloadedMembers.map((m) => {
                const status = memberStatus(m);
                const colors = STATUS_COLORS[status];
                const utilP = pct(m.loggedMinutesWeek, m.availableMinutesWeek);
                return (
                  <div
                    key={m.userId}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "12px 16px",
                      background: colors.bg,
                      border: `1.5px solid ${colors.bar}`,
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontSize: 16, marginTop: 1 }}>{status === "overloaded" ? "⚠️" : "●"}</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: colors.text }}>
                        {m.name} — {STATUS_LABELS[status]} ({utilP}% utilized)
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>
                        Logged {fmtMins(m.loggedMinutesWeek)} against {m.hoursPerWeek}h available.
                        {status === "overloaded"
                          ? ` Consider reassigning issues or adjusting capacity before sprint end.`
                          : ` Monitor closely — if sprint estimates are also high, decommit lower-priority items.`}
                      </p>
                    </div>
                  </div>
                );
              })}
              {underutilizedMembers.map((m) => (
                <div
                  key={m.userId}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 16px",
                    background: "#f0f9ff",
                    border: "1.5px solid #7dd3fc",
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 16, marginTop: 1 }}>📋</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#0369a1" }}>
                      {m.name} — Available Capacity
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>
                      Only {pct(m.loggedMinutesWeek, m.availableMinutesWeek)}% utilized this week.
                      Opportunity to pull forward backlog items or support overloaded teammates.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Sprint summary ── */}
        {activeSprint && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>
              Active Sprint
            </h2>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 4px" }}>Sprint Name</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>{activeSprint.name}</p>
                </div>
                {activeSprint.end_date && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 4px" }}>End Date</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>{fmtDateShort(activeSprint.end_date)}</p>
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", margin: "0 0 4px" }}>Total Issues Assigned</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>
                    {members.reduce((s, m) => s + m.assignedIssueCount, 0)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Key definitions ── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>
            Metric Definitions
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: "#475569" }}>
            <tbody>
              {[
                ["Utilization Rate", "Hours logged this week ÷ Available hours per week. Measures actual work delivery vs capacity."],
                ["Sprint Coverage", "Hours estimated for sprint issues ÷ Available hours per week. Measures planned workload vs capacity."],
                ["On Track", "Utilization below 70% — capacity available for additional work."],
                ["Monitor", "Utilization 70–90% — healthy but approaching full capacity."],
                ["At Capacity", "Utilization 90–110% — minimal buffer; avoid adding new work."],
                ["Overloaded", "Utilization above 110% — action required to prevent burnout and delivery risk."],
              ].map(([term, def], i) => (
                <tr key={term} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 700, color: "#334155", width: 160 }}>{term}</td>
                  <td style={{ padding: "8px 12px" }}>{def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── Footer ── */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            <strong style={{ color: "#475569" }}>CONFIDENTIAL</strong> · For internal use only · {workspaceName}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            Forge-Worx · Generated {new Date(generatedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
          </div>
        </div>
      </div>
    </>
  );
}
