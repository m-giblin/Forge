import Link from "next/link";
import { listTenants } from "@/lib/services/platform";
import { listPlatformAudit } from "@/lib/services/audit";
// eslint-disable-next-line no-restricted-imports -- admin: service-role required (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function healthScore(t: { member_count: number; issue_count: number; status: string }) {
  let score = 0;
  if (t.status === "active") score += 25;
  if (t.member_count >= 2) score += 25;
  else if (t.member_count === 1) score += 10;
  if (t.issue_count >= 10) score += 30;
  else if (t.issue_count >= 3) score += 20;
  else if (t.issue_count >= 1) score += 10;
  if (t.member_count > 0 && t.issue_count > 0) score += 20;
  return Math.min(score, 100);
}

function HealthDot({ score }: { score: number }) {
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 5 }} />;
}

export default async function AdminDashboardPage() {
  const svc = createSupabaseServiceClient();

  const [tenants, auditEntries, openTickets] = await Promise.all([
    listTenants(),
    listPlatformAudit(),
    svc
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .then((r) => r.count ?? 0),
  ]);

  const scored = tenants.map((t) => ({ ...t, health: healthScore(t) }));
  const healthy  = scored.filter((t) => t.health >= 70).length;
  const watch    = scored.filter((t) => t.health >= 40 && t.health < 70).length;
  const atRisk   = scored.filter((t) => t.health < 40).length;
  const active   = tenants.filter((t) => t.status === "active").length;
  const suspended = tenants.filter((t) => t.status === "suspended").length;

  const recentAudit = auditEntries.slice(0, 8);

  const S = adminStyles;

  return (
    <main style={{ padding: "24px 28px", maxWidth: 1100 }}>
      {/* Page header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>Platform Dashboard</h1>
        <p style={S.pageSub}>Real-time overview of all tenants, support load, and recent activity.</p>
      </div>

      {/* Alert banner */}
      {atRisk > 0 && (
        <div style={S.alertBanner}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <span><strong>{atRisk} tenant{atRisk > 1 ? "s" : ""} at risk</strong> — health below 40. Review before their trial expires.</span>
          <Link href="/admin/tenants" style={S.alertBtn}>Review tenants →</Link>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
        <KpiCard label="Total Tenants"  value={tenants.length} sub={`${active} active · ${suspended} suspended`} />
        <KpiCard label="Healthy"        value={healthy}  color="#059669" sub="Health ≥ 70" />
        <KpiCard label="Watch"          value={watch}    color="#d97706" sub="Health 40–69" />
        <KpiCard label="At Risk"        value={atRisk}   color="#dc2626" sub="Health < 40" alert={atRisk > 0} />
        <KpiCard label="Open Support"   value={openTickets as number} color={(openTickets as number) > 0 ? "#dc2626" : undefined} sub="tickets open" alert={(openTickets as number) > 0} />
      </div>

      {/* Health pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { n: healthy, label: "Healthy", sub: "70–100", bg: "#f0fdf4", border: "#bbf7d0", col: "#059669" },
          { n: watch,   label: "Watch",   sub: "40–69",  bg: "#fffbeb", border: "#fde68a", col: "#d97706" },
          { n: atRisk,  label: "At Risk", sub: "<40",    bg: "#fef2f2", border: "#fecaca", col: "#dc2626" },
        ].map((s) => (
          <div key={s.label} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 16px", flex: 1,
            background: s.bg, border: `1px solid ${s.border}`, borderRadius: 9,
          }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: s.col, lineHeight: 1 }}>{s.n}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: s.col }}>{s.label}</span>
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>{s.sub}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Tenant table */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>All Tenants</span>
            <Link href="/admin/tenants" style={S.viewLink}>Manage all →</Link>
          </div>
          <table style={S.table}>
            <thead>
              <tr>
                <Th>Tenant</Th><Th>Health</Th><Th>Members</Th><Th>Issues</Th><Th>Status</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {scored.map((t) => {
                const hc = t.health >= 70 ? "#059669" : t.health >= 40 ? "#d97706" : "#dc2626";
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{t.name}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{t.slug}</div>
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <HealthDot score={t.health} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: hc }}>{t.health}</span>
                      </div>
                    </td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: "#6b7280" }}>{t.member_count}</td>
                    <td style={{ padding: "9px 14px", fontSize: 12, color: "#6b7280" }}>{t.issue_count}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{
                        display: "inline-flex", padding: "2px 8px", borderRadius: 9, fontSize: 10, fontWeight: 700,
                        background: t.status === "active" ? "#d1fae5" : "#fee2e2",
                        color: t.status === "active" ? "#059669" : "#dc2626",
                      }}>{t.status}</span>
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      <Link href={`/admin/tenants/${t.id}`} style={{ fontSize: 11, fontWeight: 600, color: "#4f46e5", textDecoration: "none" }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {scored.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No tenants yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right column: quick actions + activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Quick Actions */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.cardTitle}>Quick Actions</span>
            </div>
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              <QuickAction href="/admin/tenants" label="Provision workspace" desc="Add a new tenant to the platform" icon="＋" />
              <QuickAction href="/admin/support" label="Support queue" desc={`${openTickets} open ticket${(openTickets as number) !== 1 ? "s" : ""}`} icon="✉" alert={(openTickets as number) > 0} />
              <QuickAction href="/admin/flags" label="Feature access" desc="Toggle features per plan or tenant" icon="⚑" />
              <QuickAction href="/admin/compliance" label="Compliance" desc="GDPR, CCPA, data governance" icon="☰" />
              <QuickAction href="/admin/audit" label="Audit log" desc="Platform-wide activity trail" icon="◷" />
            </div>
          </div>

          {/* Recent activity */}
          <div style={{ ...S.card, flex: 1 }}>
            <div style={S.cardHeader}>
              <span style={S.cardTitle}>Recent Activity</span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {recentAudit.length === 0 ? (
                <p style={{ padding: "16px 14px", fontSize: 12, color: "#94a3b8" }}>No audit events yet.</p>
              ) : (
                recentAudit.map((entry) => (
                  <div key={entry.id} style={{ display: "flex", gap: 10, padding: "8px 14px", borderBottom: "1px solid #f8fafc" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: "#374151", lineHeight: 1.4 }}>
                        <strong style={{ color: "#111827" }}>{entry.actor ?? "system"}</strong>{" "}
                        <span style={{ color: "#6b7280" }}>{entry.action}</span>
                        {entry.target && <span style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", marginLeft: 4 }}>→ {entry.target}</span>}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, color: "#cbd5e1", flexShrink: 0 }}>{timeAgo(entry.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Shared components ──────────────────────────────────────────

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{
      padding: "9px 14px", textAlign: "left", fontSize: 10,
      fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
      letterSpacing: ".07em", borderBottom: "1px solid #f1f5f9",
    }}>{children}</th>
  );
}

function KpiCard({ label, value, sub, color, alert }: { label: string; value: number; sub?: string; color?: string; alert?: boolean }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${alert ? "#fecaca" : "#e5e7eb"}`,
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: color ?? "#111827", margin: "4px 0 2px", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

function QuickAction({ href, label, desc, icon, alert }: { href: string; label: string; desc?: string; icon?: string; alert?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "9px 10px", borderRadius: 8, textDecoration: "none",
        border: `1px solid ${alert ? "#fecaca" : "#f1f5f9"}`,
        background: alert ? "#fef2f2" : "#fafafa",
        transition: "all .12s",
      }}
    >
      <span style={{ fontSize: 14, color: alert ? "#dc2626" : "#6366f1", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: alert ? "#dc2626" : "#111827" }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{desc}</div>}
      </div>
    </Link>
  );
}

// ── Shared style tokens ────────────────────────────────────────

export const adminStyles = {
  pageTitle: { fontSize: 18, fontWeight: 800, color: "#111827" } as React.CSSProperties,
  pageSub:   { fontSize: 12, color: "#6b7280", marginTop: 4 } as React.CSSProperties,
  card:      { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" as const } as React.CSSProperties,
  cardHeader:{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #f1f5f9" } as React.CSSProperties,
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#111827" } as React.CSSProperties,
  table:     { width: "100%", borderCollapse: "collapse" as const } as React.CSSProperties,
  viewLink:  { fontSize: 11, fontWeight: 600, color: "#4f46e5", textDecoration: "none" } as React.CSSProperties,
  alertBanner: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "11px 16px", background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 9, marginBottom: 16, fontSize: 12, color: "#991b1b",
  } as React.CSSProperties,
  alertBtn: {
    marginLeft: "auto", padding: "5px 12px", borderRadius: 6,
    background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 700,
    textDecoration: "none", whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  backLink: {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: 12, color: "#6b7280", textDecoration: "none", fontWeight: 500,
    marginBottom: 18,
  } as React.CSSProperties,
};
