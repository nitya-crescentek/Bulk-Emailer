import { handle, HttpError, requireId } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import {
  isRunning,
  recomputeStats,
  requestStop,
  requeueFailed,
  startCampaign,
} from "@/lib/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "start" | "pause" | "retry-failed";

/** `{ action: "start" | "pause" | "retry-failed" }` */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/send">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);
    const body = await request.json().catch(() => ({}));
    const action: Action = body.action ?? "start";

    // Ownership check before doing anything else.
    const owned = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!owned) throw new HttpError(404, "Campaign not found.");

    if (action === "pause") {
      if (!requestStop(id)) {
        await prisma.campaign.updateMany({
          where: { id, status: "sending" },
          data: { status: "paused" },
        });
      }
      return { ok: true, stopping: true };
    }

    if (action === "retry-failed") {
      if (isRunning(id)) {
        throw new HttpError(409, "Pause the campaign before retrying failed rows.");
      }
      const requeued = await requeueFailed(id);
      if (requeued === 0) throw new HttpError(400, "There are no failed rows to retry.");
      await startCampaign(id);
      return { ok: true, requeued };
    }

    await startCampaign(id);
    return { ok: true, stats: await recomputeStats(id) };
  });
}
