import { handle, HttpError, requireId } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toRecipient } from "@/lib/serialize";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const STATUSES = ["pending", "sending", "sent", "failed", "skipped"];

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/recipients">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);

    const owned = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!owned) throw new HttpError(404, "Campaign not found.");

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

    const where: Prisma.RecipientWhereInput = { campaignId: id };
    if (status && STATUSES.includes(status)) where.status = status;
    if (q) where.email = { contains: q, mode: "insensitive" };

    const [rows, total] = await Promise.all([
      prisma.recipient.findMany({
        where,
        orderBy: { index: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.recipient.count({ where }),
    ]);

    return {
      recipients: rows.map(toRecipient),
      page,
      pageSize: PAGE_SIZE,
      total,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  });
}
