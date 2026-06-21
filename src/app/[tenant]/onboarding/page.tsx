import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { projectsRepo } from "@/lib/repositories/projects";
import { membersRepo } from "@/lib/repositories/members";
import OnboardingWizard from "./OnboardingWizard";

export default async function OnboardingPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  const supabase = await createSupabaseServerClient();

  // Check if user has already completed onboarding
  let onboardingDone = false;
  try {
    const { data } = await supabase
      .from("users")
      .select("onboarding_done")
      .eq("id", ctx.appUserId)
      .maybeSingle();
    onboardingDone = (data as Record<string, unknown> | null)?.onboarding_done === true;
  } catch { /* column may not exist yet */ }

  if (onboardingDone) redirect(`/${slug}`);

  // Get current user's name
  const { data: userRow } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", ctx.appUserId)
    .maybeSingle();
  const userName = (userRow as { name?: string | null; email?: string } | null)?.name
    || (userRow as { name?: string | null; email?: string } | null)?.email
    || "there";

  // Fetch members, projects, and suggested issue in parallel
  const [members, projects] = await Promise.all([
    membersRepo(supabase).list(ctx.tenant.id).catch(() => []),
    projectsRepo(supabase).listByTenant(ctx.tenant.id, ["active"]).catch(() => []),
  ]);

  // Count open issues per project and total
  const projectsWithCounts = await Promise.all(
    projects.map(async (p) => {
      const { count } = await supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenant.id)
        .eq("project_id", p.id)
        .not("status", "in", '("done","closed","cancelled")');
      return { key: p.key, name: p.name, openIssueCount: count ?? 0 };
    })
  );

  const openIssueCount = projectsWithCounts.reduce((sum, p) => sum + p.openIssueCount, 0);

  // Fetch one suggested "good first issue"
  const { data: suggestedRaw } = await supabase
    .from("issues")
    .select("id, number, title, description, priority, project_id")
    .eq("tenant_id", ctx.tenant.id)
    .is("assignee_id", null)
    .in("status", ["todo", "backlog"])
    .eq("priority", "medium")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let suggestedIssue: {
    id: string;
    key: string;
    title: string;
    description: string | null;
    priority: string;
    projectKey: string;
  } | null = null;

  if (suggestedRaw) {
    // Find the project key for this issue
    const project = projects.find((p) => p.id === suggestedRaw.project_id);
    const projectKey = project?.key ?? "?";
    suggestedIssue = {
      id: suggestedRaw.id,
      key: `${projectKey}-${suggestedRaw.number}`,
      title: suggestedRaw.title,
      description: suggestedRaw.description,
      priority: suggestedRaw.priority,
      projectKey,
    };
  }

  return (
    <OnboardingWizard
      slug={slug}
      userName={userName}
      tenantName={ctx.tenant.name}
      members={members.map((m) => ({ name: m.name || m.email, role: m.role }))}
      projects={projectsWithCounts}
      openIssueCount={openIssueCount}
      suggestedIssue={suggestedIssue}
    />
  );
}
