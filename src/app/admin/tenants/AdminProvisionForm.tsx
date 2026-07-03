"use client";

import { useState, useTransition } from "react";
import { provisionTenantAction } from "../actions";

export default function AdminProvisionForm() {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function provision() {
    setError(null);
    startTransition(async () => {
      try {
        const { ownerInviteToken } = await provisionTenantAction({ name, slug, ownerEmail });
        setInviteLink(`${window.location.origin}/join/${ownerInviteToken}`);
        setCopied(false);
        setName(""); setSlug(""); setOwnerEmail("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to provision");
      }
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 7,
    border: "1px solid #e5e7eb", fontSize: 12, color: "#111827",
    outline: "none", background: "#fff", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 700,
    color: "#6b7280", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4,
  };

  return (
    <div>
      {error && (
        <div style={{ marginBottom: 12, padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, color: "#dc2626" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 2, minWidth: 160 }}>
          <label style={labelStyle}>Workspace Name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={labelStyle}>Slug</label>
          <input style={{ ...inputStyle, fontFamily: "monospace" }} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme" />
        </div>
        <div style={{ flex: 2, minWidth: 180 }}>
          <label style={labelStyle}>Owner Email</label>
          <input style={inputStyle} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@acme.com" />
        </div>
        <button
          onClick={provision}
          disabled={pending || !name || !slug || !ownerEmail}
          style={{
            padding: "8px 18px", borderRadius: 7, border: "none",
            background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 600,
            cursor: "pointer", opacity: pending || !name || !slug || !ownerEmail ? .5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {pending ? "Provisioning…" : "Provision"}
        </button>
      </div>

      {inviteLink && (
        <div style={{ marginTop: 12, padding: "11px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 6 }}>Owner invite link — send this to the new workspace owner:</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ flex: 1, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {inviteLink}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(inviteLink); setCopied(true); }}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
