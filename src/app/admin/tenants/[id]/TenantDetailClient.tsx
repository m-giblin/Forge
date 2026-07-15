"use client";

import { useState, useTransition } from "react";
import { setSuspendedAction, deleteTenantAction } from "../../actions";
import { startImpersonationAction } from "@/app/impersonation-actions";
import { setTenantOverrideAction } from "../../flags/actions";
import { timeAgo } from "@/lib/formatRelativeTime";

type Tab = "overview" | "features" | "members" | "audit";

type Tenant = {
  id: string; name: string; slug: string;
  status: "active" | "suspended"; plan: string;
  created_at: string; member_count: number; issue_count: number;
};

type Member = { id: string; role: string; email: string; name: string; joinedAt: string };
type AuditEntry = { id: string; action: string; target: string | null; actor: string | null; created_at: string };

const PLAN_DEFAULTS: Record<string, Record<string, boolean | null>> = {
  kanban:    { basic: true,  premium: true,  pro: true,  enterprise: true  },
  sprints:   { basic: true,  premium: true,  pro: true,  enterprise: true  },
  burndown:  { basic: true,  premium: true,  pro: true,  enterprise: true  },
  dashboards:{ basic: false, premium: true,  pro: true,  enterprise: true  },
  project_portal: { basic: false, premium: true, pro: true, enterprise: true },
  think_tank:{ basic: false, premium: true,  pro: true,  enterprise: true  },
  ai_sprint: { basic: false, premium: true,  pro: true,  enterprise: true  },
  roadmap:   { basic: false, premium: false, pro: null,  enterprise: null  },
  sso:       { basic: false, premium: false, pro: null,  enterprise: null  },
};

const FEATURE_LABELS: Record<string, string> = {
  kanban:       "Kanban Board + Issues",
  sprints:      "Sprint Planning",
  burndown:     "Burndown / Velocity Charts",
  dashboards:   "Mission Control Dashboards",
  project_portal: "Project Portal (Timeline + Costs)",
  think_tank:   "Think Tank (Ideas)",
  ai_sprint:    "AI Sprint Intelligence",
  roadmap:      "Visual Roadmap",
  sso:          "SSO / SAML",
};


