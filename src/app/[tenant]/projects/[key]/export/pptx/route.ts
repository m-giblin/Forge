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

// ── Brand palette ──────────────────────────────────────────────────────────
const C = {
  indigoDeep:  "312e81",
  indigoDark:  "4338ca",
  indigo:      "6366f1",
  indigoLight: "e0e7ff",
  indigoMid:   "818cf8",
  green:       "16a34a",
  greenDark:   "15803d",
  greenLight:  "dcfce7",
  amber:       "d97706",
  amberLight:  "fef3c7",
  red:         "dc2626",
  redLight:    "fee2e2",
  violet:      "7c3aed",
  slate900:    "0f172a",
  slate800:    "1e293b",
  slate700:    "334155",
  slate600:    "475569",
  slate500:    "64748b",
  slate400:    "94a3b8",
  slate300:    "cbd5e1",
  slate200:    "e2e8f0",
  slate100:    "f1f5f9",
  white:       "ffffff",
};

// ── Utilities ──────────────────────────────────────────────────────────────
function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}
function statusColor(s: string): string {
  const m: Record<string, string> = {
    backlog: C.slate400, todo: C.slate600, in_progress: C.indigo,
    in_review: C.violet, done: C.green, blocked: C.red,
  };
  return m[s] ?? C.indigo;
}
function statusLabel(s: string): string {
  const m: Record<string, string> = {
    backlog: "Backlog", todo: "To Do", in_progress: "In Progress",
    in_review: "In Review", done: "Done", blocked: "Blocked",
  };
  return m[s] ?? s;
}
function priorityColor(p: string): string {
  const m: Record<string, string> = { urgent: C.red, high: "ea580c", medium: C.amber, low: C.green };
  return m[p] ?? C.slate500;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ── Shared layout primitives ───────────────────────────────────────────────

/** Top thin indigo rule (4px) common to all content slides */
function addTopRule(slide: PptxGenJS.Slide) {
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: "100%", h: 0.055, fill: { color: C.indigo } });
}

/** Standard content-slide header block */
function addSlideHeader(
  slide: PptxGenJS.Slide,
  title: string,
  sub?: string,
  slideNum?: number,
  totalSlides?: number,
) {
  addTopRule(slide);
  // Section number chip
  if (slideNum !== undefined && totalSlides !== undefined) {
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x: 12.4, y: 0.14, w: 0.55, h: 0.26,
      fill: { color: C.indigoLight }, rectRadius: 0.06,
    });
    slide.addText(`${slideNum}/${totalSlides}`, {
      x: 12.4, y: 0.14, w: 0.55, h: 0.26,
      fontSize: 7, color: C.indigo, bold: true, align: "center",
    });
  }
  // Left accent mark
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 0.22, w: 0.055, h: 0.52, fill: { color: C.indigo }, rectRadius: 0.02 });
  slide.addText(title, { x: 0.58, y: 0.18, w: 11.5, h: 0.42, fontSize: 18, bold: true, color: C.slate900 });
  if (sub) {
    slide.addText(sub, { x: 0.58, y: 0.62, w: 11.5, h: 0.24, fontSize: 8.5, color: C.slate500 });
  }
  // Separator line
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 0.92, w: 12.45, h: 0.025, fill: { color: C.slate200 } });
}

/** Footer on every content slide */
function addSlideFooter(slide: PptxGenJS.Slide, projectName: string, date: string) {
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 7.08, w: "100%", h: 0.42, fill: { color: C.slate900 } });
  slide.addText(`Forge  ·  ${projectName}`, { x: 0.35, y: 7.13, w: 7, h: 0.32, fontSize: 7, color: C.slate400 });
  slide.addText(date, { x: 7.5, y: 7.13, w: 2.5, h: 0.32, fontSize: 7, color: C.slate500, align: "center" });
  slide.addText("CONFIDENTIAL", { x: 10.2, y: 7.13, w: 2.6, h: 0.32, fontSize: 7, color: C.indigo, align: "right", bold: true });
}

/** Colored KPI tile */
function addKpiBox(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string,
  accentColor: string, bgColor: string,
) {
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x, y, w, h,
    fill: { color: bgColor },
    line: { color: C.slate200, width: 0.5 },
    rectRadius: 0.1,
  });
  // Top accent strip
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y, w, h: 0.06, fill: { color: accentColor }, rectRadius: 0.04 });
  slide.addText(label.toUpperCase(), {
    x: x + 0.15, y: y + 0.1, w: w - 0.3, h: 0.22,
    fontSize: 6.5, bold: true, color: accentColor, charSpacing: 1,
  });
  slide.addText(value, {
    x: x + 0.15, y: y + 0.3, w: w - 0.3, h: 0.58,
    fontSize: 30, bold: true, color: C.slate900,
  });
  slide.addText(sub, {
    x: x + 0.15, y: y + 0.86, w: w - 0.3, h: 0.22,
    fontSize: 7.5, color: C.slate500,
  });
}

