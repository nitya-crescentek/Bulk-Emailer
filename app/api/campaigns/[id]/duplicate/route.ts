import { handle, HttpError, requireId } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toCampaign } from "@/lib/serialize";
import { parseCsv } from "@/lib/source";
import { buildRecipients, normalizeMapping } from "@/lib/campaign-build";
import type { CampaignStats } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSERT_CHUNK = 1000;

/**
 * Clone a campaign into a fresh draft so it can be sent again — the original's
 * send log stays intact. Needs the original data source to still exist so the
 * recipient list can be rebuilt.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/duplicate">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);

    const original = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
    });
    if (!original) throw new HttpError(404, "Campaign not found.");
    if (!original.sourceId) {
      throw new HttpError(
        400,
        "The original data source is gone — import the sheet again as a new campaign."
      );
    }

    const source = await prisma.source.findFirst({
      where: { id: original.sourceId, userId: user.id },
    });
    if (!source) {
      throw new HttpError(
        400,
        "The original data source has expired — re-import it as a new campaign."
      );
    }

    // Keep the original SMTP profile if it still exists, else leave it unset so
    // the user picks one before sending.
    const profile = original.smtpProfileId
      ? await prisma.smtpProfile.findFirst({
          where: { id: original.smtpProfileId, userId: user.id },
          select: { id: true },
        })
      : null;

    const mapping = normalizeMapping(original.mapping, source.columns);
    const { rows } = parseCsv(source.csv);
    const recipients = buildRecipients(rows, mapping, { dedupe: true });
    const sendable = recipients.filter((r) => r.status === "pending").length;

    const copy = await prisma.campaign.create({
      data: {
        userId: user.id,
        name: nextCopyName(original.name),
        status: "draft",
        sourceId: source.id,
        sourceLabel: original.sourceLabel,
        columns: source.columns,
        smtpProfileId: profile?.id ?? null,
        templateId: original.templateId,
        subject: original.subject,
        html: original.html,
        design: (original.design ?? undefined) as Prisma.InputJsonValue | undefined,
        editorMode: original.editorMode,
        mapping: original.mapping as unknown as Prisma.InputJsonValue,
        rateLimit: original.rateLimit,
      },
    });

    for (let i = 0; i < recipients.length; i += INSERT_CHUNK) {
      await prisma.recipient.createMany({
        data: recipients.slice(i, i + INSERT_CHUNK).map((r) => ({
          ...r,
          campaignId: copy.id,
          row: r.row as unknown as Prisma.InputJsonValue,
        })),
      });
    }

    const stats: CampaignStats = {
      total: recipients.length,
      sent: 0,
      failed: 0,
      pending: sendable,
      skipped: recipients.length - sendable,
    };
    return { campaign: toCampaign(copy, stats) };
  });
}

/** "Q3 outreach" -> "Q3 outreach (copy)", then "(copy 2)", "(copy 3)"… */
function nextCopyName(name: string): string {
  const base = name.replace(/\s*\(copy(?:\s+\d+)?\)\s*$/i, "");
  return `${base} (copy)`.slice(0, 160);
}
