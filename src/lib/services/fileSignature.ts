import "server-only";

/**
 * Magic-number (file signature) check — defense-in-depth against a spoofed
 * `Content-Type`. The client declares its MIME type in the upload request,
 * but nothing stops a browser fetch() call or a modified client from
 * declaring "image/png" while actually sending arbitrary bytes; this checks
 * the real leading bytes against what the declared type should look like.
 *
 * Not a full content-type sniffer: OOXML types (docx/xlsx) and legacy OLE
 * types (doc/xls) share one container format each, so this only confirms
 * "this is genuinely a zip" / "this is genuinely an OLE compound file" —
 * enough to reject an executable or script renamed with an office extension,
 * without needing to unzip/parse the file to distinguish docx from xlsx.
 */

type Signature = { bytes: (number | null)[]; offset?: number };

const SIGNATURES: Record<string, Signature[]> = {
  "image/png": [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff] }],
  "image/gif": [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // "GIF8"
  "image/webp": [{ bytes: [0x52, 0x49, 0x46, 0x46] }, { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }], // "RIFF"...."WEBP"
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // "%PDF"
  // OOXML (docx/xlsx) — zip container, signature "PK\x03\x04"
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
  // Legacy OLE compound file (doc/xls)
  "application/msword": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
  "application/vnd.ms-excel": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }],
};

/** Bytes needed from the start of the file to check every signature above. */
export const SIGNATURE_CHECK_BYTES = 16;

function matchesAt(head: Uint8Array, sig: Signature): boolean {
  const offset = sig.offset ?? 0;
  if (head.length < offset + sig.bytes.length) return false;
  return sig.bytes.every((b, i) => b === null || head[offset + i] === b);
}

/**
 * Returns true if `head` (the first SIGNATURE_CHECK_BYTES bytes of the
 * uploaded file) matches the expected signature for `contentType`. Unknown
 * content types (shouldn't happen — callers should already validate against
 * an allowlist) fail closed.
 */
export function matchesFileSignature(head: Uint8Array, contentType: string): boolean {
  const sigs = SIGNATURES[contentType];
  if (!sigs) return false;
  // webp needs both its RIFF header AND its WEBP fourCC to match; every other
  // type has exactly one signature entry, so `every` is just that one check.
  return sigs.every((sig) => matchesAt(head, sig));
}