/** Horizontal bar row */
function addHBar(
  slide: PptxGenJS.Slide,
  x: number, y: number, totalW: number,
  label: string, value: number, maxVal: number,
  barColor: string, alt = false,
) {
  if (alt) {
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y, w: totalW, h: 0.34, fill: { color: C.slate100 } });
  }
  slide.addText(label, { x, y: y + 0.05, w: 1.65, h: 0.24, fontSize: 8.5, color: C.slate700, align: "right" });
  // Track
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: x + 1.75, y: y + 0.11, w: totalW - 2.3, h: 0.12,
    fill: { color: C.slate200 }, rectRadius: 0.04,
  });
  // Fill
  const fillW = Math.max(0.06, ((totalW - 2.3) * value) / Math.max(1, maxVal));
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: x + 1.75, y: y + 0.11, w: fillW, h: 0.12,
    fill: { color: barColor }, rectRadius: 0.04,
  });
  // Count
  slide.addText(String(value), {
    x: x + totalW - 0.48, y: y + 0.05, w: 0.44, h: 0.24,
    fontSize: 8.5, bold: true, color: barColor, align: "right",
  });
}

// ── Slide builders ────────────────────────────────────────────────────────

/** Slide 1 — Cover */
function addCoverSlide(pptx: PptxGenJS, projectName: string, projectKey: string, date: string) {
  const slide = pptx.addSlide();
  // Deep indigo background
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.indigoDeep } });
  // Decorative right-side stripe (subtle)
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 11.6, y: 0, w: 1.73, h: "100%", fill: { color: C.indigoDark } });
  // Bright bottom rule
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 6.9, w: "100%", h: 0.15, fill: { color: C.indigo } });
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 7.05, w: "100%", h: 0.08, fill: { color: C.indigoMid } });
  // Left accent bar
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.55, y: 1.4, w: 0.09, h: 3.8, fill: { color: C.indigo }, rectRadius: 0.03 });
  // Brand wordmark
  slide.addText("▣  FORGE", {
    x: 0.78, y: 1.42, w: 8, h: 0.38,
    fontSize: 9.5, color: C.indigoMid, bold: true, charSpacing: 7,
  });
  // Project name (large)
  slide.addText(projectName, {
    x: 0.78, y: 1.95, w: 10.6, h: 1.9,
    fontSize: 40, color: C.white, bold: true, lineSpacingMultiple: 1.15,
  });
  // Subtitle
  slide.addText("Project Status Presentation", {
    x: 0.78, y: 3.98, w: 8, h: 0.44,
    fontSize: 15, color: C.indigoLight,
  });
  // Key badge
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: 0.78, y: 4.56, w: 1.2, h: 0.32,
    fill: { color: C.indigo }, rectRadius: 0.06,
  });
  slide.addText(projectKey, {
    x: 0.78, y: 4.56, w: 1.2, h: 0.32,
    fontSize: 8.5, color: C.white, bold: true, align: "center",
  });
  // Date
  slide.addText(`Prepared: ${date}  ·  Confidential`, {
    x: 0.78, y: 4.98, w: 7, h: 0.28,
    fontSize: 8, color: C.slate400,
  });
}

/** Slide 2 — Agenda */
function addAgendaSlide(
  pptx: PptxGenJS,
  projectName: string,
  date: string,
  hasVelocity: boolean,
  slideNum: number,
  totalSlides: number,
) {
  const slide = pptx.addSlide();
  addSlideHeader(slide, "Agenda", "What this presentation covers", slideNum, totalSlides);

  const items: { num: string; title: string; desc: string; icon: string }[] = [
    { num: "01", title: "Project Overview",    desc: "Status, description, key dates and active sprint goal",                icon: "▣" },
    { num: "02", title: "Health At-a-Glance",  desc: "Open issues, completion rate, in-progress work and blockers",          icon: "◉" },
    { num: "03", title: "Issue Breakdown",     desc: "Status distribution and priority analysis across the full backlog",    icon: "▦" },
    ...(hasVelocity ? [{ num: "04", title: "Sprint Velocity",    desc: "Throughput per sprint and average delivery rate",                   icon: "◈" }] : []),
    { num: hasVelocity ? "05" : "04", title: "Team & Workload",      desc: "Assignee distribution and open-issue load across team members",    icon: "◎" },
    { num: hasVelocity ? "06" : "05", title: "Blockers & Risks",    desc: "Issues currently blocked and requiring escalation",                icon: "⊘" },
    { num: hasVelocity ? "07" : "06", title: "Next Steps",           desc: "Action items and discussion points for the team",                  icon: "→" },
  ];

  const colW = 5.85;
  const col2x = 6.85;
  items.forEach((item, i) => {
    const col = i < Math.ceil(items.length / 2) ? 0 : 1;
    const row = col === 0 ? i : i - Math.ceil(items.length / 2);
    const x = col === 0 ? 0.45 : col2x;
    const y = 1.12 + row * 0.88;
    const w = colW;

    // Row background
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x, y, w, h: 0.74,
      fill: { color: i % 2 === 0 ? C.slate100 : C.white },
      line: { color: C.slate200, width: 0.3 },
      rectRadius: 0.08,
    });
    // Left color accent
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x, y, w: 0.055, h: 0.74,
      fill: { color: C.indigo }, rectRadius: 0.04,
    });
    // Number chip
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x: x + 0.13, y: y + 0.18, w: 0.38, h: 0.38,
      fill: { color: C.indigoLight }, rectRadius: 0.05,
    });
    slide.addText(item.num, {
      x: x + 0.13, y: y + 0.18, w: 0.38, h: 0.38,
      fontSize: 8, bold: true, color: C.indigo, align: "center",
    });
    // Title
    slide.addText(item.title, {
      x: x + 0.6, y: y + 0.1, w: w - 0.7, h: 0.28,
      fontSize: 10, bold: true, color: C.slate900,
    });
    // Description
    slide.addText(item.desc, {
      x: x + 0.6, y: y + 0.38, w: w - 0.7, h: 0.3,
      fontSize: 7.5, color: C.slate500,
    });
  });

  addSlideFooter(slide, projectName, date);
}

