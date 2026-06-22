import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports -- service-role: email inbound is machine path, tenant routed by recipient address (sec09)
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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
  subject: string; text: string; from: string; to: string;
} | null {
  if (typeof body.Subject === "string") {
    return {
      subject: (body.Subject as string).trim(),
      text: ((body.TextBody ?? body.HtmlBody ?? "") as string).trim(),
      from: (body.From as string) ?? "",
      to: Array.isArray(body.ToFull)
        ? ((body.ToFull as Array<{ Email: string }>)[0]?.Email ?? (body.To as string) ?? "")
        : ((body.To as string) ?? ""),
    };
  }
  if (typeof body.subject === "string") {
    return {
      subject: (body.subject as string).trim(),
      text: ((body.text ?? body.html ?? "") as string).trim(),
      from: (body.from as string) ?? "",
      to: (body.to as string) ?? "",
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
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (secret) {
    const provided =
      req.headers.get("x-webhook-secret") ??
      req.headers.get("x-postmark-secret") ??
      req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const description = rawBody.slice(0, 5000) || null;

  const { data: last } = await svc.from("issues").select("number")
    .eq("tenant_id", tenant.id).order("number", { ascending: false }).limit(1).maybeSingle();
  const number = ((last?.number as number) ?? 0) + 1;

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
    external_id: envelope.from,
  }).select("id, number").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, issueId: issue.id, number: issue.number });
}
