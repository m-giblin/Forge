"use client";

const PROVIDER_LABELS: Record<string, string> = {
  xai:       "xAI (Grok)",
  openai:    "OpenAI",
  anthropic: "Anthropic",
  gemini:    "Google Gemini",
  unknown:   "Unknown",
};

const PROVIDER_COLORS: Record<string, string> = {
  xai:       "#6366f1",
  openai:    "#10b981",
  anthropic: "#f59e0b",
  gemini:    "#3b82f6",
  unknown:   "#94a3b8",
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

type TenantStat = {
  id: string; name: string; turns: number;
  tokens_in: number; tokens_out: number;
  providers: string[]; last_used: string | null; has_byo_key: boolean;
};

export default function AiAnalyticsClient({
  totalTurns,
  totalTokens,
  tenantsUsingAI,
  byoKeyCount,
  aiDisabled,
  thinkTankEnabled,
  providerTotals,
  tenantStats,
  dailyMap,
}: {
  totalTurns: number;
  totalTokens: number;
  tenantsUsingAI: number;
  byoKeyCount: number;
  aiDisabled: boolean;
  thinkTankEnabled: boolean;
  providerTotals: Record<string, { turns: number; tokens: number }>;
  tenantStats: TenantStat[];
  tenantMap: Record<string, string>;
  dailyMap: Record<string, number>;
}) {
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" };
  const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 };

  // Build sparkline from dailyMap: last 30 days
  const sparkDays: number[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    sparkDays.push(dailyMap[key] ?? 0);
  }
  const sparkMax = Math.max(...sparkDays, 1);

  // Provider breakdown sorted by turns
  const providers = Object.entries(providerTotals).sort((a, b) => b[1].turns - a[1].turns);
  const totalProviderTurns = providers.reduce((s, [, v]) => s + v.turns, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Kill switch banner */}
      {aiDisabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, fontSize: 12, color: "#991b1b" }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <strong>AI is globally disabled</strong> — all AI features are blocked across every tenant. Toggle off in Feature Flags → Kill Switches.
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total AI Turns",    value: totalTurns.toLocaleString(), sub: "all time",         color: "#111827" },
          { label: "Total Tokens Used", value: fmtTokens(totalTokens),       sub: "input + output",  color: "#111827" },
          { label: "Tenants Using AI",  value: tenantsUsingAI,               sub: "with AI activity", color: tenantsUsingAI > 0 ? "#4f46e5" : "#94a3b8" },
          { label: "BYO Keys Active",   value: byoKeyCount,                  sub: "tenant-supplied",  color: byoKeyCount > 0 ? "#10b981" : "#94a3b8" },
        ].map((k) => (
          <div key={k.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color, margin: "4px 0 2px", lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Sparkline + provider breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* Daily usage sparkline */}
        <div style={card}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Daily AI Turns — Last 30 Days</span>
          </div>
          <div style={{ padding: "16px 16px 12px" }}>
            {totalTurns === 0 ? (
              <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", padding: "24px 0" }}>No AI usage yet.</div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                {sparkDays.map((v, i) => (
                  <div
                    key={i}
                    title={`${v} turn${v !== 1 ? "s" : ""}`}
                    style={{
                      flex: 1,
                      height: `${(v / sparkMax) * 100}%`,
                      minHeight: v > 0 ? 3 : 0,
                      background: v > 0 ? "#6366f1" : "#f1f5f9",
                      borderRadius: "2px 2px 0 0",
                      transition: "background .1s",
                    }}
                  />
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#cbd5e1" }}>
              <span>30d ago</span><span>Today</span>
            </div>
          </div>
        </div>

        {/* Provider breakdown */}
        <div style={card}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Provider Breakdown</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>by turns</span>
          </div>
          <div style={{ padding: "12px 16px" }}>
            {providers.length === 0 ? (
              <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", padding: "16px 0" }}>No AI turns recorded yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {providers.map(([provider, data]) => {
                  const pct = totalProviderTurns > 0 ? (data.turns / totalProviderTurns) * 100 : 0;
                  const color = PROVIDER_COLORS[provider] ?? "#94a3b8";
                  return (
                    <div key={provider}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{PROVIDER_LABELS[provider] ?? provider}</span>
                        <span style={{ color: "#6b7280" }}>{data.turns.toLocaleString()} turns · {fmtTokens(data.tokens)} tokens</span>
                      </div>
                      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width .3s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature state */}
      <div>
        <div style={sectionLabel}>Platform AI Settings</div>
        <div style={card}>
          {[
            {
              label: "AI Kill Switch",
              desc: "Globally disables all AI features across every tenant",
              status: aiDisabled ? "ACTIVE" : "off",
              statusBg: aiDisabled ? "#fef2f2" : "#f0fdf4",
              statusColor: aiDisabled ? "#dc2626" : "#16a34a",
            },
            {
              label: "Think Tank (AI Sounding Board)",
              desc: "Feature flag controlling AI-powered idea analysis",
              status: thinkTankEnabled ? "enabled" : "disabled",
              statusBg: thinkTankEnabled ? "#f0fdf4" : "#f8fafc",
              statusColor: thinkTankEnabled ? "#16a34a" : "#94a3b8",
            },
          ].map((row, i) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{row.label}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{row.desc}</div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 9, fontSize: 11, fontWeight: 700, background: row.statusBg, color: row.statusColor }}>{row.status}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Change these in <strong>Feature Access</strong> → Kill Switches.</p>
      </div>

      {/* Per-tenant usage table */}
      <div>
        <div style={sectionLabel}>Usage by Tenant</div>
        <div style={card}>
          {tenantStats.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
              No AI usage recorded yet. AI activity appears here once tenants start using Think Tank.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Tenant", "Turns", "Tokens In", "Tokens Out", "Providers", "Last Used", "BYO Key"].map((h) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenantStats.map((t, i) => (
                  <tr key={t.id} style={{ borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 600, color: "#111827" }}>{t.name}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#374151", fontWeight: 600 }}>{t.turns.toLocaleString()}</td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>{fmtTokens(t.tokens_in)}</td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>{fmtTokens(t.tokens_out)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {t.providers.length === 0
                          ? <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                          : t.providers.map((p) => (
                            <span key={p} style={{ padding: "1px 7px", borderRadius: 9, fontSize: 10, fontWeight: 600, background: "#ede9fe", color: "#4f46e5" }}>
                              {PROVIDER_LABELS[p] ?? p}
                            </span>
                          ))
                        }
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12 }}>{timeAgo(t.last_used)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {t.has_byo_key
                        ? <span style={{ padding: "2px 8px", borderRadius: 9, fontSize: 10, fontWeight: 700, background: "#f0fdf4", color: "#16a34a" }}>Yes</span>
                        : <span style={{ fontSize: 11, color: "#cbd5e1" }}>Platform</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