/** Slide 3 — About This Project */
function addAboutSlide(
  pptx: PptxGenJS,
  project: {
    name: string; key: string; description?: string | null;
    start_date: string | null; target_go_live: string | null; status: string;
  },
  activeSprint: { name: string; goal?: string | null; startDate: string | null; endDate: string | null } | null,
  memberCount: number,
  totalIssues: number,
  completedSprints: number,
  projectName: string,
  date: string,
  slideNum: number,
  totalSlides: number,
) {
  const slide = pptx.addSlide();
  addSlideHeader(slide, "About This Project", `${project.key}  ·  ${project.name}`, slideNum, totalSlides);

  // Status badge
  const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
    active:   { label: "Active",   color: C.green,  bg: C.greenLight },
    on_hold:  { label: "On Hold",  color: C.amber,  bg: C.amberLight },
    closed:   { label: "Closed",   color: C.slate600, bg: C.slate200 },
    archived: { label: "Archived", color: C.slate500, bg: C.slate100 },
  };
  const sm = statusMeta[project.status] ?? { label: project.status, color: C.indigo, bg: C.indigoLight };
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: 0.45, y: 1.05, w: 1.15, h: 0.3,
    fill: { color: sm.bg }, rectRadius: 0.1,
  });
  slide.addText(`● ${sm.label}`, {
    x: 0.45, y: 1.05, w: 1.15, h: 0.3,
    fontSize: 8, bold: true, color: sm.color, align: "center",
  });

  // Description box
  const desc = project.description?.trim()
    ? project.description.trim()
    : "No project description has been set. Visit the project settings in Forge to add context about this project's goals, scope, and objectives.";
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: 0.45, y: 1.45, w: 8.5, h: 1.85,
    fill: { color: C.slate100 },
    line: { color: C.slate200, width: 0.5 },
    rectRadius: 0.1,
  });
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 1.45, w: 0.055, h: 1.85, fill: { color: C.indigo }, rectRadius: 0.04 });
  slide.addText("PROJECT DESCRIPTION", {
    x: 0.62, y: 1.56, w: 8.2, h: 0.24,
    fontSize: 7, bold: true, color: C.indigo, charSpacing: 1,
  });
  slide.addText(desc, {
    x: 0.62, y: 1.83, w: 8.18, h: 1.35,
    fontSize: 9, color: C.slate700, lineSpacingMultiple: 1.4,
  });

  // Right: meta stats column
  const metaX = 9.3;
  const metaTiles = [
    { label: "Team Members", value: String(memberCount),      color: C.indigo,  bg: C.indigoLight },
    { label: "Total Issues",  value: String(totalIssues),     color: C.violet,  bg: "ede9fe" },
    { label: "Sprints Done",  value: String(completedSprints), color: C.green,   bg: C.greenLight },
  ];
  metaTiles.forEach((t, i) => {
    const ty = 1.05 + i * 0.84;
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x: metaX, y: ty, w: 3.55, h: 0.7,
      fill: { color: t.bg },
      line: { color: C.slate200, width: 0.4 },
      rectRadius: 0.08,
    });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: metaX, y: ty, w: 0.055, h: 0.7, fill: { color: t.color }, rectRadius: 0.04 });
    slide.addText(t.label.toUpperCase(), {
      x: metaX + 0.15, y: ty + 0.08, w: 3.3, h: 0.2,
      fontSize: 6.5, bold: true, color: t.color, charSpacing: 1,
    });
    slide.addText(t.value, {
      x: metaX + 0.15, y: ty + 0.26, w: 3.3, h: 0.36,
      fontSize: 24, bold: true, color: C.slate900,
    });
  });

  // Dates row
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: 0.45, y: 3.46, w: 12.4, h: 0.7,
    fill: { color: C.white },
    line: { color: C.slate200, width: 0.5 },
    rectRadius: 0.08,
  });
  const dateItems = [
    { label: "Start Date",    value: fmtDate(project.start_date) },
    { label: "Target Go-Live", value: fmtDate(project.target_go_live) },
    { label: "Project Key",   value: project.key },
  ];
  dateItems.forEach((d, i) => {
    const dx = 0.65 + i * 4.2;
    slide.addText(d.label.toUpperCase(), {
      x: dx, y: 3.54, w: 3.8, h: 0.2,
      fontSize: 6.5, bold: true, color: C.slate400, charSpacing: 1,
    });
    slide.addText(d.value, {
      x: dx, y: 3.74, w: 3.8, h: 0.28,
      fontSize: 11, bold: true, color: C.slate900,
    });
  });

  // Active sprint callout
  if (activeSprint) {
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x: 0.45, y: 4.32, w: 12.4, h: 1.12,
      fill: { color: C.indigoLight },
      line: { color: C.indigo, width: 0.4 },
      rectRadius: 0.1,
    });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 4.32, w: 0.055, h: 1.12, fill: { color: C.indigo }, rectRadius: 0.04 });
    slide.addText("ACTIVE SPRINT", {
      x: 0.62, y: 4.42, w: 5, h: 0.22,
      fontSize: 7, bold: true, color: C.indigo, charSpacing: 1,
    });
    slide.addText(`${fmtDate(activeSprint.startDate)} – ${fmtDate(activeSprint.endDate)}`, {
      x: 9.5, y: 4.42, w: 3.2, h: 0.22,
      fontSize: 8, color: C.indigoDark, align: "right",
    });
    slide.addText(activeSprint.name, {
      x: 0.62, y: 4.65, w: 9, h: 0.34,
      fontSize: 14, bold: true, color: C.indigoDark,
    });
    if (activeSprint.goal) {
      slide.addText(`Sprint Goal: ${activeSprint.goal}`, {
        x: 0.62, y: 5.02, w: 11.8, h: 0.28,
        fontSize: 8.5, color: C.indigo,
      });
    }
  }

  addSlideFooter(slide, projectName, date);
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string; key: string }> },
) {
  const { tenant: slug, key: projectKey } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctxCanDo(ctx, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const svc = createSupabaseServiceClient();
  const [projects, ] = await Promise.all([
    projectsRepo(svc).listByTenant(ctx.tenant.id, ["active", "on_hold", "closed"]),
  ]);
  const project = projects.find((p) => p.key === projectKey);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [allIssues, sprints, members, velocity] = await Promise.all([
    issuesRepo(svc).listByProject(ctx.tenant.id, project.id).catch(() => []),
    sprintsRepo(svc).listForProject(ctx.tenant.id, project.id).catch(() => []),
    projectMembersRepo(svc).list(ctx.tenant.id, project.id).catch(() => []),
    sprintsRepo(svc).velocity(ctx.tenant.id, project.id, 6).catch(() => []),
  ]);

  const activeSprint = sprints.find((s) => s.status === "active") ?? null;
  const completedSprints = sprints.filter((s) => s.status === "completed").length;

  // Issue stats
  const total     = allIssues.length;
  const done      = allIssues.filter((i) => i.status === "done").length;
  const inProg    = allIssues.filter((i) => i.status === "in_progress").length;
  const blocked   = allIssues.filter((i) =>
    i.status === "blocked" ||
    (i.labels as string[] | null ?? []).some((l: string) => l.toLowerCase().includes("block"))
  ).length;
  const unassigned = allIssues.filter((i) => !i.assignee_id && i.status !== "done").length;
  const pctDone   = pct(done, total);

  const statusMap: Record<string, number> = {};
  for (const i of allIssues) statusMap[i.status] = (statusMap[i.status] ?? 0) + 1;

  const openIssues = allIssues.filter((i) => i.status !== "done");
  const priMap: Record<string, number> = {};
  for (const i of openIssues) priMap[i.priority] = (priMap[i.priority] ?? 0) + 1;

  const assigneeMap: Record<string, number> = {};
  for (const i of openIssues) {
    const name = members.find((m) => m.userId === i.assignee_id)?.name
      ?? (i.assignee_id ? "Unknown" : "Unassigned");
    assigneeMap[name] = (assigneeMap[name] ?? 0) + 1;
  }
  const topAssignees = Object.entries(assigneeMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const sprintIssues  = activeSprint
    ? allIssues.filter((i) => (i as unknown as { sprint_id?: string }).sprint_id === activeSprint.id)
    : [];
  const sprintDone    = sprintIssues.filter((i) => i.status === "done").length;
  const sprintTotal   = sprintIssues.length;

  const blockerIssues = allIssues
    .filter((i) =>
      i.status === "blocked" ||
      (i.labels as string[] | null ?? []).some((l: string) => l.toLowerCase().includes("block"))
    )
    .slice(0, 8);

  const hasVelocity = velocity.length > 0 || !!activeSprint;

  // Slide count: Cover + Agenda + About + Health + Issues + [Velocity] + Team + Blockers + NextSteps + Q&A
  const TOTAL_SLIDES = 8 + (hasVelocity ? 1 : 0);
  let slideNum = 0;

  // ── Build PowerPoint ───────────────────────────────────────────────────
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Forge";
  pptx.company = ctx.tenant.name ?? "Forge";
  pptx.subject = `${project.name} Status Presentation`;
  pptx.title   = `${project.name} Project Status`;

  const today = new Date().toLocaleDateString("en-US", { dateStyle: "long" });

  // ── Slide 1: Cover ────────────────────────────────────────────────────
  addCoverSlide(pptx, project.name, project.key, today);
  slideNum = 1;

  // ── Slide 2: Agenda ───────────────────────────────────────────────────
  slideNum++;
  addAgendaSlide(pptx, project.name, today, hasVelocity, slideNum, TOTAL_SLIDES);

  // ── Slide 3: About This Project ───────────────────────────────────────
  slideNum++;
  addAboutSlide(
    pptx, project,
    activeSprint ? { name: activeSprint.name, goal: activeSprint.goal, startDate: activeSprint.startDate, endDate: activeSprint.endDate } : null,
    members.length, total, completedSprints,
    project.name, today, slideNum, TOTAL_SLIDES,
  );

  // ── Slide 4: Health At-a-Glance ───────────────────────────────────────
  {
    slideNum++;
    const slide = pptx.addSlide();
    const health = blocked > 0 ? "⚠  Needs Attention" : pctDone > 70 ? "✓  On Track" : "●  In Progress";
    const healthColor = blocked > 0 ? C.red : pctDone > 70 ? C.green : C.indigo;
    const healthBg    = blocked > 0 ? C.redLight : pctDone > 70 ? C.greenLight : C.indigoLight;

    addSlideHeader(slide, "Project Health At-a-Glance", today, slideNum, TOTAL_SLIDES);

    // Health badge
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x: 0.45, y: 1.08, w: 2.8, h: 0.36,
      fill: { color: healthColor }, rectRadius: 0.1,
    });
    slide.addText(health, {
      x: 0.45, y: 1.08, w: 2.8, h: 0.36,
      fontSize: 10, color: C.white, bold: true, align: "center",
    });

    // Health summary line
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x: 3.5, y: 1.08, w: 9.35, h: 0.36,
      fill: { color: healthBg }, rectRadius: 0.08,
    });
    const healthLine = blocked > 0
      ? `${blocked} blocked issue${blocked > 1 ? "s" : ""} need resolution — these are preventing forward progress.`
      : pctDone > 70
      ? `${pctDone}% complete. Strong progress — ${total - done} remaining issue${total - done !== 1 ? "s" : ""} before close.`
      : `${pctDone}% complete. ${inProg} issue${inProg !== 1 ? "s" : ""} actively in progress. ${unassigned} unassigned.`;
    slide.addText(healthLine, {
      x: 3.65, y: 1.1, w: 9.1, h: 0.32,
      fontSize: 8.5, color: C.slate800,
    });

    // Progress bar
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 1.56, w: 12.4, h: 0.2, fill: { color: C.slate200 }, rectRadius: 0.04 });
    if (pctDone > 0) {
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 1.56, w: 12.4 * (pctDone / 100), h: 0.2, fill: { color: C.green }, rectRadius: 0.04 });
    }
    slide.addText(`${pctDone}% complete  ·  ${done} of ${total} issues`, {
      x: 0.45, y: 1.79, w: 12.4, h: 0.22,
      fontSize: 7.5, color: C.slate500, align: "center",
    });

    // KPI row
    const kpiW = 2.8, kpiH = 1.22, kpiY = 2.12;
    const kpiGap = (12.4 - kpiW * 4) / 3;
    addKpiBox(slide, 0.45,                       kpiY, kpiW, kpiH, "Open Issues",  String(total - done), "not yet done",      C.indigo,  C.indigoLight);
    addKpiBox(slide, 0.45 + kpiW + kpiGap,       kpiY, kpiW, kpiH, "In Progress",  String(inProg),       "being worked now",  C.violet,  "ede9fe");
    addKpiBox(slide, 0.45 + (kpiW + kpiGap) * 2, kpiY, kpiW, kpiH, "Completed",    String(done),         `of ${total} total`, C.green,   C.greenLight);
    addKpiBox(slide, 0.45 + (kpiW + kpiGap) * 3, kpiY, kpiW, kpiH, "Blocked",      String(blocked),      "need escalation",
      blocked > 0 ? C.red : C.green,
      blocked > 0 ? C.redLight : C.greenLight,
    );

    // Sprint progress strip
    if (activeSprint) {
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
        x: 0.45, y: 3.52, w: 12.4, h: 1.0,
        fill: { color: C.slate100 },
        line: { color: C.slate200, width: 0.4 },
        rectRadius: 0.08,
      });
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 3.52, w: 0.055, h: 1.0, fill: { color: C.indigo }, rectRadius: 0.04 });
      slide.addText("ACTIVE SPRINT", {
        x: 0.62, y: 3.62, w: 5, h: 0.2, fontSize: 7, bold: true, color: C.indigo, charSpacing: 1,
      });
      slide.addText(activeSprint.name, {
        x: 0.62, y: 3.84, w: 8, h: 0.3, fontSize: 13, bold: true, color: C.slate900,
      });
      if (activeSprint.goal) {
        slide.addText(`Goal: ${activeSprint.goal}`, {
          x: 0.62, y: 4.16, w: 9, h: 0.24, fontSize: 8, color: C.slate500,
        });
      }
      slide.addText(`${fmtDate(activeSprint.startDate)} → ${fmtDate(activeSprint.endDate)}`, {
        x: 9.8, y: 3.68, w: 2.9, h: 0.22, fontSize: 8, color: C.slate500, align: "right",
      });
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.62, y: 4.34, w: 5, h: 0.1, fill: { color: C.slate200 }, rectRadius: 0.03 });
      if (sprintTotal > 0) {
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
          x: 0.62, y: 4.34, w: 5 * (sprintDone / sprintTotal), h: 0.1,
          fill: { color: C.green }, rectRadius: 0.03,
        });
      }
      slide.addText(`${sprintDone}/${sprintTotal} sprint issues done`, {
        x: 5.8, y: 4.3, w: 2.5, h: 0.2, fontSize: 7.5, color: C.slate500,
      });
    }

    if (project.start_date || project.target_go_live) {
      slide.addText(
        `Project timeline: ${fmtDate(project.start_date ?? null)} → ${fmtDate(project.target_go_live ?? null)}`,
        { x: 0.45, y: 4.72, w: 8, h: 0.26, fontSize: 8, color: C.slate400 },
      );
    }

    addSlideFooter(slide, project.name, today);
  }

  // ── Slide 5: Issue Breakdown ───────────────────────────────────────────
  {
    slideNum++;
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Issue Breakdown", "Status and priority distribution across all issues", slideNum, TOTAL_SLIDES);

    const statuses  = ["backlog", "todo", "in_progress", "in_review", "done", "blocked"].filter((st) => (statusMap[st] ?? 0) > 0);
    const maxStatus = Math.max(1, ...statuses.map((st) => statusMap[st] ?? 0));
    const priorities = ["urgent", "high", "medium", "low"].filter((p) => (priMap[p] ?? 0) > 0);
    const maxPri    = Math.max(1, ...priorities.map((p) => priMap[p] ?? 0));

    slide.addText("BY STATUS", { x: 0.45, y: 1.08, w: 5.9, h: 0.22, fontSize: 7.5, bold: true, color: C.slate400, charSpacing: 1 });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 1.3, w: 5.9, h: 0.035, fill: { color: C.slate200 } });
    statuses.forEach((st, i) => {
      addHBar(slide, 0.45, 1.36 + i * 0.4, 5.9, statusLabel(st), statusMap[st] ?? 0, maxStatus, statusColor(st), i % 2 === 1);
    });

    slide.addText("BY PRIORITY (OPEN ISSUES)", { x: 7.05, y: 1.08, w: 5.8, h: 0.22, fontSize: 7.5, bold: true, color: C.slate400, charSpacing: 1 });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 7.05, y: 1.3, w: 5.8, h: 0.035, fill: { color: C.slate200 } });
    priorities.forEach((p, i) => {
      addHBar(slide, 7.05, 1.36 + i * 0.4, 5.8, p.charAt(0).toUpperCase() + p.slice(1), priMap[p] ?? 0, maxPri, priorityColor(p), i % 2 === 1);
    });

    // Divider
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 6.65, y: 1.08, w: 0.03, h: 5, fill: { color: C.slate200 } });

    // Summary callout bar
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x: 0.45, y: 5.6, w: 12.4, h: 1.22,
      fill: { color: C.indigoLight },
      line: { color: C.indigo, width: 0.4 },
      rectRadius: 0.1,
    });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 5.6, w: 0.055, h: 1.22, fill: { color: C.indigo }, rectRadius: 0.04 });
    slide.addText("Summary", {
      x: 0.62, y: 5.68, w: 11.8, h: 0.3, fontSize: 9, bold: true, color: C.indigoDark,
    });
    slide.addText(
      `${pctDone}% of all issues completed  ·  ${inProg} actively in progress  ·  ${unassigned} unassigned  ·  ${blocked} blocked`,
      { x: 0.62, y: 5.98, w: 11.8, h: 0.3, fontSize: 9, color: C.indigo },
    );
    slide.addText(`Total tracked: ${total} issues`, {
      x: 0.62, y: 6.3, w: 8, h: 0.24, fontSize: 8, color: C.slate500,
    });

    addSlideFooter(slide, project.name, today);
  }

  // ── Slide 6: Sprint Velocity ───────────────────────────────────────────
  if (hasVelocity) {
    slideNum++;
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Sprint Velocity", `${completedSprints} completed sprint${completedSprints !== 1 ? "s" : ""}`, slideNum, TOTAL_SLIDES);

    const avgV = velocity.length > 0
      ? Math.round(velocity.reduce((a, v) => a + v.done, 0) / velocity.length)
      : 0;
    const maxV = Math.max(1, ...velocity.map((v) => v.done));

    // KPI tiles
    addKpiBox(slide, 0.45, 1.08, 2.8, 1.08, "Avg Velocity",     `${avgV}`, "issues/sprint", C.indigo, C.indigoLight);
    addKpiBox(slide, 3.5,  1.08, 2.8, 1.08, "Sprints Complete",  `${completedSprints}`, "in this project", C.green, C.greenLight);

    if (activeSprint) {
      addKpiBox(slide, 6.55, 1.08, 2.8, 1.08, "Sprint Progress",
        sprintTotal > 0 ? `${Math.round(sprintDone / sprintTotal * 100)}%` : "—",
        `${sprintDone}/${sprintTotal} done`, C.violet, "ede9fe",
      );
    }

    // Bar chart
    if (velocity.length > 0) {
      const chartH = 3.0, baseY = 5.5;
      const barW  = Math.min(1.3, 11 / velocity.length * 0.65);
      const gap   = velocity.length > 1 ? (11 - barW * velocity.length) / (velocity.length - 1) : 0;

      // Baseline
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.9, y: baseY, w: 11.5, h: 0.03, fill: { color: C.slate300 } });

      // Avg line
      const avgY = baseY - chartH * (avgV / maxV);
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.9, y: avgY, w: 11.5, h: 0.025, fill: { color: C.amber } });
      slide.addText(`avg: ${avgV}`, {
        x: 12.1, y: avgY - 0.14, w: 0.8, h: 0.24, fontSize: 7, color: C.amber, bold: true,
      });

      velocity.forEach((v, i) => {
        const bh = chartH * (v.done / maxV);
        const bx = 0.9 + i * (barW + gap);
        const by = baseY - bh;
        // Gradient-like effect: slightly lighter top
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: bx, y: by, w: barW, h: bh, fill: { color: C.indigo }, rectRadius: 0.06 });
        if (v.done > 0) {
          slide.addText(String(v.done), {
            x: bx, y: by - 0.28, w: barW, h: 0.24,
            fontSize: 9, bold: true, color: C.indigo, align: "center",
          });
        }
        slide.addText(truncate(v.name.replace(/sprint/i, "").trim() || `S${i + 1}`, 10), {
          x: bx, y: baseY + 0.06, w: barW, h: 0.26,
          fontSize: 7.5, color: C.slate500, align: "center",
        });
      });
    } else {
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 2.5, w: 12.4, h: 1.5, fill: { color: C.slate100 }, rectRadius: 0.1 });
      slide.addText("No completed sprints yet — velocity data will appear here once sprints are closed.", {
        x: 0.65, y: 2.9, w: 12, h: 0.6, fontSize: 11, color: C.slate400, align: "center",
      });
    }

    addSlideFooter(slide, project.name, today);
  }

  // ── Slide 7: Team & Workload ───────────────────────────────────────────
  {
    slideNum++;
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Team & Workload", `${members.length} member${members.length !== 1 ? "s" : ""} · open issue distribution`, slideNum, TOTAL_SLIDES);

    const maxLoad = Math.max(1, ...topAssignees.map(([, c]) => c));
    slide.addText("OPEN ISSUE DISTRIBUTION", { x: 0.45, y: 1.08, w: 8, h: 0.22, fontSize: 7.5, bold: true, color: C.slate400, charSpacing: 1 });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 1.3, w: 8, h: 0.035, fill: { color: C.slate200 } });
    topAssignees.forEach(([name, count], i) => {
      addHBar(slide, 0.45, 1.36 + i * 0.4, 8, name, count, maxLoad, C.indigo, i % 2 === 1);
    });

    // Divider
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 8.85, y: 1.08, w: 0.03, h: 5.5, fill: { color: C.slate200 } });

    // Team roster
    slide.addText("TEAM ROSTER", { x: 9.0, y: 1.08, w: 3.85, h: 0.22, fontSize: 7.5, bold: true, color: C.slate400, charSpacing: 1 });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 9.0, y: 1.3, w: 3.85, h: 0.035, fill: { color: C.slate200 } });
    members.slice(0, 12).forEach((m, i) => {
      const ry = 1.36 + i * 0.38;
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
        x: 9.0, y: ry, w: 3.85, h: 0.36,
        fill: { color: i % 2 === 0 ? C.slate100 : C.white },
      });
      slide.addText(truncate(m.name ?? m.email ?? "", 22), {
        x: 9.1, y: ry + 0.06, w: 2.5, h: 0.26, fontSize: 9, color: C.slate800,
      });
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
        x: 11.7, y: ry + 0.06, w: 1.05, h: 0.24,
        fill: { color: m.role === "lead" ? C.indigoLight : C.slate100 }, rectRadius: 0.08,
      });
      slide.addText(m.role, {
        x: 11.7, y: ry + 0.06, w: 1.05, h: 0.24,
        fontSize: 7.5, color: m.role === "lead" ? C.indigo : C.slate500,
        bold: m.role === "lead", align: "center",
      });
    });

    addSlideFooter(slide, project.name, today);
  }

  // ── Slide 8: Blockers & Risks ──────────────────────────────────────────
  {
    slideNum++;
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Blockers & Open Risks", "Issues requiring immediate attention or escalation", slideNum, TOTAL_SLIDES);

    if (blockerIssues.length === 0) {
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
        x: 1.5, y: 2.3, w: 10.33, h: 1.7,
        fill: { color: C.greenLight },
        line: { color: "bbf7d0", width: 0.5 },
        rectRadius: 0.12,
      });
      slide.addText("✓  No Blocked Issues", {
        x: 1.5, y: 2.55, w: 10.33, h: 0.55,
        fontSize: 20, bold: true, color: C.greenDark, align: "center",
      });
      slide.addText("All issues are progressing normally. The team is clear of blockers.", {
        x: 1.5, y: 3.15, w: 10.33, h: 0.35, fontSize: 10, color: C.slate500, align: "center",
      });
    } else {
      // Table header
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 1.06, w: 12.4, h: 0.36, fill: { color: C.red } });
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: 1.06, w: 0.055, h: 0.36, fill: { color: "b91c1c" }, rectRadius: 0.04 });
      [
        { label: "KEY",          x: 0.6,   w: 1.15 },
        { label: "ISSUE TITLE",  x: 1.85,  w: 5.8  },
        { label: "ASSIGNEE",     x: 7.75,  w: 2.8  },
        { label: "PRIORITY",     x: 10.6,  w: 1.1  },
        { label: "DAYS",         x: 11.8,  w: 0.95 },
      ].forEach((col) => {
        slide.addText(col.label, {
          x: col.x, y: 1.1, w: col.w, h: 0.28,
          fontSize: 7.5, bold: true, color: C.white,
        });
      });

      blockerIssues.forEach((iss, i) => {
        const rowY = 1.5 + i * 0.5;
        const bg = i % 2 === 0 ? C.redLight : C.white;
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: rowY, w: 12.4, h: 0.46, fill: { color: bg } });
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.45, y: rowY, w: 0.055, h: 0.46, fill: { color: C.red } });

        const issTyped = iss as { title: string; status: string; assignee_id?: string; number?: number; priority?: string; created_at?: string };
        slide.addText(`${projectKey}-${issTyped.number ?? "?"}`, {
          x: 0.6, y: rowY + 0.1, w: 1.15, h: 0.28, fontSize: 8.5, bold: true, color: C.slate700,
        });
        slide.addText(truncate(String(issTyped.title ?? ""), 68), {
          x: 1.85, y: rowY + 0.1, w: 5.8, h: 0.28, fontSize: 9, color: C.slate800,
        });
        const assigneeName = members.find((m) => m.userId === issTyped.assignee_id)?.name
          ?? (issTyped.assignee_id ? "Unknown" : "Unassigned");
        slide.addText(truncate(assigneeName, 20), {
          x: 7.75, y: rowY + 0.1, w: 2.8, h: 0.28, fontSize: 8.5, color: C.slate600,
        });
        const pri = (issTyped.priority ?? "medium");
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
          x: 10.6, y: rowY + 0.1, w: 1.0, h: 0.26, fill: { color: C.amberLight }, rectRadius: 0.08,
        });
        slide.addText(pri.charAt(0).toUpperCase() + pri.slice(1), {
          x: 10.6, y: rowY + 0.1, w: 1.0, h: 0.26, fontSize: 7.5, color: C.amber, bold: true, align: "center",
        });
        const days = issTyped.created_at
          ? Math.floor((Date.now() - new Date(issTyped.created_at).getTime()) / 86_400_000)
          : 0;
        slide.addText(`${days}d`, {
          x: 11.8, y: rowY + 0.1, w: 0.95, h: 0.28, fontSize: 9.5, bold: true, color: C.red, align: "right",
        });
      });
    }

    addSlideFooter(slide, project.name, today);
  }

  // ── Slide 9: Next Steps ────────────────────────────────────────────────
  {
    slideNum++;
    const slide = pptx.addSlide();
    addSlideHeader(slide, "Next Steps & Action Items", "Edit to add your talking points before the presentation", slideNum, TOTAL_SLIDES);

    const items = [
      { text: "Sprint planning — review and re-prioritize the backlog",       editable: false },
      { text: "Unblock critical-path issues and assign resolution owners",    editable: false },
      { text: "Review and formally close out completed milestones",           editable: false },
      { text: "Capacity check: confirm team availability for the next sprint", editable: false },
      { text: "[Add your next step here — double-click to edit in PowerPoint]", editable: true },
    ];

    items.forEach((item, i) => {
      const y = 1.1 + i * 0.75;
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
        x: 0.45, y, w: 12.4, h: 0.62,
        fill: { color: item.editable ? C.amberLight : (i % 2 === 0 ? C.slate100 : C.white) },
        line: { color: item.editable ? "fde68a" : C.slate200, width: 0.4 },
        rectRadius: 0.08,
      });
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
        x: 0.45, y, w: 0.055, h: 0.62,
        fill: { color: item.editable ? C.amber : C.indigo }, rectRadius: 0.04,
      });
      // Number circle
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
        x: 0.62, y: y + 0.12, w: 0.36, h: 0.36,
        fill: { color: item.editable ? C.amberLight : C.indigoLight }, rectRadius: 0.18,
      });
      slide.addText(`${i + 1}`, {
        x: 0.62, y: y + 0.12, w: 0.36, h: 0.36,
        fontSize: 9, bold: true, color: item.editable ? C.amber : C.indigo, align: "center",
      });
      slide.addText(item.text, {
        x: 1.1, y: y + 0.14, w: 11.65, h: 0.34,
        fontSize: 11, color: item.editable ? C.amber : C.slate800,
        italic: item.editable,
      });
    });

    addSlideFooter(slide, project.name, today);
  }

  // ── Slide 10: Q&A ─────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.indigoDeep } });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 11.6, y: 0, w: 1.73, h: "100%", fill: { color: C.indigoDark } });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 6.9, w: "100%", h: 0.15, fill: { color: C.indigo } });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 7.05, w: "100%", h: 0.08, fill: { color: C.indigoMid } });
    slide.addText("▣  FORGE", {
      x: 1.5, y: 1.8, w: 10.33, h: 0.42,
      fontSize: 10, color: C.indigoMid, bold: true, align: "center", charSpacing: 7,
    });
    slide.addText("Questions &\nDiscussion", {
      x: 1.2, y: 2.35, w: 10.0, h: 2.4,
      fontSize: 44, color: C.white, bold: true, align: "center", lineSpacingMultiple: 1.1,
    });
    slide.addText(project.name, {
      x: 1.2, y: 4.9, w: 10.0, h: 0.44,
      fontSize: 14, color: C.indigoLight, align: "center",
    });
    slide.addText(today, {
      x: 1.2, y: 5.4, w: 10.0, h: 0.3,
      fontSize: 9, color: C.slate500, align: "center",
    });
  }

  // ── Output ────────────────────────────────────────────────────────────
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
