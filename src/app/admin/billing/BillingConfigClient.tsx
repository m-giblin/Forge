"use client";

import { useState, useTransition } from "react";
import { saveStripeConfigAction, setPlanPriceIdAction } from "./actions";
import type { StripeConfigStatus } from "@/lib/services/stripeConfig";

type Plan = { key: string; label: string; monthly_cents: number | null; is_active: boolean; stripe_price_id: string | null };

export default function BillingConfigClient({ status, plans }: { status: StripeConfigStatus; plans: Plan[] }) {
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState(status.publishableKey ?? "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [priceIds, setPriceIds] = useState<Record<string, string>>(
    Object.fromEntries(plans.map((p) => [p.key, p.stripe_price_id ?? ""]))
  );
  const [savingPrice, setSavingPrice] = useState<string | null>(null);

  function saveKeys() {
    setError(null);
    setSaved(false);
    startSave(async () => {
      try {
        await saveStripeConfigAction({
          secretKey: secretKey || undefined,
          publishableKey: publishableKey || undefined,
          webhookSecret: webhookSecret || undefined,
        });
        setSecretKey("");
        setWebhookSecret("");
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  async function savePrice(planKey: string) {
    setSavingPrice(planKey);
    try {
      await setPlanPriceIdAction(planKey, priceIds[planKey] ?? "");
    } finally {
      setSavingPrice(null);
    }
  }

  const field: React.CSSProperties = {
    width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 8,
    border: "1px solid #e5e7eb", outline: "none", fontFamily: "ui-monospace, monospace",
  };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 18, marginBottom: 16 };

  return (
    <div>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Stripe API Keys</h2>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
            background: status.configured ? "#dcfce7" : "#fef3c7",
            color: status.configured ? "#15803d" : "#92400e",
          }}>
            {status.configured ? "Configured" : "Not configured"}
          </span>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={label}>Secret key {status.hasSecretKey && <span style={{ color: "#9ca3af", fontWeight: 400 }}>(saved — leave blank to keep)</span>}</label>
            <input type="password" placeholder="sk_live_…" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} style={field} />
          </div>
          <div>
            <label style={label}>Publishable key</label>
            <input type="text" placeholder="pk_live_…" value={publishableKey} onChange={(e) => setPublishableKey(e.target.value)} style={field} />
          </div>
          <div>
            <label style={label}>Webhook signing secret {status.hasWebhookSecret && <span style={{ color: "#9ca3af", fontWeight: 400 }}>(saved — leave blank to keep)</span>}</label>
            <input type="password" placeholder="whsec_…" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} style={field} />
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              Point your Stripe webhook at <code>/api/webhooks/stripe</code> for: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted.
            </p>
          </div>
        </div>

        {error && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 10 }}>{error}</p>}
        {saved && <p style={{ color: "#15803d", fontSize: 12, marginTop: 10 }}>Saved.</p>}

        <button
          onClick={saveKeys}
          disabled={saving}
          style={{
            marginTop: 14, padding: "8px 16px", fontSize: 13, fontWeight: 700,
            background: "#111827", color: "#fff", border: "none", borderRadius: 8,
            cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save keys"}
        </button>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Plan → Stripe Price mapping</h2>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
          Create a recurring Price in Stripe for each active tier, then paste its Price ID (<code>price_…</code>) here.
          Checkout uses this to know what to charge — without it, that tier falls back to the manual request flow.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {plans.map((p) => (
            <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 110, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{p.label}</span>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  {p.monthly_cents ? `$${(p.monthly_cents / 100).toFixed(0)}/seat/mo` : "Custom"}
                  {!p.is_active && " · inactive"}
                </div>
              </div>
              <input
                type="text"
                placeholder="price_…"
                value={priceIds[p.key] ?? ""}
                onChange={(e) => setPriceIds((prev) => ({ ...prev, [p.key]: e.target.value }))}
                style={{ ...field, flex: 1 }}
              />
              <button
                onClick={() => savePrice(p.key)}
                disabled={savingPrice === p.key}
                style={{
                  padding: "7px 12px", fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151",
                  cursor: savingPrice === p.key ? "default" : "pointer", whiteSpace: "nowrap",
                }}
              >
                {savingPrice === p.key ? "Saving…" : "Save"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
