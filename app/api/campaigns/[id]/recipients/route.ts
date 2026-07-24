import type { Filter } from "mongodb";
import { handle, toObjectId } from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { toRecipient } from "@/lib/serialize";
import type { RecipientDoc, RecipientStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const STATUSES: RecipientStatus[] = ["pending", "sending", "sent", "failed", "skipped"];

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/recipients">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const campaignId = toObjectId(id);
    const url = new URL(request.url);

    const status = url.searchParams.get("status") as RecipientStatus | null;
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

    const filter: Filter<RecipientDoc> = { campaignId };
    if (status && STATUSES.includes(status)) filter.status = status;
    if (q) filter.email = { $regex: escapeRegex(q), $options: "i" };

    const { recipients } = await collections();
    const [docs, total] = await Promise.all([
      recipients
        .find(filter)
        .sort({ index: 1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .toArray(),
      recipients.countDocuments(filter),
    ]);

    return {
      recipients: docs.map(toRecipient),
      page,
      pageSize: PAGE_SIZE,
      total,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
