"use server";

import { acceptInvite, provisionInvitedAccount } from "@/lib/services/members";

/** Accept an invite for the signed-in user. Returns the tenant slug to land on. */
export async function acceptInviteAction(token: string): Promise<{ slug: string }> {
  const slug = await acceptInvite(token);
  return { slug };
}

/** Provision an auto-confirmed account for a valid invite (the client then signs in). */
export async function provisionInvitedAccountAction(token: string, email: string, password: string) {
  await provisionInvitedAccount(token, email, password);
}
