import { NextRequest, NextResponse } from "next/server";
import {
  getTenantByWorkspaceId,
  getSlackConfig,
  verifySlackSignature,
  createIssueFromSlack,
  postEphemeral,
  fetchMessage,
} from "@/lib/services/slack";

const BUG_EMOJI = "bug";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Slack URL verification challenge (sent once when you configure the endpoint)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type !== "event_callback") {
    return new NextResponse("OK", { status: 200 });
  }

  const teamId = body.team_id as string;
  const tenantId = await getTenantByWorkspaceId(teamId);
  if (!tenantId) return new NextResponse("OK", { status: 200 });

  const config = await getSlackConfig(tenantId);
  if (!config) return new NextResponse("OK", { status: 200 });

  // Verify signature
  const valid = await verifySlackSignature(config.signingSecret, rawBody, timestamp, signature);
  if (!valid) return new NextResponse("Invalid signature", { status: 401 });

  const event = body.event as Record<string, unknown> | undefined;
  if (!event || event.type !== "reaction_added" || event.reaction !== BUG_EMOJI) {
    return new NextResponse("OK", { status: 200 });
  }

  const userId = event.user as string;
  const item = event.item as Record<string, unknown> | undefined;
  if (!item || item.type !== "message") return new NextResponse("OK", { status: 200 });

  const channel = item.channel as string;
  const ts = item.ts as string;

  // Fetch the reacted-to message text
  const messageText = await fetchMessage(config.botToken, channel, ts);
  const title = messageText
    ? messageText.slice(0, 100).replace(/\n/g, " ")
    : "Issue from Slack";

  const description = messageText
    ? `Created from Slack message by <@${userId}>:\n\n> ${messageText}`
    : `Created from Slack by <@${userId}>`;

  const issue = await createIssueFromSlack(tenantId, title, description);
  if (!issue) return new NextResponse("OK", { status: 200 });

  void postEphemeral(
    config.botToken,
    channel,
    userId,
    `🐛 Created *${issue.key}*: ${title}`
  );

  return new NextResponse("OK", { status: 200 });
}
