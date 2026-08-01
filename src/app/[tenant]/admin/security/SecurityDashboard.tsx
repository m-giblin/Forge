"use client";

import PageHeader from "@/components/patterns/PageHeader";
import StatsRow from "@/components/patterns/admin/StatsRow";
import AdminList, { type AdminListItem } from "@/components/patterns/admin/AdminList";
import { useRouter } from "next/navigation";

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

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function ActionBadge({ label }: { label: string }) {
  const tone = label === "Action needed" ? { bg: "#fbeae8", fg: "#c0392b" } : label === "Expiring" ? { bg: "#fdf1de", fg: "#c9791d" } : { bg: "#eaf1f8", fg: "#3a6ea8" };
  return (
    <span className="inline-block rounded-full px-2 py-[3px] text-[11px] font-semibold" style={{ backgroundColor: tone.bg, color: tone.fg }}>
      {label}
    </span>
  );
}

export default function SecurityDashboard({
  members, apiKeys, activeKeys, staleKeys, expiringKeys,
  owners, ssoConfig, openCompliance, securityScore, slug,
}: Props) {
  const router = useRouter();

  const items: AdminListItem[] = [];

  if (staleKeys.length > 0) {
    items.push({
      key: "stale-keys",
      title: `${staleKeys.length} API key${staleKeys.length > 1 ? "s" : ""} unused 90+ days`,
      subline: staleKeys.slice(0, 3).map((k) => k.name).join(", "),
      badge: <ActionBadge label="Action needed" />,
      actionLabel: "Review",
      onAction: () => router.push(`/${slug}/admin/settings/api-keys`),
    });
  }
  if (expiringKeys.length > 0) {
    const soonest = expiringKeys.reduce((a, b) => (new Date(a.expires_at!).getTime() < new Date(b.expires_at!).getTime() ? a : b));
    items.push({
      key: "expiring-keys",
      title: `${expiringKeys.length} API key${expiringKeys.length > 1 ? "s" : ""} expiring soon`,
      subline: `${soonest.name} expires in ${daysUntil(soonest.expires_at!)} days`,
      badge: <ActionBadge label="Expiring" />,
      actionLabel: "Rotate",
      onAction: () => router.push(`/${slug}/admin/settings/api-keys`),
    });
  }
  if (!ssoConfig) {
    items.push({
      key: "no-sso",
      title: "No SSO enforced",
      subline: "Members can still sign in with a password",
      badge: <ActionBadge label="Recommended" />,
      actionLabel: "Configure",
      onAction: () => router.push(`/${slug}/admin/settings/sso`),
    });
  }
  if (owners.length > 3) {
    items.push({
      key: "many-owners",
      title: `${owners.length} workspace owners`,
      subline: "Consider reducing to 1–2 for least-privilege access",
      badge: <ActionBadge label="Recommended" />,
      actionLabel: "Review",
      onAction: () => router.push(`/${slug}/admin/members`),
    });
  }
  if (openCompliance.length > 0) {
    items.push({
      key: "compliance",
      title: `${openCompliance.length} open compliance request${openCompliance.length > 1 ? "s" : ""}`,
      subline: "Needs review and resolution",
      badge: <ActionBadge label="Action needed" />,
      actionLabel: "Review",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Security Overview" subtitle="Posture across accounts, sessions and access" />

      <div className="space-y-5 px-6">
        <StatsRow
          items={[
            { label: "Security score", value: securityScore, hint: securityScore >= 80 ? "Good" : securityScore >= 60 ? "Fair" : "Needs attention" },
            { label: "Active API keys", value: activeKeys.length, hint: `${apiKeys.length} total` },
            { label: "Stale keys", value: staleKeys.length, hint: "unused 90+ days" },
            { label: "Members", value: members.length, hint: `${owners.length} owner${owners.length !== 1 ? "s" : ""}` },
          ]}
        />

        <div>
          <h2 className="mb-2 text-[12.5px] font-bold text-[#20201d]">Needs attention</h2>
          {items.length === 0 ? (
            <p className="text-[12.5px] text-[#a19d90]">No open items — posture looks healthy.</p>
          ) : (
            <AdminList items={items} />
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[12.5px] font-bold text-[#20201d]">SSO / Authentication</h2>
            <a href={`/${slug}/admin/settings/sso`} className="text-[11.5px] font-semibold text-[#b7452f] hover:underline">Configure →</a>
          </div>
          <AdminList
            items={[
              ssoConfig
                ? { key: "sso", title: `SSO active via ${ssoConfig.provider.toUpperCase()}`, subline: `Updated ${relTime(ssoConfig.updated_at)}` }
                : { key: "sso", title: "No SSO configured", subline: "Members sign in with email/password or OAuth" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
