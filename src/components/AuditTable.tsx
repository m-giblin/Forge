type AuditView = {
  id: string;
  tenant_id: string | null;
  action: string;
  target: string | null;
  actor: string | null;
  created_at: string;
};

// Presentational audit table. `dark` switches palette for the platform console.
export default function AuditTable({
  entries,
  showTenant = false,
  dark = false,
}: {
  entries: AuditView[];
  showTenant?: boolean;
  dark?: boolean;
}) {
  const c = dark
    ? { border: "border-neutral-800", bg: "bg-neutral-900", head: "text-neutral-500", row: "border-neutral-800/60", primary: "text-neutral-100", muted: "text-neutral-400", empty: "text-neutral-500" }
    : { border: "border-neutral-200", bg: "bg-white", head: "text-neutral-400", row: "border-neutral-100", primary: "text-neutral-800", muted: "text-neutral-500", empty: "text-neutral-400" };

  return (
    <div className={`overflow-hidden rounded-xl border ${c.border} ${c.bg}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b ${c.border} text-left text-xs uppercase tracking-wide ${c.head}`}>
            <th className="px-4 py-2.5 font-medium">When</th>
            <th className="px-4 py-2.5 font-medium">Actor</th>
            <th className="px-4 py-2.5 font-medium">Action</th>
            <th className="px-4 py-2.5 font-medium">Target</th>
            {showTenant && <th className="px-4 py-2.5 font-medium">Tenant</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className={`border-b ${c.row} last:border-0`}>
              <td className={`whitespace-nowrap px-4 py-2.5 ${c.muted}`}>{new Date(e.created_at).toLocaleString()}</td>
              <td className={`px-4 py-2.5 ${c.primary}`}>{e.actor ?? "—"}</td>
              <td className="px-4 py-2.5">
                <code className={`rounded px-1.5 py-0.5 text-xs ${dark ? "bg-neutral-800 text-neutral-200" : "bg-neutral-100 text-neutral-700"}`}>
                  {e.action}
                </code>
              </td>
              <td className={`px-4 py-2.5 ${c.muted}`}>{e.target ?? "—"}</td>
              {showTenant && <td className={`px-4 py-2.5 font-mono text-xs ${c.muted}`}>{e.tenant_id ? e.tenant_id.slice(0, 8) : "platform"}</td>}
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={showTenant ? 5 : 4} className={`px-4 py-10 text-center text-sm ${c.empty}`}>
                No activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
