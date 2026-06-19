import { describe, it, expect } from "vitest";
import { resolveImpersonationSecret, DEV_IMPERSONATION_SECRET } from "@/lib/impersonation-secret";

describe("resolveImpersonationSecret (SEC-05)", () => {
  it("uses the dedicated secret when set, in any environment", () => {
    expect(resolveImpersonationSecret("s3cret", true)).toBe("s3cret");
    expect(resolveImpersonationSecret("s3cret", false)).toBe("s3cret");
  });

  it("throws in production when the secret is missing (no service-role fallback)", () => {
    expect(() => resolveImpersonationSecret(undefined, true)).toThrow(/required in production/);
    expect(() => resolveImpersonationSecret("", true)).toThrow(/required in production/);
  });

  it("falls back to a non-production dev constant outside production", () => {
    expect(resolveImpersonationSecret(undefined, false)).toBe(DEV_IMPERSONATION_SECRET);
    expect(DEV_IMPERSONATION_SECRET).not.toMatch(/service|role|key/i);
  });
});
