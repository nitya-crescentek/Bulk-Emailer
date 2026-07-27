import { handle, HttpError, requireId } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import {
  createTransport,
  describeMailError,
  fromAddress,
} from "@/lib/mailer";
import { isEmail } from "@/lib/source";
import { buildContext, htmlToText, render } from "@/lib/template";
import type { Mapping, Row } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends the campaign's email — rendered with a real row's data — to a single
 * address, without touching the queue. `{ to, index? }`
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/test">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);
    const body = await request.json();

    const to = typeof body.to === "string" ? body.to.trim() : "";
    if (!isEmail(to)) throw new HttpError(400, "Enter a valid address to test with.");

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
    });
    if (!campaign) throw new HttpError(404, "Campaign not found.");
    if (!campaign.smtpProfileId) {
      throw new HttpError(400, "This campaign has no SMTP profile.");
    }

    const profile = await prisma.smtpProfile.findUnique({
      where: { id: campaign.smtpProfileId },
    });
    if (!profile) throw new HttpError(400, "The SMTP profile for this campaign is missing.");

    const index = Number(body.index) || 1;
    const recipient =
      (await prisma.recipient.findFirst({ where: { campaignId: id, index } })) ??
      (await prisma.recipient.findFirst({
        where: { campaignId: id },
        orderBy: { index: "asc" },
      }));
    if (!recipient) throw new HttpError(400, "This campaign has no recipients.");

    const mapping = campaign.mapping as unknown as Mapping;
    const context = buildContext(recipient.row as unknown as Row, mapping);
    const html = render(campaign.html, context, { escape: true });
    const transport = createTransport({
      host: profile.host,
      port: profile.port,
      secure: profile.secure,
      user: profile.username,
      password: decrypt(profile.password),
    });

    try {
      const info = await transport.sendMail({
        from: fromAddress(profile),
        to,
        replyTo: profile.replyTo || undefined,
        subject: `[TEST] ${render(campaign.subject, context)}`,
        html,
        text: htmlToText(html),
      });
      return { ok: true, messageId: info.messageId, usedRow: recipient.index };
    } catch (err) {
      throw new HttpError(400, describeMailError(err));
    } finally {
      transport.close();
    }
  });
}
