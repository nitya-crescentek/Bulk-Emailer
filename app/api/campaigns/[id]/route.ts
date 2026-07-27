import { handle, HttpError, requireId } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toCampaign } from "@/lib/serialize";
import { isRunning, recomputeStats } from "@/lib/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);

    const doc = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      include: { smtpProfile: { select: { name: true } } },
    });
    if (!doc) throw new HttpError(404, "Campaign not found.");

    const stats = await recomputeStats(id);
    return {
      campaign: toCampaign(doc, stats, doc.smtpProfile?.name),
      running: isRunning(id),
    };
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);

    if (isRunning(id)) {
      throw new HttpError(409, "Pause the campaign before deleting it.");
    }
    // Recipients cascade via the schema relation.
    const result = await prisma.campaign.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) throw new HttpError(404, "Campaign not found.");
    return { ok: true };
  });
}
