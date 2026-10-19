import "server-only";

import { publicEnv, serverEnv } from "@/lib/env";
import { matchesFileSignature, signatureCheckBytes } from "@/lib/services/fileSignature";

export type StoredFileCheck = "ok" | "missing" | "mismatch";

/**
 * Reads back the leading bytes of a file a client uploaded straight to
 * Storage (signed upload URL — the bytes never pass through app code) and
 * checks them against the declared type, plus that Storage will serve it as
 * that same type. Used by issue attachments and Think Tank attachments.
 *
 * The storage SDK's download() doesn't expose a Range header, so this calls
 * the Storage REST API directly instead of pulling the whole object down.
 */
export async function verifyStoredFile(bucket: string, storagePath: string, contentType: string, sizeBytes: number): Promise<StoredFileCheck> {
  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`, {
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Range: `bytes=0-${signatureCheckBytes(contentType) - 1}`,
    },
  });
  if (!res.ok) return "missing";
  // FORGE-198: the type Storage will serve the file as must be the one we
  // checked — otherwise a .md uploaded with "Content-Type: text/html" would
  // pass the text check and then be served as a web page.
  const storedType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const head = new Uint8Array(await res.arrayBuffer());
  return storedType === contentType && matchesFileSignature(head, contentType, sizeBytes <= head.length) ? "ok" : "mismatch";
}
