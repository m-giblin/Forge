// Ember Rust avatar palette (HANDOFF.md §2.1) — the spec's fixed per-person
// set, reused here as a rotation since real tenants have more than 5 users.
const AVATAR_COLORS = ["#8c4632", "#3a6ea8", "#5b6b4a", "#7a4fa0", "#a1663f"];

export function avatarColor(id: string): string {
  const code = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}
