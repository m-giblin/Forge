import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports -- service-role: email inbound is machine path, tenant routed by recipient address (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

// Abuse/spam design (FORGE-149): tenant-level, not per-sender. The webhook secret is
// shared across an entire tenant's inbound address, so the DoS surface being defended
// against is a compromised or malicious sender hammering one tenant's address, not
// distinguishing good senders from bad ones within a tenant. 60/minute is generous
// enough to never affect a real support inbox's legitimate volume while still capping
// worst-case cost. Known tradeoff: because this is tenant-level, one abusive sender can
// exhaust a tenant's whole budget and crowd out legitimate mail for that same minute.
// Deliberately NOT adding per-sender sub-limiting yet — this is a P2/low-priority
// feature with no reported abuse, and per-sender limiting would be speculative
// engineering ahead of a real signal. Revisit as a fast-follow if abuse is observed.
const EMAIL_INBOUND_LIMIT = 60;
const EMAIL_INBOUND_WINDOW_MS = 60_000;

function safeCompareSecret(a: string, b: string): boolean {
  // Pad to same length before comparison to avoid length oracle
  const maxLen = Math.max(a.length, b.length, 32);
  const bufA = Buffer.alloc(maxLen);
  const bufB = Buffer.alloc(maxLen);
  bufA.write(a);
  bufB.write(b);
  return timingSafeEqual(bufA, bufB);
}

export const runtime = "nodejs";

/**
 * POST /api/email/inbound
 *
 * Receives inbound email webhooks from Postmark, SendGrid, or Mailgun.
 * Routing: recipient address encodes tenant + optional project key.
 *   issues@<tenant>.forge.app      => default project
 *   <KEY>@<tenant>.forge.app       => specific project by key
 *
 * Set INBOUND_EMAIL_SECRET env var and configure provider to send it as
 * x-webhook-secret header. Subject => title, body => description.
 */

function extractEnvelope(body: Record<string, unknown>): {
  subject: string; text: string; from: string; to: string; messageId: string | null;
} | null {
  if (typeof body.Subject === "string") {
    return {
      subject: (body.Subject as string).trim(),
      text: ((body.TextBody ?? body.HtmlBody ?? "") as string).trim(),
      from: (body.From as string) ?? "",
      to: Array.isArray(body.ToFull)
        ? ((body.ToFull as Array<{ Email: string }>)[0]?.Email ?? (body.To as string) ?? "")
        : ((body.To as string) ?? ""),
      // Postmark's own per-delivery id — the correct idempotency key for retried
      // webhook deliveries. NOT the sender address: the same person legitimately
      // emails support more than once, so that can never be a uniqueness key.
      messageId: typeof body.MessageID === "string" ? body.MessageID : null,
    };
  }
  if (typeof body.subject === "string") {
    return {
      subject: (body.subject as string).trim(),
      text: ((body.text ?? body.html ?? "") as string).trim(),
      from: (body.from as string) ?? "",
      to: (body.to as string) ?? "",
      messageId:
        typeof body.messageId === "string" ? body.messageId
        : typeof body.message_id === "string" ? body.message_id
        : null,
    };
  }
  return null;
}

function parseRecipient(to: string): { slug: string; projectKey: string | null } | null {
  const match = to.match(/^([^@<]+)@([^.>]+)\./);
  if (!match) return null;
  const [, local, slug] = match;
  return {
    slug: slug!.toLowerCase(),
    projectKey: local!.toLowerCase() === "issues" ? null : local!.toUpperCase(),
  };
}

function stripHtml(html: string): string {
  // Remove all tags then decode common HTML entities to plain text.
  // This is storage-level sanitization; React escapes on render anyway.
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  const provided =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("x-postmark-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || !provided || !safeCompareSecret(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const ct = req.headers.get("content-type") ?? "";
    body = ct.includes("json") ? await req.json() : Object.fromEntries(new URLSearchParams(await req.text()));
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const envelope = extractEnvelope(body);
  if (!envelope) return NextResponse.json({ error: "Unrecognised payload" }, { status: 422 });

  const parsed = parseRecipient(envelope.to);
  if (!parsed) return NextResponse.json({ error: "Cannot parse recipient" }, { status: 422 });

  const { slug, projectKey } = parsed;
  const svc = createSupabaseServiceClient();

  const { data: tenant } = await svc.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const rl = getRateLimiter();
  const rateCheck = await rl.check(`email_inbound:${tenant.id}`, EMAIL_INBOUND_LIMIT, EMAIL_INBOUND_WINDOW_MS);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let projectId: string | null = null;
  if (projectKey) {
    const { data: proj } = await svc.from("projects").select("id")
      .eq("tenant_id", tenant.id).eq("key", projectKey).maybeSingle();
    projectId = proj?.id ?? null;
  }
  if (!projectId) {
    const { data: projs } = await svc.from("projects").select("id")
      .eq("tenant_id", tenant.id).order("key").limit(1);
    projectId = projs?.[0]?.id ?? null;
  }
  if (!projectId) return NextResponse.json({ error: "No project found" }, { status: 404 });

  const title = (envelope.subject.slice(0, 255) || "(No subject)").replace(/^(Re|Fwd?):\s*/i, "").trim();
  const rawBody = envelope.text.startsWith("<") ? stripHtml(envelope.text) : envelope.text;
  // Sender goes in the description, not external_id — external_id is the
  // idempotency key (unique per tenant) and the same person legitimately
  // emails support more than once, so it can never hold the sender address.
  const senderLine = envelope.from ? `Reported via email from: ${envelope.from}\n\n` : "";
  const description = (senderLine + rawBody).slice(0, 5000) || null;

  const { data: numData, error: numError } = await svc.rpc("next_issue_number", {
    p_tenant_id: tenant.id,
    p_project_id: projectId,
  });
  if (numError) return NextResponse.json({ error: numError.message }, { status: 500 });
  const number = numData as number;

  const { data: issue, error } = await svc.from("issues").insert({
    tenant_id: tenant.id,
    project_id: projectId,
    number,
    title,
    description,
    type: "bug",
    status: "backlog",
    priority: "medium",
    source: "email",
    external_id: envelope.messageId,
  }).select("id, number").single();

  if (error) {
    // A provider retrying the same delivery (same messageId) lands here —
    // treat it as an already-processed success rather than a hard failure.
    if (error.code === "23505") {
      const { data: existing } = await svc.from("issues").select("id, number")
        .eq("tenant_id", tenant.id).eq("external_id", envelope.messageId).maybeSingle();
      if (existing) return NextResponse.json({ ok: true, issueId: existing.id, number: existing.number });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, issueId: issue.id, number: issue.number });
}
