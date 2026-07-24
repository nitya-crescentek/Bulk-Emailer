import { handle, HttpError, toObjectId } from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { buildContext, missingVariables, render } from "@/lib/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renders the campaign's email for one recipient (`?index=1`). */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/preview">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const campaignId = toObjectId(id);
    const index = Math.max(1, Number(new URL(request.url).searchParams.get("index")) || 1);

    const { campaigns, recipients } = await collections();
    const campaign = await campaigns.findOne({ _id: campaignId });
    if (!campaign) throw new HttpError(404, "Campaign not found.");

    const recipient =
      (await recipients.findOne({ campaignId, index })) ??
      (await recipients.findOne({ campaignId }, { sort: { index: 1 } }));
    if (!recipient) throw new HttpError(404, "This campaign has no recipients.");

    const context = buildContext(recipient.row, campaign.mapping);
    const html = render(campaign.html, context, { escape: true });
    const subject = render(campaign.subject, context);

    return {
      index: recipient.index,
      to: recipient.email,
      subject,
      html,
      missing: missingVariables(`${campaign.subject}\n${campaign.html}`, context),
    };
  });
}
