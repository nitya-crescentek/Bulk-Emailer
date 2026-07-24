import { handle, HttpError, toObjectId } from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { toCampaign } from "@/lib/serialize";
import { isRunning, recomputeStats } from "@/lib/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const _id = toObjectId(id);
    const { campaigns, smtp } = await collections();

    const doc = await campaigns.findOne({ _id });
    if (!doc) throw new HttpError(404, "Campaign not found.");

    const profile = await smtp.findOne({ _id: doc.smtpProfileId });
    const stats = await recomputeStats(_id);

    return {
      campaign: toCampaign({ ...doc, stats }, profile?.name),
      running: isRunning(id),
    };
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    if (isRunning(id)) {
      throw new HttpError(409, "Pause the campaign before deleting it.");
    }
    const _id = toObjectId(id);
    const { campaigns, recipients } = await collections();

    const result = await campaigns.deleteOne({ _id });
    if (result.deletedCount === 0) throw new HttpError(404, "Campaign not found.");
    await recipients.deleteMany({ campaignId: _id });
    return { ok: true };
  });
}
