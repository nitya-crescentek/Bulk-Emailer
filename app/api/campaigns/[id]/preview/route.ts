import { handle, HttpError, requireId } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { buildContext, missingVariables, render } from "@/lib/template";
import type { Mapping, Row } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renders the campaign's email for one recipient (`?index=1`). */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/preview">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);
    const index = Math.max(1, Number(new URL(request.url).searchParams.get("index")) || 1);

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
    });
    if (!campaign) throw new HttpError(404, "Campaign not found.");

    const recipient =
      (await prisma.recipient.findFirst({ where: { campaignId: id, index } })) ??
      (await prisma.recipient.findFirst({
        where: { campaignId: id },
        orderBy: { index: "asc" },
      }));
    if (!recipient) throw new HttpError(404, "This campaign has no recipients.");

    const mapping = campaign.mapping as unknown as Mapping;
    const context = buildContext(recipient.row as unknown as Row, mapping);
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
