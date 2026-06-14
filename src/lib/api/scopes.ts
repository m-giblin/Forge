// API key scopes. Keep the set small and explicit; least-privilege by default.
export const SCOPES = {
  ISSUES_READ: "issues:read",
  ISSUES_WRITE: "issues:write",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

export const ALL_SCOPES: Scope[] = [SCOPES.ISSUES_READ, SCOPES.ISSUES_WRITE];
