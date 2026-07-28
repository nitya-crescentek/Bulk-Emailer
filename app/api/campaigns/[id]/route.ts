import { clampRate, handle, HttpError, requireId, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toCampaign } from "@/lib/serialize";
import { parseCsv } from "@/lib/source";
import {
  buildRecipients,
  normalizeMapping,
  readCampaignContent,
} from "@/lib/campaign-build";
import { isRunning, recomputeStats } from "@/lib/sender";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSERT_CHUNK = 1000;

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

/**
 * Edit a campaign. Copy (name/subject/body/design/template) can be changed at
 * any time — it only affects sends that haven't happened yet. Recipient-shaping
 * fields (data source, mapping, dedupe) can only change while the campaign is a
 * draft, since they rebuild the whole recipient list from scratch.
 */
export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);
    const body = await request.json();

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
    });
    if (!campaign) throw new HttpError(404, "Campaign not found.");
    if (isRunning(id)) {
      throw new HttpError(409, "Pause the campaign before editing it.");
    }

    const content = readCampaignContent(body);
    const name = requireString(body.name, "Campaign name", { max: 160 });

    let templateId: string | null = null;
    if (body.templateId) {
      const template = await prisma.template.findFirst({
        where: { id: body.templateId, userId: user.id },
        select: { id: true },
      });
      if (!template) throw new HttpError(400, "That template no longer exists.");
      templateId = template.id;
    }

    const baseData = {
      name,
      subject: content.subject,
      html: content.html,
      design: content.design,
      editorMode: content.editorMode,
      templateId,
    };

    // Draft: allow the data source, mapping, profile and rate to change, which
    // means regenerating the recipient list.
    if (campaign.status === "draft") {
      const sourceId = body.sourceId
        ? requireId(body.sourceId, "sourceId")
        : campaign.sourceId;
      if (!sourceId) {
        throw new HttpError(400, "This campaign has no data source — import one.");
      }
      const source = await prisma.source.findFirst({
        where: { id: sourceId, userId: user.id },
      });
      if (!source) {
        throw new HttpError(400, "That data source has expired — re-import the sheet or file.");
      }

      const profileId = body.smtpProfileId
        ? requireId(body.smtpProfileId, "smtpProfileId")
        : campaign.smtpProfileId;
      const profile = profileId
        ? await prisma.smtpProfile.findFirst({
            where: { id: profileId, userId: user.id },
          })
        : null;
      if (!profile) throw new HttpError(400, "Choose an SMTP profile.");

      const mapping = normalizeMapping(body.mapping, source.columns);
      const { rows } = parseCsv(source.csv);
      const recipients = buildRecipients(rows, mapping, {
        dedupe: body.dedupe !== false,
      });
      const sendable = recipients.filter((r) => r.status === "pending").length;
      if (sendable === 0) {
        throw new HttpError(
          400,
          `No valid email addresses found in the "${mapping.email}" column.`
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.recipient.deleteMany({ where: { campaignId: id } });
        await tx.campaign.update({
          where: { id },
          data: {
            ...baseData,
            sourceId: source.id,
            sourceLabel: source.fileName ?? source.url ?? "Imported data",
            columns: source.columns,
            smtpProfileId: profile.id,
            mapping: mapping as unknown as Prisma.InputJsonValue,
            rateLimit: clampRate(body.rateLimit, profile.rateLimit),
            error: null,
          },
        });
        for (let i = 0; i < recipients.length; i += INSERT_CHUNK) {
          await tx.recipient.createMany({
            data: recipients.slice(i, i + INSERT_CHUNK).map((r) => ({
              ...r,
              campaignId: id,
              row: r.row as unknown as Prisma.InputJsonValue,
            })),
          });
        }
      });
    } else {
      // Already sending/sent: only the copy is editable. Recipients stay put.
      await prisma.campaign.update({ where: { id }, data: baseData });
    }

    const updated = await prisma.campaign.findFirst({
      where: { id },
      include: { smtpProfile: { select: { name: true } } },
    });
    return {
      campaign: toCampaign(updated!, await recomputeStats(id), updated!.smtpProfile?.name),
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
