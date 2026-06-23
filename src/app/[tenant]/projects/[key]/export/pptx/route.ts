import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/auth";
import { ctxCanDo } from "@/lib/rbac";
// eslint-disable-next-line no-restricted-imports
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { projectsRepo } from "@/lib/repositories/projects";
import { issuesRepo } from "@/lib/repositories/issues";
import { sprintsRepo } from "@/lib/repositories/sprints";
import { projectMembersRepo } from "@/lib/repositories/projectMembers";
import PptxGenJS from "pptxgenjs";

export const dynamic = "force-dynamic";

// ── Brand palette ─────────────────────────────────────────────────────────
const C = {
  indigoDeep:  "312e81",
  indigoDark:  "4338ca",
  indigo:      "6366f1",
  indigoLight: "e0e7ff",
  indigoMid:   "818cf8",
  green:       "22c55e",
  greenLight:  "dcfce7",
  amber:       "f59e0b",
  amberLight:  "fef3c7",
  red:         "ef4444",
  redLight:    "fee2e2",
  violet:      "8b5cf6",
  slate900:    "0f172a",
  slate800:    "1e293b",
  slate700:    "334155",
  slate600:    "475569",
  slate500:    "64748b",
  slate400:    "94a3b8",
  slate300:    "cbd5e1",
  slate200:    "e2e8f0",
  slate100:    "f8fafc",
  white:       "ffffff",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}
function statusColor(s: string): string {
  const m: Record<string, string> = {
    backlog: C.slate500, todo: C.slate700, in_progress: C.indigo,
    in_review: C.violet, done: C.green, blocked: C.red,
  };
  return m[s] ?? C.indigo;
}
function statusLabel(s: string): string {
  const m: Record<string, string> = {
    backlog: "Backlog", todo: "Todo", in_progress: "In Progress",
    in_review: "In Review", done: "Done", blocked: "Blocked",
  };
  return m[s] ?? s;
}
function priorityColor(p: string): string {
  const m: Record<string, string> = { urgent: C.red, high: "fb923c", medium: C.amber, low: C.green };
  return m[p] ?? C.slate500;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Slide layouts ──────────────────────────────────────────────────────────
/** Full dark cover slide */
function addCover(pptx: PptxGenJS, projectName: string, projectKey: string, date: string) {
  const slide = pptx.addSlide();
  // Deep indigo background
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.indigoDeep } });
  // Accent strip bottom
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 6.8, w: "100%", h: 0.2, fill: { color: C.indigo } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.0, w: "100%", h: 0.05, fill: { color: C.indigoMid } });
  // Left vertical accent bar
  slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 0.08, h: 3.6, fill: { color: C.indigo } });
  // FORGE brand
  slide.addText("▣  FORGE", {
    x: 0.7, y: 1.2, w: 8, h: 0.4,
    fontSize: 10, color: C.indigoMid, bold: true, charSpacing: 6,
  });
  // Project name
  slide.addText(projectName, {
    x: 0.7, y: 1.8, w: 8.6, h: 1.6,
    fontSize: 42, color: C.white, bold: true, lineSpacingMultiple: 1.1,
  });
  // Report subtitle
  slide.addText("Project Status Presentation", {
    x: 0.7, y: 3.55, w: 7, h: 0.45,
    fontSize: 16, color: C.indigoLight,
  });
  // Project key badge
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.7, y: 4.1, w: 1.1, h: 0.35, fill: { color: C.indigo }, rectRadius: 0.05,
  });
  slide.addText(projectKey, {
    x: 0.7, y: 4.1, w: 1.1, h: 0.35,
    fontSize: 9, color: C.white, bold: true, align: "center",
  });
  // Date
  slide.addText(date, {
    x: 0.7, y: 4.55, w: 5, h: 0.3,
    fontSize: 9, color: C.slate300,
  });
}

