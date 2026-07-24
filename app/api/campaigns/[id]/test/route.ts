import { handle, HttpError, toObjectId } from "@/lib/http";
import {
  describeMailError,
  fromAddress,
  transportForProfile,
} from "@/lib/mailer";
import { collections } from "@/lib/mongodb";
import { isEmail } from "@/lib/source";
import { buildContext, htmlToText, render } from "@/lib/template";

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
    const { id } = await ctx.params;
    const campaignId = toObjectId(id);
    const body = await request.json();

    const to = typeof body.to === "string" ? body.to.trim() : "";
    if (!isEmail(to)) throw new HttpError(400, "Enter a valid address to test with.");

    const { campaigns, recipients, smtp } = await collections();
    const campaign = await campaigns.findOne({ _id: campaignId });
    if (!campaign) throw new HttpError(404, "Campaign not found.");

    const profile = await smtp.findOne({ _id: campaign.smtpProfileId });
    if (!profile) throw new HttpError(400, "The SMTP profile for this campaign is missing.");

    const index = Number(body.index) || 1;
    const recipient =
      (await recipients.findOne({ campaignId, index })) ??
      (await recipients.findOne({ campaignId }, { sort: { index: 1 } }));
    if (!recipient) throw new HttpError(400, "This campaign has no recipients.");

    const context = buildContext(recipient.row, campaign.mapping);
    const html = render(campaign.html, context, { escape: true });
    const transport = transportForProfile(profile);

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
