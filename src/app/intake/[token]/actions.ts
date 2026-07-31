"use server";

import { headers } from "next/headers";
import { submitIntake } from "@/lib/services/intakeForms";

function clientIp(headerList: Awaited<ReturnType<typeof headers>>): string {
  return headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Public, unauthenticated — no getTenantContext call, everything is scoped by the validated token inside submitIntake(). */
export async function submitIntakeAction(
  token: string, summary: string, answers: Record<string, string>, submitterEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = clientIp(await headers());
  return submitIntake(token, summary, answers, submitterEmail || null, ip);
}
