import { describe, it, expect } from "vitest";
import { createIssueSchema } from "@/lib/api/schemas";

describe("createIssueSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(createIssueSchema.safeParse({ title: "Crash on save" }).success).toBe(true);
  });

  it("accepts full rich context", () => {
    const r = createIssueSchema.safeParse({
      title: "x",
      description: "d",
      priority: "urgent",
      type: "bug",
      projectKey: "WEB",
      environment: "prod",
      appVersion: "1.0.0",
      stackTrace: "at foo",
      labels: ["a", "b"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing or empty title", () => {
    expect(createIssueSchema.safeParse({}).success).toBe(false);
    expect(createIssueSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("accepts arbitrary priority/type strings (config validation happens in the route)", () => {
    // status/priority/type are per-tenant configurable, so the schema only
    // shape-checks them as short strings; the route validates against the
    // tenant's options (see api-test: unknown value → 422).
    expect(createIssueSchema.safeParse({ title: "x", priority: "p1" }).success).toBe(true);
    expect(createIssueSchema.safeParse({ title: "x", type: "story" }).success).toBe(true);
    expect(createIssueSchema.safeParse({ title: "x", status: "research" }).success).toBe(true);
  });

  it("still rejects over-long field values", () => {
    expect(createIssueSchema.safeParse({ title: "x", priority: "p".repeat(41) }).success).toBe(false);
  });

  it("enforces length and array caps", () => {
    expect(createIssueSchema.safeParse({ title: "a".repeat(501) }).success).toBe(false);
    expect(createIssueSchema.safeParse({ title: "x", labels: Array(21).fill("l") }).success).toBe(false);
  });
});
