/**
 * FORGE-198: the one list of file types a user may attach — issue page,
 * + New issue pop-up, REST API and Think Tank all read it from here, so the
 * copies can't drift. Safe to import on the client (no server-only code).
 *
 * Text types have no magic number, so they're recognised by file extension
 * (browsers report .md as "text/markdown" or nothing at all, and .csv as
 * "application/vnd.ms-excel" on Windows) and checked as real UTF-8 text on
 * the server instead (see services/fileSignature.ts).
 */

const BINARY_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.ms-excel",
];

/** Canonical content type for each text extension. */
const TEXT_EXTENSIONS: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  log: "text/plain",
  csv: "text/csv",
  json: "application/json",
};

export const TEXT_ATTACHMENT_TYPES = [...new Set(Object.values(TEXT_EXTENSIONS))];
export const ALLOWED_ATTACHMENT_TYPES = [...BINARY_TYPES, ...TEXT_ATTACHMENT_TYPES];
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** For <input accept>: the types plus the text extensions (some OSes give text files no type). */
export const ATTACHMENT_ACCEPT = [...ALLOWED_ATTACHMENT_TYPES, ...Object.keys(TEXT_EXTENSIONS).map((e) => `.${e}`)].join(",");

/** Short label for upload hints. */
export const ATTACHMENT_TYPES_LABEL = "images, PDF, Word, Excel, .md, .txt, .csv, .json, .log";

export function isTextAttachmentType(contentType: string): boolean {
  return TEXT_ATTACHMENT_TYPES.includes(contentType);
}

/**
 * The content type a file is stored and checked as, or null if not allowed.
 * A text extension always wins over what the browser reported.
 */
export function resolveAttachmentType(filename: string, reportedType: string): string | null {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  if (TEXT_EXTENSIONS[ext]) return TEXT_EXTENSIONS[ext];
  return BINARY_TYPES.includes(reportedType) ? reportedType : null;
}

/**
 * The Content-Type header to store a file with. Text gets an explicit UTF-8
 * charset — without it browsers guess Latin-1 and "café" shows as "cafÃ©".
 */
export function storageContentType(contentType: string): string {
  return isTextAttachmentType(contentType) ? `${contentType}; charset=utf-8` : contentType;
}
