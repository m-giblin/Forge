import "server-only";
import { TEXT_ATTACHMENT_TYPES } from "@/lib/attachmentTypes";

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

// FORGE-198: plain-text types have no magic number. Instead, a sample of the
// file must be genuine text: valid UTF-8 and no NUL / binary control bytes —
// an executable or image renamed to .md fails this on its first bytes.
const TEXT_TYPES = new Set(TEXT_ATTACHMENT_TYPES);
const TEXT_SAMPLE_BYTES = 8192;

/** How many leading bytes to read back for `contentType`'s check. */
export function signatureCheckBytes(contentType: string): number {
  return TEXT_TYPES.has(contentType) ? TEXT_SAMPLE_BYTES : SIGNATURE_CHECK_BYTES;
}

function looksLikeText(sample: Uint8Array, isWholeFile: boolean): boolean {
  if (sample.length === 0) return false;
  for (const b of sample) {
    // Allow tab, LF, CR, form feed; reject NUL and other C0 control bytes.
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d && b !== 0x0c) return false;
  }
  // A sample cut mid-character may end in a partial UTF-8 sequence; trim up to 3 trailing bytes.
  let end = sample.length;
  if (!isWholeFile) {
    let back = 0;
    while (back < 3 && end - back - 1 >= 0 && (sample[end - back - 1] & 0xc0) === 0x80) back++;
    const lead = end - back - 1;
    if (lead >= 0 && sample[lead] >= 0xc0) end = lead;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample.subarray(0, end));
    return true;
  } catch {
    return false;
  }
}

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
export function matchesFileSignature(head: Uint8Array, contentType: string, isWholeFile = false): boolean {
  if (TEXT_TYPES.has(contentType)) return looksLikeText(head, isWholeFile || head.length < TEXT_SAMPLE_BYTES);
  const sigs = SIGNATURES[contentType];
  if (!sigs) return false;
  // webp needs both its RIFF header AND its WEBP fourCC to match; every other
  // type has exactly one signature entry, so `every` is just that one check.
  return sigs.every((sig) => matchesAt(head, sig));
}
