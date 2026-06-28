import { NextRequest, NextResponse } from "next/server";
import {
  getTenantByWorkspaceId,
  getSlackConfig,
  verifySlackSignature,
  createIssueFromSlack,
  postEphemeral,
} from "@/lib/services/slack";
import { getRateLimiter } from "@/lib/providers/rate-limiter";

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "") // strip any HTML/Slack mrkdwn tags
    .replace(/[^\x20-\x7E -￿]/g, "") // strip control chars
    .trim()
    .slice(0, 255); // hard cap
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);

  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";
  const teamId = params.get("team_id") ?? "";
  const userId = params.get("user_id") ?? "";
  const channelId = params.get("channel_id") ?? "";
  const rawText = (params.get("text") ?? "").trim();

  if (!rawText) {
    return NextResponse.json({ response_type: "ephemeral", text: "Usage: `/forge [title of issue]`" });
  }

  const text = sanitizeTitle(rawText);
  if (!text) {
    return NextResponse.json({ response_type: "ephemeral", text: "Issue title cannot be empty after sanitization." });
  }

  // IP-level rate limit: 30 slash commands per workspace per 10 minutes.
  const rl = getRateLimiter();
  const rlResult = await rl.check(`slack:slash:${teamId}`, 30, 10 * 60_000);
  if (!rlResult.allowed) {
    return NextResponse.json({ response_type: "ephemeral", text: "Rate limit reached — slow down a bit and try again." });
  }

  // Look up tenant by workspace ID
  const tenantId = await getTenantByWorkspaceId(teamId);
  if (!tenantId) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "This Slack workspace is not connected to a Forge tenant. Ask your admin to configure it under Settings → Chat.",
    });
  }

  // Verify signature
  const config = await getSlackConfig(tenantId);
  if (!config) {
    return NextResponse.json({ response_type: "ephemeral", text: "Slack bot is not fully configured. Ask your admin to add the Signing Secret." });
  }

  const valid = await verifySlackSignature(config.signingSecret, rawBody, timestamp, signature);
  if (!valid) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const issue = await createIssueFromSlack(tenantId, text, `Created from Slack slash command by <@${userId}>`);
  if (!issue) {
    return NextResponse.json({ response_type: "ephemeral", text: "Failed to create issue — no default project found. Ask your admin to set a default project." });
  }

  // Also post a visible confirmation to the channel
  void postEphemeral(
    config.botToken,
    channelId,
    userId,
    `✅ Created *${issue.key}*: ${text}\nView it in Forge.`
  );

  return NextResponse.json({
    response_type: "ephemeral",
    text: `✅ Created *${issue.key}*: ${text}`,
  });
}
