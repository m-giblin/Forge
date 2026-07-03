import Link from "next/link";
import { listTenants } from "@/lib/services/platform";
import { adminStyles as S } from "../page";
import AdminProvisionForm from "./AdminProvisionForm";

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

export default async function TenantsPage() {
  const tenants = await listTenants();
  const scored = tenants.map((t) => ({ ...t, health: healthScore(t) }));

  return (
    <main style={{ padding: "24px 28px", maxWidth: 1100 }}>
      <Link href="/admin" style={S.backLink}>← Dashboard</Link>
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>Tenants</h1>
        <p style={S.pageSub}>Every workspace on the platform. Provision, manage, or suspend access.</p>
      </div>

      {/* Provision */}
      <div style={{ ...S.card, marginBottom: 18 }}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>Provision New Workspace</span>
        </div>
        <div style={{ padding: "14px 16px" }}>
          <AdminProvisionForm />
        </div>
      </div>

      {/* Tenant table */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>All Tenants ({tenants.length})</span>
        </div>
        <table style={S.table}>
          <thead>
            <tr>
              {["Tenant", "Health", "Members", "Issues", "Plan", "Status", ""].map((h) => (
                <th key={h} style={{
                  padding: "9px 14px", textAlign: "left", fontSize: 10,
                  fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
                  letterSpacing: ".07em", borderBottom: "1px solid #f1f5f9",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scored.map((t) => {
              const hc = t.health >= 70 ? "#059669" : t.health >= 40 ? "#d97706" : "#dc2626";
              const hbg = t.health >= 70 ? "#f0fdf4" : t.health >= 40 ? "#fffbeb" : "#fef2f2";
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>/{t.slug}</div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 8,
                      background: hbg, fontSize: 12, fontWeight: 700, color: hc,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: hc, display: "inline-block" }} />
                      {t.health}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{t.member_count}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{t.issue_count}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      display: "inline-flex", padding: "2px 8px", borderRadius: 9,
                      fontSize: 10, fontWeight: 700,
                      background: "#ede9fe", color: "#4f46e5",
                    }}>{t.plan ?? "basic"}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      display: "inline-flex", padding: "2px 8px", borderRadius: 9,
                      fontSize: 10, fontWeight: 700,
                      background: t.status === "active" ? "#d1fae5" : "#fee2e2",
                      color: t.status === "active" ? "#059669" : "#dc2626",
                    }}>{t.status}</span>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      style={{ fontSize: 11, fontWeight: 600, color: "#4f46e5", textDecoration: "none" }}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {scored.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No tenants yet. Provision your first workspace above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
