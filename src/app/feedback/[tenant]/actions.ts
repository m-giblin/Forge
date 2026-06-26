"use server";

import { headers } from "next/headers";
// eslint-disable-next-line no-restricted-imports -- public feedback endpoint: service-role needed to insert without user JWT
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { supportTicketsRepo } from "@/lib/repositories/supportTickets";

// In-memory rate limiter: 5 submissions per IP per 15 minutes.
// Single-instance only — add Redis when horizontally scaled (see production checklist).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_HITS = 5;
const ipBucket = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBucket.get(ip);
  if (!bucket || now > bucket.resetAt) {
    ipBucket.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_HITS) return false;
  bucket.count++;
  return true;
}

// Validate allowed feedback types to prevent type injection into ticket title/body
const ALLOWED_TYPES = new Set(["bug", "feature", "question", "other"]);

export async function submitFeedbackAction(
  slug: string,
  data: {
    name: string;
    email: string;
    type: string;
    title: string;
    body: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  // Rate limit by IP
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return { ok: false, error: "Too many submissions. Please try again later." };
  }

  if (!ALLOWED_TYPES.has(data.type)) {
    return { ok: false, error: "Invalid feedback type." };
  }
  if (!data.title.trim() || !data.body.trim()) {
    return { ok: false, error: "Title and description are required." };
  }
  if (data.title.trim().length > 200) {
    return { ok: false, error: "Title must be 200 characters or fewer." };
  }
  if (data.body.trim().length > 5000) {
    return { ok: false, error: "Description must be 5000 characters or fewer." };
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  try {
    const svc = createSupabaseServiceClient();

    // Resolve tenantId server-side from slug — never trust client-supplied UUIDs
    const { data: tenantRow } = await svc
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .single();
    if (!tenantRow) return { ok: false, error: "Workspace not found." };
    const tenantId = tenantRow.id as string;

    const actorLabel = data.name.trim()
      ? data.email
        ? `${data.name.trim()} <${data.email.trim()}>`
        : data.name.trim()
      : data.email.trim() || "Anonymous";

    await supportTicketsRepo(svc).create({
      tenant_id: tenantId,
      title: `[${data.type}] ${data.title.trim().slice(0, 200)}`,
      body: `**From:** ${actorLabel}\n**Type:** ${data.type}\n\n${data.body.trim().slice(0, 5000)}`,
      actor_label: actorLabel,
      priority: data.type === "bug" ? "high" : "medium",
    });

    return { ok: true };
  } catch (e) {
    console.error("Feedback submission error:", e);
    return { ok: false, error: "Failed to submit feedback. Please try again." };
  }
}
