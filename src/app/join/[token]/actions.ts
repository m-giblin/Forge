"use server";

import { acceptInvite, provisionInvitedAccount } from "@/lib/services/members";

// Next.js sanitizes thrown Server Action errors in production (generic message +
// digest, real message dropped) — expected, user-facing errors here (invite already
// used, email taken, etc.) must be returned instead of thrown so the real message
// reaches the client.

/** Accept an invite for the signed-in user. Returns the tenant slug to land on. */
export async function acceptInviteAction(token: string): Promise<{ slug: string } | { error: string }> {
  try {
    const slug = await acceptInvite(token);
    return { slug };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not accept invite." };
  }
}

/** Provision an auto-confirmed account for a valid invite (the client then signs in). */
export async function provisionInvitedAccountAction(
  token: string,
  email: string,
  password: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await provisionInvitedAccount(token, email, password);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create account." };
  }
}
