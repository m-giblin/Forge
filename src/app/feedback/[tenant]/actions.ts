"use server";

// eslint-disable-next-line no-restricted-imports -- public feedback endpoint: service-role needed to insert without user JWT
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { supportTicketsRepo } from "@/lib/repositories/supportTickets";

export async function submitFeedbackAction(
  tenantId: string,
  data: {
    name: string;
    email: string;
    type: string;
    title: string;
    body: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!data.title.trim() || !data.body.trim()) {
    return { ok: false, error: "Title and description are required." };
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  try {
    const svc = createSupabaseServiceClient();
    const actorLabel = data.name.trim()
      ? data.email
        ? `${data.name.trim()} <${data.email.trim()}>`
        : data.name.trim()
      : data.email.trim() || "Anonymous";

    await supportTicketsRepo(svc).create({
      tenant_id: tenantId,
      title: `[${data.type}] ${data.title}`,
      body: `**From:** ${actorLabel}\n**Type:** ${data.type}\n\n${data.body}`,
      actor_label: actorLabel,
      priority: data.type === "bug" ? "high" : "medium",
    });

    return { ok: true };
  } catch (e) {
    console.error("Feedback submission error:", e);
    return { ok: false, error: "Failed to submit feedback. Please try again." };
  }
}