/** Slide header with indigo top bar + title */
function addSlideHeader(slide: PptxGenJS.Slide, title: string, sub?: string) {
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: C.indigo } });
  slide.addText(title, { x: 0.5, y: 0.22, w: 8.5, h: 0.48, fontSize: 20, bold: true, color: C.slate900 });
  if (sub) {
    slide.addText(sub, { x: 0.5, y: 0.72, w: 8.5, h: 0.3, fontSize: 9, color: C.slate500 });
  }
}

/** Slide footer */
function addSlideFooter(slide: PptxGenJS.Slide, projectName: string) {
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 7.05, w: "100%", h: 0.45, fill: { color: C.slate100 } });
  slide.addText(`Forge  ·  ${projectName}`, { x: 0.3, y: 7.1, w: 5, h: 0.35, fontSize: 7, color: C.slate500 });
  slide.addText("CONFIDENTIAL", { x: 7.5, y: 7.1, w: 2, h: 0.35, fontSize: 7, color: C.slate400, align: "right" });
}

/** KPI tile box */
function addKpiBox(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string,
  color: string, bgColor: string,
) {
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y, w, h, fill: { color: bgColor }, line: { color: C.slate200, width: 0.5 }, rectRadius: 0.08 });
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y, w: 0.06, h, fill: { color }, rectRadius: 0.03 });
  slide.addText(label.toUpperCase(), { x: x + 0.15, y: y + 0.08, w: w - 0.2, h: 0.22, fontSize: 7, bold: true, color, charSpacing: 1 });
  slide.addText(value, { x: x + 0.15, y: y + 0.28, w: w - 0.2, h: 0.52, fontSize: 28, bold: true, color: C.slate900 });
  slide.addText(sub, { x: x + 0.15, y: y + 0.82, w: w - 0.2, h: 0.22, fontSize: 7.5, color: C.slate500 });
}

