"use client";

import Link from "next/link";

type Member = { role: string; created_at: string; users: { email: string; created_at: string } | null };
type ApiKey = {
  id: string; name: string; key_prefix: string; scopes: string[];
  last_used_at: string | null; revoked_at: string | null; expires_at: string | null; created_at: string;
};

interface Props {
  members: Member[];
  apiKeys: ApiKey[];
  activeKeys: ApiKey[];
  staleKeys: ApiKey[];
  expiringKeys: ApiKey[];
  owners: Member[];
  admins: Member[];
  recentMembers: Member[];
  ssoConfig: { provider: string; updated_at: string } | null;
  openCompliance: Array<{ id: string; status: string; created_at: string }>;
  complianceRequests: Array<{ id: string; status: string; created_at: string }>;
  securityScore: number;
  slug: string;
}

function relTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-700 bg-green-50 border-green-200" :
                score >= 60 ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
                              "text-red-700 bg-red-50 border-red-200";
  const label = score >= 80 ? "Good" : score >= 60 ? "Fair" : "Needs attention";
  return (
    <div className={`flex flex-col items-center rounded-2xl border px-8 py-5 ${color}`}>
      <span className="text-5xl font-bold">{score}</span>
      <span className="text-sm font-semibold mt-1">{label}</span>
      <span className="text-xs opacity-70 mt-0.5">Security score</span>
    </div>
  );
}

function KpiCard({ label, value, icon, sub, warn }: {
  label: string; value: string | number; icon: string; sub?: string; warn?: boolean
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 bg-white ${warn ? "border-orange-200" : "border-neutral-200"}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-neutral-500">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold mt-1 ${warn ? "text-orange-700" : "text-neutral-900"}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Alert({ level, text }: { level: "warn" | "info" | "ok"; text: string }) {
  const style = level === "warn"
    ? "bg-orange-50 border-orange-200 text-orange-800"
    : level === "ok"
    ? "bg-green-50 border-green-200 text-green-800"
    : "bg-blue-50 border-blue-200 text-blue-800";
  const icon = level === "warn" ? "⚠️" : level === "ok" ? "✅" : "ℹ️";
  return (
    <div className={`flex gap-2 rounded-lg border px-3 py-2.5 text-sm ${style}`}>
      <span className="shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

export default function SecurityDashboard({
  members, apiKeys, activeKeys, staleKeys, expiringKeys,
  owners, admins, recentMembers, ssoConfig, openCompliance, securityScore, slug,
}: Props) {
  const alerts: Array<{ level: "warn" | "info" | "ok"; text: string }> = [];

  if (staleKeys.length > 0)
    alerts.push({ level: "warn", text: `${staleKeys.length} API key${staleKeys.length > 1 ? "s" : ""} haven't been used in 90+ days. Consider revoking.` });
  if (expiringKeys.length > 0)
    alerts.push({ level: "warn", text: `${expiringKeys.length} API key${expiringKeys.length > 1 ? "s" : ""} expire${expiringKeys.length === 1 ? "s" : ""} within 30 days.` });
  if (owners.length > 3)
    alerts.push({ level: "warn", text: `${owners.length} workspace owners — consider reducing to 1–2 for least-privilege access.` });
  if (openCompliance.length > 0)
    alerts.push({ level: "warn", text: `${openCompliance.length} open compliance request${openCompliance.length > 1 ? "s" : ""} need attention.` });
  if (!ssoConfig)
    alerts.push({ level: "info", text: "SSO/SAML is not configured. Enable it to enforce centralized authentication." });
  if (recentMembers.length > 0)
    alerts.push({ level: "info", text: `${recentMembers.length} member${recentMembers.length > 1 ? "s" : ""} joined in the last 30 days.` });
  if (staleKeys.length === 0 && expiringKeys.length === 0 && owners.length <= 3)
    alerts.push({ level: "ok", text: "No critical API key issues found." });
  if (ssoConfig)
    alerts.push({ level: "ok", text: `SSO is active via ${ssoConfig.provider}.` });

  const ROLE_COLOR: Record<string, string> = {
    owner: "bg-purple-50 text-purple-700 border-purple-200",
    admin: "bg-indigo-50 text-indigo-700 border-indigo-200",
    member: "bg-neutral-50 text-neutral-600 border-neutral-200",
    viewer: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Security Overview</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Monitor access, credentials, and compliance posture.
          </p>
        </div>
        <ScoreBadge score={securityScore} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Members" value={members.length} icon="👥" sub={`${owners.length} owner${owners.length !== 1 ? "s" : ""}`} />
        <KpiCard label="Active API Keys" value={activeKeys.length} icon="🔑" sub={`${apiKeys.length} total`} warn={staleKeys.length > 0} />
        <KpiCard label="Stale Keys" value={staleKeys.length} icon="🔒" sub="unused 90+ days" warn={staleKeys.length > 0} />
        <KpiCard label="Open Compliance" value={openCompliance.length} icon="📋" warn={openCompliance.length > 0} />
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        {alerts.map((a, i) => <Alert key={i} level={a.level} text={a.text} />)}
      </div>

      {/* Members table */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">Team Access</p>
          <span className="text-xs text-neutral-400">{members.length} members</span>
        </div>
        <div className="divide-y divide-neutral-100">
          {members.slice(0, 20).map((m, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-2.5">
              <div>
                <p className="text-sm font-medium text-neutral-800">{m.users?.email ?? "Unknown"}</p>
                <p className="text-xs text-neutral-400">Joined {relTime(m.created_at)}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_COLOR[m.role] ?? ""}`}>
                {m.role}
              </span>
            </div>
          ))}
          {members.length > 20 && (
            <p className="px-5 py-2.5 text-xs text-neutral-400">+{members.length - 20} more</p>
          )}
        </div>
      </div>

      {/* API Keys */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">API Keys</p>
          <Link
            href={`/${slug}/admin/settings/api-keys`}
            className="text-xs text-indigo-600 hover:underline"
          >
            Manage →
          </Link>
        </div>
        {apiKeys.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-400 text-center">No API keys yet</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {apiKeys.slice(0, 15).map((k) => {
              const isStale = !k.revoked_at && !k.last_used_at;
              const isRevoked = !!k.revoked_at;
              return (
                <div key={k.id} className="flex items-center justify-between px-5 py-2.5 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">{k.name}</p>
                    <p className="text-xs text-neutral-400 font-mono">{k.key_prefix}…</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isRevoked && <span className="rounded-full bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-500">revoked</span>}
                    {!isRevoked && isStale && <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] text-orange-700">never used</span>}
                    {!isRevoked && k.last_used_at && <span className="text-[11px] text-neutral-400">{relTime(k.last_used_at)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SSO status */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">SSO / Authentication</p>
          <Link href={`/${slug}/admin/settings/sso`} className="text-xs text-indigo-600 hover:underline">Configure →</Link>
        </div>
        <div className="px-5 py-4">
          {ssoConfig ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔐</span>
              <div>
                <p className="text-sm font-medium text-neutral-900">SSO active via {ssoConfig.provider.toUpperCase()}</p>
                <p className="text-xs text-neutral-400">Updated {relTime(ssoConfig.updated_at)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔓</span>
              <div>
                <p className="text-sm font-medium text-neutral-700">No SSO configured</p>
                <p className="text-xs text-neutral-400">Members sign in with email/password or OAuth</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
