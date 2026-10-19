import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { matchesFileSignature, signatureCheckBytes } from "@/lib/services/fileSignature";
import { resolveAttachmentType, ALLOWED_ATTACHMENT_TYPES } from "@/lib/attachmentTypes";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("resolveAttachmentType (FORGE-198)", () => {
  it("maps text extensions to one canonical type, whatever the browser said", () => {
    expect(resolveAttachmentType("notes.md", "")).toBe("text/markdown");
    expect(resolveAttachmentType("README.MARKDOWN", "text/x-markdown")).toBe("text/markdown");
    expect(resolveAttachmentType("run.log", "")).toBe("text/plain");
    expect(resolveAttachmentType("a.txt", "text/plain")).toBe("text/plain");
    // Windows reports .csv as an Excel type.
    expect(resolveAttachmentType("data.csv", "application/vnd.ms-excel")).toBe("text/csv");
    expect(resolveAttachmentType("payload.json", "application/json")).toBe("application/json");
  });

  it("keeps allowed binary types and refuses everything else", () => {
    expect(resolveAttachmentType("shot.png", "image/png")).toBe("image/png");
    expect(resolveAttachmentType("page.html", "text/html")).toBeNull();
    expect(resolveAttachmentType("run.exe", "application/octet-stream")).toBeNull();
    expect(resolveAttachmentType("noext", "")).toBeNull();
  });

  it("every allowed type has a content check", () => {
    for (const t of ALLOWED_ATTACHMENT_TYPES) expect(signatureCheckBytes(t)).toBeGreaterThan(0);
  });
});

describe("text content check (FORGE-198)", () => {
  it("accepts real text, including UTF-8 and a BOM", () => {
    expect(matchesFileSignature(bytes("# Title\n\n- item\tvalue\r\n"), "text/markdown", true)).toBe(true);
    expect(matchesFileSignature(bytes("﻿café, naïve, 東京\n"), "text/plain", true)).toBe(true);
    expect(matchesFileSignature(bytes('{"a":1}'), "application/json", true)).toBe(true);
  });

  it("rejects binary renamed as text", () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // "MZ" + NUL
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(matchesFileSignature(exe, "text/markdown", true)).toBe(false);
    expect(matchesFileSignature(png, "text/plain", true)).toBe(false);
    expect(matchesFileSignature(new Uint8Array([0xff, 0xfe, 0x41]), "text/csv", true)).toBe(false); // invalid UTF-8
    expect(matchesFileSignature(new Uint8Array(), "text/plain", true)).toBe(false);
  });

  it("tolerates a sample cut in the middle of a multi-byte character", () => {
    const full = bytes("a".repeat(8190) + "東"); // 3-byte char straddles the 8192-byte sample
    const sample = full.subarray(0, 8192);
    expect(matchesFileSignature(sample, "text/markdown", false)).toBe(true);
  });

  it("leaves binary signatures unchanged", () => {
    expect(matchesFileSignature(bytes("%PDF-1.7"), "application/pdf")).toBe(true);
    expect(matchesFileSignature(bytes("hello"), "application/pdf")).toBe(false);
  });
});