/** Horizontal bar chart row */
function addHBar(
  slide: PptxGenJS.Slide,
  x: number, y: number, totalW: number,
  label: string, value: number, maxVal: number, color: string, alt = false,
) {
  if (alt) slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y, w: totalW, h: 0.32, fill: { color: C.slate100 } });
  slide.addText(label, { x, y: y + 0.04, w: 1.5, h: 0.24, fontSize: 8, color: C.slate700, align: "right" });
  // track
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: x + 1.6, y: y + 0.1, w: totalW - 2.1, h: 0.12, fill: { color: C.slate200 }, rectRadius: 0.03 });
  // fill
  const fillW = Math.max(0.05, ((totalW - 2.1) * value) / Math.max(1, maxVal));
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: x + 1.6, y: y + 0.1, w: fillW, h: 0.12, fill: { color }, rectRadius: 0.03 });
  // count
  slide.addText(String(value), { x: x + totalW - 0.45, y: y + 0.04, w: 0.42, h: 0.24, fontSize: 8, bold: true, color, align: "right" });
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string; key: string }> },
) {
  const { tenant: slug, key: projectKey } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctxCanDo(ctx, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const svc = createSupabaseServiceClient();
  const pRepo = projectsRepo(svc);
  const iRepo = issuesRepo(svc);
  const sRepo = sprintsRepo(svc);
  const mRepo = projectMembersRepo(svc);

  // Fetch project by key
  const projects = await pRepo.listByTenant(ctx.tenant.id, ["active", "on_hold", "closed"]);
  const project = projects.find((p) => p.key === projectKey);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Fetch all issues, sprints, members in parallel
  const [allIssues, sprints, members, velocity] = await Promise.all([
    iRepo.listByProject(ctx.tenant.id, project.id).catch(() => []),
    sRepo.listForProject(ctx.tenant.id, project.id).catch(() => []),
    mRepo.list(ctx.tenant.id, project.id).catch(() => []),
    sRepo.velocity(ctx.tenant.id, project.id, 6).catch(() => []),
  ]);

  const activeSprint = sprints.find((s) => s.status === "active") ?? null;
  const completedSprints = sprints.filter((s) => s.status === "completed").length;

  // Issue stats
  const total = allIssues.length;
  const done  = allIssues.filter((i) => i.status === "done").length;
  const inProg = allIssues.filter((i) => i.status === "in_progress").length;
  const blocked = allIssues.filter((i) => i.status === "blocked" || (i.labels as string[] | null ?? []).some((l: string) => l.toLowerCase().includes("block"))).length;
  const unassigned = allIssues.filter((i) => !i.assignee_id && i.status !== "done").length;
  const pctDone = pct(done, total);

  // Status counts
  const statusMap: Record<string, number> = {};
  for (const i of allIssues) statusMap[i.status] = (statusMap[i.status] ?? 0) + 1;

  // Priority counts (open only)
  const openIssues = allIssues.filter((i) => i.status !== "done");
  const priMap: Record<string, number> = {};
  for (const i of openIssues) priMap[i.priority] = (priMap[i.priority] ?? 0) + 1;

  // Assignee workload
  const assigneeMap: Record<string, number> = {};
  for (const i of openIssues) {
    const name = members.find((m) => m.userId === i.assignee_id)?.name ?? (i.assignee_id ? "Unknown" : "Unassigned");
    assigneeMap[name] = (assigneeMap[name] ?? 0) + 1;
  }
  const topAssignees = Object.entries(assigneeMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Sprint issues (active sprint)
  const sprintIssues = activeSprint
    ? allIssues.filter((i) => (i as unknown as { sprint_id?: string }).sprint_id === activeSprint.id)
    : [];
  const sprintDone  = sprintIssues.filter((i) => i.status === "done").length;
  const sprintTotal = sprintIssues.length;

  // Top blockers
  const blockerIssues = allIssues
    .filter((i) => i.status === "blocked" || (i.labels as string[] | null ?? []).some((l: string) => l.toLowerCase().includes("block")))
    .slice(0, 8);

  // ── Build PowerPoint ───────────────────────────────────────────────────
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33" × 7.5"
  pptx.author = "Forge";
  pptx.company = ctx.tenant.name ?? "Forge";
  pptx.subject = `${project.name} Status Presentation`;
  pptx.title = `${project.name} Project Status`;

  const today = new Date().toLocaleDateString("en-US", { dateStyle: "long" });

  // ── Slide 1: Cover ────────────────────────────────────────────────────
  addCover(pptx, project.name, project.key, today);

  // ── Slide 2: Project Health At-a-Glance ──────────────────────────────
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Project Health At-a-Glance", today);

    // Health badge
    const health = blocked > 0 ? "⚠  Needs Attention" : pctDone > 70 ? "✓  On Track" : "●  In Progress";
    const healthColor = blocked > 0 ? C.red : pctDone > 70 ? C.green : C.indigo;
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 1.1, w: 2.4, h: 0.38, fill: { color: healthColor }, rectRadius: 0.1 });
    slide.addText(health, { x: 0.5, y: 1.1, w: 2.4, h: 0.38, fontSize: 10, color: C.white, bold: true, align: "center" });

    // Progress bar
    slide.addText(`${pctDone}% Complete`, { x: 3.1, y: 1.18, w: 3, h: 0.22, fontSize: 9, color: C.slate700 });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 1.58, w: 12.33, h: 0.22, fill: { color: C.slate200 }, rectRadius: 0.04 });
    if (pctDone > 0) {
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 1.58, w: 12.33 * (pctDone / 100), h: 0.22, fill: { color: C.green }, rectRadius: 0.04 });
    }
    slide.addText(`${done} / ${total} issues`, { x: 11.5, y: 1.58, w: 1.5, h: 0.22, fontSize: 7.5, color: C.slate500, align: "right" });

    // KPI row (4 tiles across full width)
    const kpiW = 2.8, kpiH = 1.2, kpiY = 2.0;
    const kpiGap = (12.33 - kpiW * 4) / 3;
    addKpiBox(slide, 0.5,                  kpiY, kpiW, kpiH, "Open Issues",    String(total - done), "total open",   C.indigo, C.indigoLight);
    addKpiBox(slide, 0.5 + kpiW + kpiGap, kpiY, kpiW, kpiH, "In Progress",    String(inProg),       "being worked", C.indigo, C.indigoLight);
    addKpiBox(slide, 0.5 + (kpiW + kpiGap) * 2, kpiY, kpiW, kpiH, "Completed", String(done),        `of ${total}`,  C.green,  C.greenLight);
    addKpiBox(slide, 0.5 + (kpiW + kpiGap) * 3, kpiY, kpiW, kpiH, "Blocked",   String(blocked),     "need resolution", blocked > 0 ? C.red : C.green, blocked > 0 ? C.redLight : C.greenLight);

    // Sprint info
    if (activeSprint) {
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 3.4, w: 12.33, h: 1.0, fill: { color: C.slate100 }, rectRadius: 0.08 });
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 3.4, w: 0.06, h: 1.0, fill: { color: C.indigo }, rectRadius: 0.03 });
      slide.addText("ACTIVE SPRINT", { x: 0.7, y: 3.5, w: 4, h: 0.22, fontSize: 7, bold: true, color: C.indigo, charSpacing: 1 });
      slide.addText(activeSprint.name, { x: 0.7, y: 3.72, w: 7, h: 0.3, fontSize: 13, bold: true, color: C.slate900 });
      if (activeSprint.goal) {
        slide.addText(`Goal: ${activeSprint.goal}`, { x: 0.7, y: 4.04, w: 8, h: 0.25, fontSize: 8.5, color: C.slate500 });
      }
      // Sprint dates
      slide.addText(`${fmtDate(activeSprint.startDate)} → ${fmtDate(activeSprint.endDate)}`, {
        x: 9.5, y: 3.55, w: 3.2, h: 0.25, fontSize: 8.5, color: C.slate500, align: "right",
      });
      // Sprint progress bar
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.7, y: 4.2, w: 5, h: 0.12, fill: { color: C.slate200 }, rectRadius: 0.03 });
      if (sprintTotal > 0) {
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.7, y: 4.2, w: 5 * (sprintDone / sprintTotal), h: 0.12, fill: { color: C.green }, rectRadius: 0.03 });
      }
      slide.addText(`${sprintDone}/${sprintTotal} issues done`, { x: 5.8, y: 4.15, w: 2, h: 0.22, fontSize: 8, color: C.slate600 });
    }

    // Project dates
    if (project.start_date || project.target_go_live) {
      slide.addText(`Project Dates: ${fmtDate(project.start_date ?? null)} → ${fmtDate(project.target_go_live ?? null)}`, {
        x: 0.5, y: 4.65, w: 8, h: 0.28, fontSize: 8.5, color: C.slate500,
      });
    }

    addSlideFooter(slide, project.name);
  }

  // ── Slide 3: Issue Status & Priority ─────────────────────────────────
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Issue Breakdown", "Status and priority distribution across all issues");

    const statuses = ["backlog", "todo", "in_progress", "in_review", "done", "blocked"].filter((st) => (statusMap[st] ?? 0) > 0);
    const maxStatus = Math.max(1, ...statuses.map((st) => statusMap[st] ?? 0));

    // Left: status
    slide.addText("BY STATUS", { x: 0.5, y: 1.1, w: 5.6, h: 0.25, fontSize: 8, bold: true, color: C.slate500, charSpacing: 1 });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 1.35, w: 5.6, h: 0.04, fill: { color: C.slate200 } });
    statuses.forEach((st, i) => {
      addHBar(slide, 0.5, 1.48 + i * 0.38, 5.6, statusLabel(st), statusMap[st] ?? 0, maxStatus, statusColor(st), i % 2 === 1);
    });

    // Right: priority
    const priorities = ["urgent", "high", "medium", "low"].filter((p) => (priMap[p] ?? 0) > 0);
    const maxPri = Math.max(1, ...priorities.map((p) => priMap[p] ?? 0));
    slide.addText("BY PRIORITY (OPEN)", { x: 7.0, y: 1.1, w: 5.8, h: 0.25, fontSize: 8, bold: true, color: C.slate500, charSpacing: 1 });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 7.0, y: 1.35, w: 5.8, h: 0.04, fill: { color: C.slate200 } });
    priorities.forEach((p, i) => {
      addHBar(slide, 7.0, 1.48 + i * 0.38, 5.8, p.charAt(0).toUpperCase() + p.slice(1), priMap[p] ?? 0, maxPri, priorityColor(p), i % 2 === 1);
    });

    // Summary callout
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 5.5, w: 12.33, h: 1.2, fill: { color: C.indigoLight }, rectRadius: 0.08 });
    slide.addText(`${pctDone}% of issues completed  ·  ${inProg} in progress  ·  ${unassigned} unassigned  ·  ${blocked} blocked`, {
      x: 0.7, y: 5.68, w: 11.9, h: 0.35, fontSize: 10, color: C.indigoDark, bold: true,
    });
    slide.addText(`Total: ${total} issues across all statuses`, {
      x: 0.7, y: 6.05, w: 8, h: 0.25, fontSize: 8.5, color: C.indigo,
    });

    addSlideFooter(slide, project.name);
  }

  // ── Slide 4: Sprint Velocity (if sprints exist) ───────────────────────
  if (velocity.length > 0 || activeSprint) {
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Sprint Velocity", `${completedSprints} completed sprint${completedSprints !== 1 ? "s" : ""}`);

    const maxV = Math.max(1, ...velocity.map((v) => v.done));
    const barW = velocity.length > 0 ? Math.min(1.4, 11 / velocity.length * 0.7) : 1.4;
    const gap  = velocity.length > 1 ? (11 - barW * velocity.length) / (velocity.length - 1) : 0;
    const chartH = 3.5, baseY = 5.2;

    velocity.forEach((v, i) => {
      const barH = chartH * (v.done / maxV);
      const bx = 0.9 + i * (barW + gap);
      const by = baseY - barH;
      // Bar
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: bx, y: by, w: barW, h: barH, fill: { color: C.indigo }, rectRadius: 0.06 });
      // Count label on top
      if (v.done > 0) {
        slide.addText(String(v.done), { x: bx, y: by - 0.28, w: barW, h: 0.25, fontSize: 9, bold: true, color: C.indigo, align: "center" });
      }
      // Sprint name
      slide.addText(v.name.replace(/sprint/i, "").trim() || `S${i + 1}`, {
        x: bx, y: baseY + 0.06, w: barW, h: 0.28, fontSize: 7.5, color: C.slate600, align: "center",
      });
    });

    // Baseline
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.8, y: baseY, w: 12, h: 0.03, fill: { color: C.slate300 } });

    // Average velocity
    const avgV = velocity.length > 0 ? Math.round(velocity.reduce((a, v) => a + v.done, 0) / velocity.length) : 0;
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 1.15, w: 3.5, h: 1.0, fill: { color: C.indigoLight }, rectRadius: 0.08 });
    slide.addText("AVG VELOCITY", { x: 0.65, y: 1.25, w: 3.2, h: 0.22, fontSize: 7, bold: true, color: C.indigo, charSpacing: 1 });
    slide.addText(`${avgV}`, { x: 0.65, y: 1.47, w: 3.2, h: 0.5, fontSize: 32, bold: true, color: C.slate900 });
    slide.addText("issues / sprint", { x: 0.65, y: 1.98, w: 3.2, h: 0.2, fontSize: 7.5, color: C.slate500 });

    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 4.2, y: 1.15, w: 3.5, h: 1.0, fill: { color: C.greenLight }, rectRadius: 0.08 });
    slide.addText("SPRINTS COMPLETED", { x: 4.35, y: 1.25, w: 3.2, h: 0.22, fontSize: 7, bold: true, color: C.green, charSpacing: 1 });
    slide.addText(`${completedSprints}`, { x: 4.35, y: 1.47, w: 3.2, h: 0.5, fontSize: 32, bold: true, color: C.slate900 });
    slide.addText("sprints in project", { x: 4.35, y: 1.98, w: 3.2, h: 0.2, fontSize: 7.5, color: C.slate500 });

    addSlideFooter(slide, project.name);
  }

  // ── Slide 5: Team & Workload ──────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Team & Workload", `${members.length} project member${members.length !== 1 ? "s" : ""}`);

    const maxLoad = Math.max(1, ...topAssignees.map(([, c]) => c));
    slide.addText("OPEN ISSUE DISTRIBUTION", { x: 0.5, y: 1.1, w: 8, h: 0.25, fontSize: 8, bold: true, color: C.slate500, charSpacing: 1 });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 1.35, w: 8, h: 0.04, fill: { color: C.slate200 } });
    topAssignees.forEach(([name, count], i) => {
      addHBar(slide, 0.5, 1.48 + i * 0.38, 8, name, count, maxLoad, C.indigo, i % 2 === 1);
    });

    // Team roster on right
    slide.addText("TEAM ROSTER", { x: 9.0, y: 1.1, w: 3.8, h: 0.25, fontSize: 8, bold: true, color: C.slate500, charSpacing: 1 });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 9.0, y: 1.35, w: 3.8, h: 0.04, fill: { color: C.slate200 } });
    members.slice(0, 10).forEach((m, i) => {
      const bg = i % 2 === 0 ? C.slate100 : C.white;
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 9.0, y: 1.48 + i * 0.34, w: 3.8, h: 0.34, fill: { color: bg } });
      slide.addText(m.name ?? m.email, { x: 9.1, y: 1.5 + i * 0.34, w: 2.4, h: 0.28, fontSize: 8.5, color: C.slate800 });
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 11.6, y: 1.52 + i * 0.34, w: 1.1, h: 0.22, fill: { color: m.role === "lead" ? C.indigoLight : C.slate100 }, rectRadius: 0.08 });
      slide.addText(m.role, { x: 11.6, y: 1.52 + i * 0.34, w: 1.1, h: 0.22, fontSize: 7, color: m.role === "lead" ? C.indigo : C.slate500, bold: m.role === "lead", align: "center" });
    });

    addSlideFooter(slide, project.name);
  }

  // ── Slide 6: Blockers & Risks ─────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Blockers & Open Risks", "Issues requiring immediate attention");

    if (blockerIssues.length === 0) {
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 1.5, y: 2.5, w: 10.33, h: 1.4, fill: { color: C.greenLight }, rectRadius: 0.1 });
      slide.addText("✓  No blocked issues", { x: 1.5, y: 2.7, w: 10.33, h: 0.5, fontSize: 18, bold: true, color: C.green, align: "center" });
      slide.addText("All issues are progressing normally. Great job, team!", { x: 1.5, y: 3.25, w: 10.33, h: 0.35, fontSize: 10, color: C.slate500, align: "center" });
    } else {
      // Header row
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 1.08, w: 12.33, h: 0.32, fill: { color: C.red } });
      slide.addText("KEY", { x: 0.55, y: 1.1, w: 1.1, h: 0.28, fontSize: 7.5, bold: true, color: C.white });
      slide.addText("ISSUE TITLE", { x: 1.75, y: 1.1, w: 5.5, h: 0.28, fontSize: 7.5, bold: true, color: C.white });
      slide.addText("ASSIGNEE", { x: 7.4, y: 1.1, w: 3, h: 0.28, fontSize: 7.5, bold: true, color: C.white });
      slide.addText("DAYS", { x: 10.5, y: 1.1, w: 2.2, h: 0.28, fontSize: 7.5, bold: true, color: C.white, align: "right" });

      blockerIssues.forEach((iss, i) => {
        const rowY = 1.48 + i * 0.48;
        const bg = i % 2 === 0 ? C.redLight : C.white;
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: rowY, w: 12.33, h: 0.44, fill: { color: bg } });

        // Left accent dot
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: rowY, w: 0.06, h: 0.44, fill: { color: C.red } });

        const issWithKey = iss as { id: string; title: string; status: string; assignee_id?: string; number: number; project?: { key: string } };
        slide.addText(`${projectKey}-${issWithKey.number ?? "?"}`, { x: 0.65, y: rowY + 0.08, w: 1.1, h: 0.28, fontSize: 8, bold: true, color: C.slate700 });
        const titleStr = String(iss.title ?? "").length > 65 ? String(iss.title ?? "").slice(0, 65) + "…" : String(iss.title ?? "");
        slide.addText(titleStr, { x: 1.85, y: rowY + 0.08, w: 5.5, h: 0.28, fontSize: 8.5, color: C.slate800 });
        const assigneeName = members.find((m) => m.userId === iss.assignee_id)?.name ?? (iss.assignee_id ? "Unknown" : "Unassigned");
        slide.addText(assigneeName, { x: 7.5, y: rowY + 0.08, w: 3, h: 0.28, fontSize: 8.5, color: C.slate600 });
        const daysBlocked = Math.floor((Date.now() - new Date(iss.created_at as string).getTime()) / 86_400_000);
        slide.addText(`${daysBlocked}d`, { x: 10.6, y: rowY + 0.08, w: 2, h: 0.28, fontSize: 9, bold: true, color: C.red, align: "right" });
      });
    }

    addSlideFooter(slide, project.name);
  }

  // ── Slide 7: Next Steps (editable placeholder) ────────────────────────
  {
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Next Steps & Discussion", "Edit this slide to add your talking points");

    const items = [
      "Sprint planning — review backlog priorities",
      "Unblock critical path issues",
      "Review and close completed milestones",
      "Team capacity check for upcoming sprint",
      "[Add your next step here]",
    ];

    items.forEach((item, i) => {
      const y = 1.2 + i * 0.72;
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y, w: 12.33, h: 0.58, fill: { color: i % 2 === 0 ? C.slate100 : C.white }, rectRadius: 0.06 });
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y, w: 0.06, h: 0.58, fill: { color: C.indigo }, rectRadius: 0.03 });
      slide.addText(`${i + 1}.`, { x: 0.7, y: y + 0.14, w: 0.35, h: 0.3, fontSize: 10, bold: true, color: C.indigo });
      slide.addText(item, { x: 1.1, y: y + 0.14, w: 11.5, h: 0.3, fontSize: 11, color: i === 4 ? C.slate400 : C.slate800 });
    });

    addSlideFooter(slide, project.name);
  }

  // ── Slide 8: Thank You / Q&A ──────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.indigoDeep } });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 6.95, w: "100%", h: 0.1, fill: { color: C.indigo } });
    slide.addText("▣  FORGE", { x: 2, y: 1.8, w: 9.33, h: 0.5, fontSize: 11, color: C.indigoMid, bold: true, align: "center", charSpacing: 6 });
    slide.addText("Questions & Discussion", { x: 1, y: 2.5, w: 11.33, h: 1.2, fontSize: 40, color: C.white, bold: true, align: "center" });
    slide.addText(project.name, { x: 1, y: 3.85, w: 11.33, h: 0.45, fontSize: 14, color: C.indigoLight, align: "center" });
    slide.addText(today, { x: 1, y: 4.35, w: 11.33, h: 0.3, fontSize: 9, color: C.slate500, align: "center" });
  }

  // ── Write output ────────────────────────────────────────────────────────
  const buf = await pptx.write({ outputType: "nodebuffer" });
  const filename = `${project.key}-status-${new Date().toISOString().slice(0, 10)}.pptx`;

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
