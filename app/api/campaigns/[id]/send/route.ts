import { handle, HttpError, toObjectId } from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { isRunning, recomputeStats, requestStop, requeueFailed, startCampaign } from "@/lib/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "start" | "pause" | "retry-failed";

/** `{ action: "start" | "pause" | "retry-failed" }` */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/send">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const _id = toObjectId(id);
    const body = await request.json().catch(() => ({}));
    const action: Action = body.action ?? "start";

    const { campaigns } = await collections();

    if (action === "pause") {
      if (!requestStop(id)) {
        // Nothing running in this process — make sure the record agrees.
        await campaigns.updateOne(
          { _id, status: "sending" },
          { $set: { status: "paused" } }
        );
      }
      return { ok: true, stopping: true };
    }

    if (action === "retry-failed") {
      if (isRunning(id)) {
        throw new HttpError(409, "Pause the campaign before retrying failed rows.");
      }
      const requeued = await requeueFailed(_id);
      if (requeued === 0) throw new HttpError(400, "There are no failed rows to retry.");
      await startCampaign(id);
      return { ok: true, requeued };
    }

    await startCampaign(id);
    return { ok: true, stats: await recomputeStats(_id) };
  });
}
