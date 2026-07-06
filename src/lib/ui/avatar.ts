const AVATAR_COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#14B8A6", "#F59E0B", "#10B981", "#3B82F6", "#F97316"];

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
