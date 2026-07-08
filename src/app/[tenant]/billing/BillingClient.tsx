"use client";

import { useState } from "react";
import Link from "next/link";

interface TenantBilling {
  subscription_status: string;
  subscription_tier: string;
  subscription_seats: number;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  name: string;
}

interface BillingClientProps {
  slug: string;
  tenant: TenantBilling;
  isOwner: boolean;
}

const TIERS = [
  {
    key: "basic",
    name: "Basic",
    price: 9,
    description: "For small teams that need a better board.",
    features: [
      "Unlimited issues & projects",
      "Kanban + List views",
      "Sprint planning",
      "Burndown & Velocity charts",
      "5 GB storage",
      "Email support",
    ],
    highlight: false,
    comingSoon: false,
  },
  {
    key: "premium",
    name: "Premium",
    price: 19,
    description: "Full analytics and stakeholder intelligence.",
    features: [
      "Everything in Basic",
      "Cycle Time & Issue Aging analytics",
      "Custom Report Builder",
      "Stakeholder PDF/Excel exports",
      "Scheduled automated reports",
      "AI Sprint Intelligence",
      "Priority support",
      "Unlimited storage",
    ],
    highlight: true,
    comingSoon: false,
  },
  {
    key: "pro",
    name: "Pro",
    price: null,
    description: "SSO, advanced AI, custom integrations — coming soon.",
    features: [
      "Everything in Premium",
      "SSO / SAML",
      "Advanced AI assistant",
      "Custom integrations",
      "Dedicated CSM",
    ],
    highlight: false,
    comingSoon: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: null,
    description: "On-premise, volume pricing, white-glove onboarding.",
    features: [
      "Everything in Pro",
      "On-premise option",
      "Custom AI models",
      "Volume seat pricing",
      "Executive business review",
    ],
    highlight: false,
    comingSoon: true,
  },
] as const;

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  return Math.ceil((new Date(endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function BillingClient({ slug, tenant, isOwner }: BillingClientProps) {
  const [seats, setSeats] = useState(Math.max(1, tenant.subscription_seats));
  const [selectedTier, setSelectedTier] = useState(tenant.subscription_tier === "trialing" ? "premium" : tenant.subscription_tier);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trialDaysLeft = daysLeft(tenant.trial_ends_at);
  const isExpired = tenant.subscription_status === "expired";
  const isTrialing = tenant.subscription_status === "trialing";

  async function handleActivate() {
    if (!isOwner) return;
    setLoading(true);
    setError(null);
    try {
      // Try real Stripe Checkout first — returns a normal 200 with an `error`
      // reason (not_configured/no_price) rather than an HTTP error when Stripe
      // isn't wired up yet, so this falls through to the manual request flow
      // below with zero behavior change until keys + a price ID are set.
      const checkoutRes = await fetch(`/api/tenants/${slug}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier, seats }),
      });
      const checkoutData = await checkoutRes.json().catch(() => ({}));
      if (checkoutRes.ok && checkoutData.url) {
        window.location.href = checkoutData.url;
        return;
      }

      const res = await fetch(`/api/tenants/${slug}/billing/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier, seats }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to submit request.");
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const selectedTierData = TIERS.find((t) => t.key === selectedTier) ?? TIERS[1];
  const monthlyCost = selectedTierData.price ? selectedTierData.price * seats : null;

  return (
    <div className="w-full px-6 py-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-neutral-900">Billing & Plan</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your Forge-Worx subscription for <strong>{tenant.name}</strong>.
        </p>
      </div>

      {/* Trial / status banner */}
      {isTrialing && trialDaysLeft !== null && (
        <div className={`mb-6 rounded-xl border px-5 py-4 flex items-start justify-between gap-4 ${
          trialDaysLeft <= 1
            ? "border-red-200 bg-red-50"
            : trialDaysLeft <= 3
            ? "border-orange-200 bg-orange-50"
            : "border-indigo-200 bg-indigo-50"
        }`}>
          <div>
            <p className={`font-semibold text-sm ${
              trialDaysLeft <= 1 ? "text-red-800" : trialDaysLeft <= 3 ? "text-orange-800" : "text-indigo-800"
            }`}>
              {trialDaysLeft <= 0
                ? "Your trial has ended."
                : trialDaysLeft === 1
                ? "⚠️ Your trial ends today."
                : `⏰ ${trialDaysLeft} days left on your Premium trial.`}
            </p>
            <p className={`text-xs mt-0.5 ${
              trialDaysLeft <= 1 ? "text-red-600" : trialDaysLeft <= 3 ? "text-orange-600" : "text-indigo-600"
            }`}>
              Activate a plan below to keep Premium access without interruption.
            </p>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-semibold text-sm text-red-800">Your trial has ended.</p>
          <p className="text-xs text-red-600 mt-0.5">
            Your workspace is on the Basic plan. Upgrade to restore Premium features. No data was lost.
          </p>
        </div>
      )}

      {/* Current plan summary */}
      <div className="mb-8 rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4 flex flex-wrap gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">Current plan</p>
          <p className="text-sm font-bold text-neutral-900 capitalize">
            {isTrialing ? "Premium (trial)" : tenant.subscription_tier}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">Status</p>
          <p className="text-sm font-bold text-neutral-900 capitalize">{tenant.subscription_status}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-0.5">Active seats</p>
          <p className="text-sm font-bold text-neutral-900">{tenant.subscription_seats}</p>
        </div>
      </div>

      {!isOwner && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Only workspace owners can change the billing plan. Contact your workspace owner.
        </div>
      )}

      {/* Tier selector */}
      <h2 className="text-base font-bold text-neutral-900 mb-4">Choose a plan</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {TIERS.map((tier) => {
          const isSelected = selectedTier === tier.key;
          const isCurrent = tenant.subscription_tier === tier.key && !isTrialing;
          return (
            <button
              key={tier.key}
              type="button"
              disabled={!isOwner || !!tier.comingSoon}
              onClick={() => !tier.comingSoon && setSelectedTier(tier.key)}
              className={`relative flex flex-col rounded-2xl border p-5 text-left transition-all ${
                tier.comingSoon
                  ? "border-neutral-200 bg-neutral-50 opacity-60 cursor-not-allowed"
                  : isSelected
                  ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/50"
                  : "border-neutral-200 bg-white hover:border-neutral-300 cursor-pointer"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-bold text-white">
                  Most Popular
                </span>
              )}
              {tier.comingSoon && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-400 px-3 py-0.5 text-xs font-bold text-white">
                  Coming Soon
                </span>
              )}
              {isCurrent && !isTrialing && (
                <span className="absolute -top-3 right-3 rounded-full bg-green-600 px-3 py-0.5 text-xs font-bold text-white">
                  Current
                </span>
              )}

              <div className="mb-3">
                <h3 className="text-sm font-bold text-neutral-900">{tier.name}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{tier.description}</p>
              </div>

              <div className="mb-3">
                {tier.price ? (
                  <span className="text-2xl font-black text-neutral-900">${tier.price}<span className="text-xs font-normal text-neutral-400">/seat/mo</span></span>
                ) : (
                  <span className="text-base font-bold text-neutral-400">Custom</span>
                )}
              </div>

              <ul className="space-y-1 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-neutral-600">
                    <span className="text-indigo-500 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Seat selector + order summary */}
      {isOwner && !TIERS.find((t) => t.key === selectedTier)?.comingSoon && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 mb-6">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">Configure your plan</h3>

          <div className="flex items-center gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Number of seats</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSeats((s) => Math.max(1, s - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-lg font-bold text-neutral-600 hover:bg-neutral-100"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={seats}
                  onChange={(e) => setSeats(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-16 rounded-lg border border-neutral-200 px-3 py-1.5 text-center text-sm font-bold text-neutral-900 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSeats((s) => Math.min(500, s + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-lg font-bold text-neutral-600 hover:bg-neutral-100"
                >
                  +
                </button>
              </div>
            </div>

            {monthlyCost !== null && (
              <div className="ml-auto text-right">
                <p className="text-xs text-neutral-500">Monthly total</p>
                <p className="text-2xl font-black text-neutral-900">${monthlyCost.toLocaleString()}</p>
                <p className="text-xs text-neutral-400">{seats} seat{seats !== 1 ? "s" : ""} × ${selectedTierData.price}/mo</p>
              </div>
            )}
          </div>

          {success ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
              <p className="font-bold">✅ Billing request submitted.</p>
              <p className="mt-1 text-xs text-green-700">
                Your request for <strong>{seats} seat{seats !== 1 ? "s" : ""}</strong> on the <strong className="capitalize">{selectedTier}</strong> plan has been received.
                You&apos;ll hear from us within 1 business day to complete setup.
                {/* Stripe activation will go here once payment is live */}
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              <button
                type="button"
                onClick={handleActivate}
                disabled={loading}
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Submitting…" : `Activate ${TIERS.find(t => t.key === selectedTier)?.name ?? ""} — ${seats} seat${seats !== 1 ? "s" : ""}`}
              </button>
              <p className="mt-2 text-center text-xs text-neutral-400">
                Secure checkout powered by Stripe — coming soon. Your request is logged and we&apos;ll follow up shortly.
              </p>
            </>
          )}
        </div>
      )}

      {/* Enterprise / Pro coming soon contact */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
        <p className="text-sm font-semibold text-neutral-700">Need Pro or Enterprise?</p>
        <p className="text-xs text-neutral-500 mt-0.5">
          <a href="mailto:hello@forge-worx.com?subject=Pro/Enterprise%20Inquiry" className="text-indigo-600 hover:underline">
            Email us
          </a>{" "}
          and we&apos;ll get you set up with SSO, volume pricing, and dedicated onboarding.
        </p>
      </div>

      <div className="mt-6">
        <Link href={`/${slug}/board`} className="text-sm text-neutral-500 hover:text-neutral-700 transition">
          ← Back to workspace
        </Link>
      </div>
    </div>
  );
}