export default function TenantDetailClient({
  tenant, health, members, overrides, globalFlags, audit,
}: {
  tenant: Tenant;
  health: number;
  members: Member[];
  overrides: Record<string, boolean>;
  globalFlags: Record<string, boolean>;
  audit: AuditEntry[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>(overrides);
  const [savingFeature, setSavingFeature] = useState<string | null>(null);
  const [featureError, setFeatureError] = useState<string | null>(null);

  const hc = health >= 70 ? "#059669" : health >= 40 ? "#d97706" : "#dc2626";
  const hbg = health >= 70 ? "#f0fdf4" : health >= 40 ? "#fffbeb" : "#fef2f2";
  const hborder = health >= 70 ? "#bbf7d0" : health >= 40 ? "#fde68a" : "#fecaca";

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    });
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "features", label: "Feature Access" },
    { key: "members",  label: "Members" },
    { key: "audit",    label: "Audit Log" },
  ];

  const cardStyle: React.CSSProperties = {
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 14,
  };
  const cardHeaderStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "11px 16px", borderBottom: "1px solid #f1f5f9",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>{tenant.name}</h1>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3, fontFamily: "monospace" }}>/{tenant.slug}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{
            padding: "3px 10px", borderRadius: 9, fontSize: 11, fontWeight: 700,
            background: tenant.status === "active" ? "#d1fae5" : "#fee2e2",
            color: tenant.status === "active" ? "#059669" : "#dc2626",
          }}>{tenant.status}</span>
          <button
            onClick={() => run(() => startImpersonationAction(tenant.id, tenant.slug))}
            disabled={pending}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#f8fafc", color: "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          >
            👁 View as tenant
          </button>
          <button
            onClick={() => run(() => setSuspendedAction(tenant.id, tenant.status === "active"))}
            disabled={pending}
            style={{
              padding: "6px 12px", borderRadius: 7, border: "1px solid #fde68a",
              background: "#fffbeb", color: "#d97706", fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}
          >
            {tenant.status === "active" ? "Suspend" : "Reactivate"}
          </button>
          <button
            onClick={() => {
              if (confirm(`Permanently delete ${tenant.name} and ALL its data? This cannot be undone.`))
                run(() => deleteTenantAction(tenant.id));
            }}
            disabled={pending}
            style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, color: "#dc2626" }}>{error}</div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "9px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "none", borderBottom: `2px solid ${tab === t.key ? "#4f46e5" : "transparent"}`,
              background: "none", color: tab === t.key ? "#4f46e5" : "#6b7280",
              marginBottom: -1, transition: "all .12s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
            <OvCard label="Health Score">
              <div style={{ fontSize: 28, fontWeight: 900, color: hc }}>{health}<span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400 }}>/100</span></div>
              <div style={{ marginTop: 8, height: 4, background: "#f1f5f9", borderRadius: 9 }}>
                <div style={{ height: 4, width: `${health}%`, background: hc, borderRadius: 9 }} />
              </div>
            </OvCard>
            <OvCard label="Plan">
              <div style={{ fontSize: 16, fontWeight: 800, color: "#4f46e5", marginTop: 4 }}>{tenant.plan}</div>
            </OvCard>
            <OvCard label="Members">
              <div style={{ fontSize: 28, fontWeight: 900, color: "#111827" }}>{tenant.member_count}</div>
            </OvCard>
            <OvCard label="Issues">
              <div style={{ fontSize: 28, fontWeight: 900, color: "#111827" }}>{tenant.issue_count}</div>
            </OvCard>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={cardStyle}>
              <div style={cardHeaderStyle}><span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Health Signals</span></div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Tenant status",  val: tenant.status,             good: tenant.status === "active" },
                  { label: "Has members",    val: `${tenant.member_count} members`, good: tenant.member_count > 0 },
                  { label: "Has issues",     val: `${tenant.issue_count} issues`,   good: tenant.issue_count > 0 },
                  { label: "Active usage",   val: tenant.member_count > 0 && tenant.issue_count > 0 ? "Yes" : "Low", good: tenant.member_count > 0 && tenant.issue_count > 0 },
                ].map((s) => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: s.good ? "#059669" : "#dc2626" }}>
                      {s.good ? "✓" : "✗"} {s.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={cardHeaderStyle}><span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Workspace Info</span></div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Tenant ID", val: tenant.id },
                  { label: "Slug",      val: `/${tenant.slug}` },
                  { label: "Created",   val: new Date(tenant.created_at).toLocaleDateString() },
                  { label: "Plan",      val: tenant.plan },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{row.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", fontFamily: row.label === "Tenant ID" || row.label === "Slug" ? "monospace" : undefined, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Feature Access ── */}
      {tab === "features" && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Feature Access — {tenant.name}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Changes take effect immediately</span>
          </div>
          {featureError && (
            <div style={{ margin: "0 16px 0", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, color: "#dc2626" }}>{featureError}</div>
          )}
          <div style={{ padding: "0 0 8px" }}>
            <div style={{ display: "flex", padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Feature</span>
              <span style={{ width: 130, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Plan Default</span>
              <span style={{ width: 80, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Effective</span>
              <span style={{ width: 160, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>Override</span>
            </div>
            {Object.keys(FEATURE_LABELS).map((key) => {
              const planVal = PLAN_DEFAULTS[key]?.[tenant.plan];
              const hasOverride = key in localOverrides;
              const globalOff = globalFlags[key] === false;
              const enabled = globalOff ? false : (hasOverride ? localOverrides[key] : (planVal === true));
              const overrideValue: "default" | "on" | "off" = !hasOverride ? "default" : localOverrides[key] ? "on" : "off";
              const isSaving = savingFeature === key;

              async function handleOverrideChange(val: string) {
                setSavingFeature(key);
                setFeatureError(null);
                const newVal = val === "default" ? null : val === "on";
                try {
                  await setTenantOverrideAction(tenant.id, key, newVal);
                  setLocalOverrides((prev) => {
                    const next = { ...prev };
                    if (newVal === null) delete next[key];
                    else next[key] = newVal;
                    return next;
                  });
                } catch (e) {
                  setFeatureError(e instanceof Error ? e.message : "Failed to update");
                } finally {
                  setSavingFeature(null);
                }
              }

              return (
                <div key={key} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f8fafc" }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#374151" }}>{FEATURE_LABELS[key]}</span>
                  <span style={{ width: 130, textAlign: "center" }}>
                    {planVal === null
                      ? <span style={{ fontSize: 11, color: "#94a3b8" }}>Coming soon</span>
                      : planVal
                        ? <span style={{ fontSize: 11, fontWeight: 600, color: "#059669" }}>✓ Included</span>
                        : <span style={{ fontSize: 11, color: "#94a3b8" }}>— Not included</span>}
                  </span>
                  <span style={{ width: 80, textAlign: "center" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: 9, fontSize: 10, fontWeight: 700,
                      background: globalOff ? "#fef3c7" : enabled ? "#d1fae5" : "#fee2e2",
                      color: globalOff ? "#d97706" : enabled ? "#059669" : "#dc2626",
                    }}>
                      {globalOff ? "Global off" : enabled ? "✓ On" : "✗ Off"}
                    </span>
                  </span>
                  <span style={{ width: 160, textAlign: "center" }}>
                    {globalOff ? (
                      <span style={{ fontSize: 11, color: "#d97706" }}>Blocked by kill switch</span>
                    ) : !(key in globalFlags) ? (
                      <span style={{ fontSize: 11, color: "#cbd5e1" }}>Plan tier only</span>
                    ) : (
                      <select
                        value={overrideValue}
                        disabled={isSaving}
                        onChange={(e) => handleOverrideChange(e.target.value)}
                        style={{
                          padding: "4px 8px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                          border: overrideValue !== "default" ? "1px solid #a5b4fc" : "1px solid #e5e7eb",
                          background: overrideValue === "on" ? "#ede9fe" : overrideValue === "off" ? "#fef2f2" : "#fff",
                          color: overrideValue === "on" ? "#4f46e5" : overrideValue === "off" ? "#dc2626" : "#374151",
                          fontWeight: overrideValue !== "default" ? 600 : 400,
                          opacity: isSaving ? .5 : 1,
                          outline: "none",
                        }}
                      >
                        <option value="default">Default ({planVal ? "on" : "off"})</option>
                        <option value="on">Force On</option>
                        <option value="off">Force Off</option>
                      </select>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "10px 16px", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
            <p style={{ fontSize: 11, color: "#94a3b8" }}>
              "Default" follows the plan. "Force On/Off" overrides for this tenant only. Global kill-switches override everything.
            </p>
          </div>
        </div>
      )}

      {/* ── Members ── */}
      {tab === "members" && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Members ({members.length})</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Email", "Role", "Joined"].map((h) => (
                  <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                  <td style={{ padding: "9px 14px", fontSize: 12, fontWeight: 600, color: "#111827" }}>{m.name}</td>
                  <td style={{ padding: "9px 14px", fontSize: 11, color: "#6b7280" }}>{m.email}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{
                      display: "inline-flex", padding: "2px 8px", borderRadius: 9, fontSize: 10, fontWeight: 700,
                      background: m.role === "owner" ? "#ede9fe" : "#f1f5f9",
                      color: m.role === "owner" ? "#4f46e5" : "#64748b",
                    }}>{m.role.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: "9px 14px", fontSize: 11, color: "#94a3b8" }}>{timeAgo(m.joinedAt)}</td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No members yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Audit ── */}
      {tab === "audit" && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Audit Log</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Last 30 events for this tenant</span>
          </div>
          <div>
            {audit.map((entry) => (
              <div key={entry.id} style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#94a3b8", width: 100, flexShrink: 0 }}>{timeAgo(entry.created_at)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", width: 160, flexShrink: 0 }}>{entry.action}</span>
                <span style={{ fontSize: 12, color: "#374151", flex: 1 }}>
                  {entry.actor && <strong style={{ color: "#111827" }}>{entry.actor} </strong>}
                  {entry.target && <span style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8" }}>→ {entry.target}</span>}
                </span>
              </div>
            ))}
            {audit.length === 0 && (
              <p style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No audit events for this tenant.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OvCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 2 }}>{label}</div>
      {children}
    </div>
  );
}
