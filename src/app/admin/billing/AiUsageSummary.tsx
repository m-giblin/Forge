type TenantUsage = {
  tenantId: string;
  tenantName: string;
  inputTokens: number;
  outputTokens: number;
  estCostCents: number;
  platformCalls: number;
  byoCalls: number;
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(cents: number): string {
  return `$${cents.toFixed(2)}`;
}

export default function AiUsageSummary({ rows, notYetMigrated }: { rows: TenantUsage[]; notYetMigrated: boolean }) {
  const totalCost = rows.reduce((s, r) => s + r.estCostCents, 0);
  const totalPlatformCalls = rows.reduce((s, r) => s + r.platformCalls, 0);
  const totalByoCalls = rows.reduce((s, r) => s + r.byoCalls, 0);

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 18, marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>AI usage — last 30 days</h2>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
        Estimated xAI cost per tenant, split by which key paid for it. Platform-key usage is Forge&apos;s own cost
        today — this is the basis for deciding a per-project AI fee once it&apos;s time to bill for it.
      </p>

      {notYetMigrated ? (
        <p style={{ fontSize: 13, color: "#92400e", background: "#fef3c7", borderRadius: 8, padding: "10px 12px" }}>
          Migration 0101_ai_usage_metering.sql hasn&apos;t been run yet — usage tracking will start as soon as it is.
        </p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9ca3af" }}>No AI calls recorded in the last 30 days.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 24, marginBottom: 14, fontSize: 12, color: "#374151" }}>
            <span><strong>{fmtCost(totalCost)}</strong> total est. cost</span>
            <span><strong>{totalPlatformCalls}</strong> platform-key calls</span>
            <span><strong>{totalByoCalls}</strong> BYO-key calls</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#6b7280" }}>
                <th style={{ padding: "6px 8px" }}>Tenant</th>
                <th style={{ padding: "6px 8px" }}>Input tokens</th>
                <th style={{ padding: "6px 8px" }}>Output tokens</th>
                <th style={{ padding: "6px 8px" }}>Platform calls</th>
                <th style={{ padding: "6px 8px" }}>BYO calls</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Est. cost (platform only)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tenantId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 600, color: "#111827" }}>{r.tenantName}</td>
                  <td style={{ padding: "6px 8px" }}>{fmtTokens(r.inputTokens)}</td>
                  <td style={{ padding: "6px 8px" }}>{fmtTokens(r.outputTokens)}</td>
                  <td style={{ padding: "6px 8px" }}>{r.platformCalls}</td>
                  <td style={{ padding: "6px 8px" }}>{r.byoCalls}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{fmtCost(r.estCostCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
