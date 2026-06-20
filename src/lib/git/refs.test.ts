import { describe, it, expect } from "vitest";
import { parseIssueRefs } from "./refs";

const KEYS = ["FORGE", "WEB", "TT"];

describe("parseIssueRefs", () => {
  it("finds a ref in a branch name", () => {
    const refs = parseIssueRefs({ branch: "feature/FORGE-204-redis-limiter" }, KEYS);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ key: "FORGE", number: 204, ref: "FORGE-204", sources: ["branch"] });
    expect(refs[0].isClosing).toBe(false);
  });

  it("normalises lowercase keys in branches to the canonical ref", () => {
    const refs = parseIssueRefs({ branch: "forge-204-thing" }, KEYS);
    expect(refs[0].ref).toBe("FORGE-204");
  });

  it("detects a closing verb in the title", () => {
    const refs = parseIssueRefs({ title: "Fixes FORGE-204: retry handler" }, KEYS);
    expect(refs[0].isClosing).toBe(true);
  });

  it("does NOT treat a bare title ref as closing", () => {
    const refs = parseIssueRefs({ title: "Work towards FORGE-204" }, KEYS);
    expect(refs[0].isClosing).toBe(false);
  });

  it("never marks a branch-only ref as closing (no verbs in branches)", () => {
    const refs = parseIssueRefs({ branch: "fixes-FORGE-204" }, KEYS);
    expect(refs[0].isClosing).toBe(false);
  });

  it("merges the same issue cited in multiple places and records sources in order", () => {
    const refs = parseIssueRefs(
      { branch: "WEB-9-x", title: "WEB-9 polish", body: "see WEB-9" },
      KEYS
    );
    expect(refs).toHaveLength(1);
    expect(refs[0].sources).toEqual(["branch", "title", "body"]);
  });

  it("returns multiple distinct refs", () => {
    const refs = parseIssueRefs({ title: "FORGE-1 and WEB-2 and TT-3" }, KEYS);
    expect(refs.map((r) => r.ref).sort()).toEqual(["FORGE-1", "TT-3", "WEB-2"]);
  });

  it("ignores refs whose key is not a real project (false-positive guard)", () => {
    const refs = parseIssueRefs({ title: "encode as utf-8 and base-64, re COVID-19" }, KEYS);
    expect(refs).toHaveLength(0);
  });

  it("ignores a known key with a non-positive / non-numeric tail", () => {
    expect(parseIssueRefs({ title: "FORGE-0 nope" }, KEYS)).toHaveLength(0);
    expect(parseIssueRefs({ title: "FORGE-abc" }, KEYS)).toHaveLength(0);
  });

  it("returns nothing for empty input", () => {
    expect(parseIssueRefs({}, KEYS)).toEqual([]);
    expect(parseIssueRefs({ branch: null, title: "", body: undefined }, KEYS)).toEqual([]);
  });

  it("OR-merges isClosing across sources (closing in title, bare in body)", () => {
    const refs = parseIssueRefs({ title: "resolve FORGE-7", body: "FORGE-7 notes" }, KEYS);
    expect(refs[0].isClosing).toBe(true);
  });
});
