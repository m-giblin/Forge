import { describe, it, expect } from "vitest";
import { hashKey, hasScope, parseBearer } from "@/lib/api/keys";
import { SCOPES } from "@/lib/api/scopes";

describe("hashKey", () => {
  it("is deterministic and SHA-256 hex (64 chars)", () => {
    const h = hashKey("forge_travli_abc123");
    expect(h).toBe(hashKey("forge_travli_abc123"));
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs for different inputs", () => {
    expect(hashKey("a")).not.toBe(hashKey("b"));
  });

  it("matches a known SHA-256 vector", () => {
    // echo -n "abc" | shasum -a 256
    expect(hashKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("hasScope", () => {
  it("grants when present, denies when absent", () => {
    expect(hasScope([SCOPES.ISSUES_READ, SCOPES.ISSUES_WRITE], SCOPES.ISSUES_WRITE)).toBe(true);
    expect(hasScope([SCOPES.ISSUES_READ], SCOPES.ISSUES_WRITE)).toBe(false);
    expect(hasScope([], SCOPES.ISSUES_READ)).toBe(false);
  });
});

describe("parseBearer", () => {
  it("extracts the token", () => {
    expect(parseBearer("Bearer forge_x")).toBe("forge_x");
    expect(parseBearer("bearer forge_x")).toBe("forge_x"); // case-insensitive
  });
  it("returns null for missing or malformed headers", () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("forge_x")).toBeNull();
    expect(parseBearer("Basic abc")).toBeNull();
  });
});
