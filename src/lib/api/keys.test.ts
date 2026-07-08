import { describe, it, expect, beforeAll } from "vitest";
import { hashKey, hasScope, parseBearer } from "@/lib/api/keys";
import { SCOPES } from "@/lib/api/scopes";

// hashKey uses HMAC-SHA256 with API_KEY_HASH_SECRET. Tests set a fixed pepper so
// they don't depend on the production secret and can include a known-vector check.
const TEST_PEPPER = "test-pepper-for-unit-tests-only-not-a-real-secret";
beforeAll(() => { process.env.API_KEY_HASH_SECRET = TEST_PEPPER; });

describe("hashKey", () => {
  it("is deterministic and returns 64-char hex", () => {
    const h = hashKey("forge_travli_abc123");
    expect(h).toBe(hashKey("forge_travli_abc123"));
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs for different inputs", () => {
    expect(hashKey("a")).not.toBe(hashKey("b"));
  });

  it("matches a known HMAC-SHA256 vector", () => {
    // node -e "require('crypto').createHmac('sha256','test-pepper-for-unit-tests-only-not-a-real-secret').update('abc').digest('hex') |> console.log"
    const { createHmac } = require("node:crypto");
    const expected = createHmac("sha256", TEST_PEPPER).update("abc").digest("hex");
    expect(hashKey("abc")).toBe(expected);
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
