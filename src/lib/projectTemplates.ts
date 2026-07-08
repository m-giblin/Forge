export type TemplateKey = "blank" | "bug-tracker" | "scrum" | "kanban";

export type ProjectTemplate = {
  key: TemplateKey;
  label: string;
  description: string;
  icon: string;
  sprintName?: string;
  sprintGoal?: string;
  categories: { name: string; color: string }[];
  issues: { title: string; type: string; priority: string; status: string }[];
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    key: "blank",
    label: "Blank project",
    description: "Start with a clean slate. No sample data.",
    icon: "⬜",
    categories: [],
    issues: [],
  },
  {
    key: "bug-tracker",
    label: "Bug Tracker",
    description: "Triage and resolve bugs fast. Pre-loaded with severity categories and sample bugs.",
    icon: "🐛",
    categories: [
      { name: "Critical", color: "#ef4444" },
      { name: "UI / Visual", color: "#8b5cf6" },
      { name: "Performance", color: "#f97316" },
      { name: "Data / Logic", color: "#0ea5e9" },
    ],
    issues: [
      { title: "Login fails on Safari 17 — CSRF token mismatch", type: "bug", priority: "urgent", status: "todo" },
      { title: "Dashboard chart flickers on first render", type: "bug", priority: "medium", status: "todo" },
      { title: "API response slow when >1000 records returned", type: "bug", priority: "high", status: "in_progress" },
      { title: "Update error message for invalid email format", type: "task", priority: "low", status: "todo" },
      { title: "Add Cypress test for checkout flow", type: "task", priority: "medium", status: "backlog" },
    ],
  },
  {
    key: "scrum",
    label: "Scrum Sprint",
    description: "Sprint planning ready. Includes an active sprint and backlog stories to get you started.",
    icon: "🏃",
    sprintName: "Sprint 1",
    sprintGoal: "Ship the core MVP feature set",
    categories: [
      { name: "Frontend", color: "#6366f1" },
      { name: "Backend", color: "#22c55e" },
      { name: "QA", color: "#f59e0b" },
    ],
    issues: [
      { title: "Set up CI/CD pipeline with GitHub Actions", type: "task", priority: "high", status: "todo" },
      { title: "Design system: define color tokens and typography scale", type: "task", priority: "medium", status: "todo" },
      { title: "User authentication — login, signup, password reset", type: "feature", priority: "urgent", status: "in_progress" },
      { title: "Dashboard: key metrics at a glance", type: "feature", priority: "high", status: "todo" },
      { title: "Write unit tests for auth service", type: "task", priority: "medium", status: "backlog" },
      { title: "Mobile responsiveness pass on all pages", type: "task", priority: "low", status: "backlog" },
    ],
  },
  {
    key: "kanban",
    label: "Kanban Flow",
    description: "Continuous delivery with a visual board. Work flows from backlog through to done.",
    icon: "📋",
    categories: [
      { name: "Design", color: "#ec4899" },
      { name: "Engineering", color: "#6366f1" },
      { name: "Content", color: "#14b8a6" },
    ],
    issues: [
      { title: "Review and update onboarding copy", type: "task", priority: "medium", status: "backlog" },
      { title: "Implement dark mode toggle", type: "feature", priority: "medium", status: "todo" },
      { title: "Optimize image loading with lazy load + WebP", type: "task", priority: "high", status: "in_progress" },
      { title: "Accessibility audit — fix all WCAG 2.1 AA issues", type: "task", priority: "high", status: "in_review" },
      { title: "Changelog: document v1.2 release notes", type: "task", priority: "low", status: "done" },
    ],
  },
];

export function getTemplate(key: TemplateKey): ProjectTemplate {
  return PROJECT_TEMPLATES.find((t) => t.key === key) ?? PROJECT_TEMPLATES[0];
}
