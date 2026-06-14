import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Standard API response envelope, consistent across every v1 endpoint.
 * Errors never leak internals (no stack traces, no DB messages to clients).
 */
export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "rate_limited"
  | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 422,
  rate_limited: 429,
  internal: 500,
};

// Optional requestId param lets catch blocks thread the same ID into both
// the log entry and the client response so they can be correlated.
export function apiError(
  code: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>,
  requestId?: string
) {
  const rid = requestId ?? crypto.randomUUID();
  if (code === "internal") {
    logger.error(message, { requestId: rid, ...extra });
  }
  return NextResponse.json(
    { error: { code, message, requestId: rid, ...(extra ? { details: extra } : {}) } },
    { status: STATUS[code] }
  );
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
