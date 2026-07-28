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
import type { CampaignStats } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSERT_CHUNK = 1000;

export async function GET() {
  return handle(async () => {
    const user = await requireApiUser();
    const rows = await prisma.campaign.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { smtpProfile: { select: { name: true } } },
    });

    // One grouped query for every campaign's counters instead of N.
    const statsById = await statsFor(rows.map((c) => c.id));

    return {
      campaigns: rows.map((c) =>
        toCampaign(c, statsById.get(c.id) ?? EMPTY_STATS, c.smtpProfile?.name)
      ),
    };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const body = await request.json();

    const source = await prisma.source.findFirst({
      where: { id: requireId(body.sourceId, "sourceId"), userId: user.id },
    });
    if (!source) {
      throw new HttpError(400, "That data source has expired — re-import the sheet or file.");
    }

    const profile = await prisma.smtpProfile.findFirst({
      where: { id: requireId(body.smtpProfileId, "smtpProfileId"), userId: user.id },
    });
    if (!profile) throw new HttpError(400, "Choose an SMTP profile.");

    let templateId: string | null = null;
    if (body.templateId) {
      const template = await prisma.template.findFirst({
        where: { id: body.templateId, userId: user.id },
        select: { id: true },
      });
      if (!template) throw new HttpError(400, "That template no longer exists.");
      templateId = template.id;
    }

    const mapping = normalizeMapping(body.mapping, source.columns);
    const { rows } = parseCsv(source.csv);
    const recipients = buildRecipients(rows, mapping, { dedupe: body.dedupe !== false });

    const sendable = recipients.filter((r) => r.status === "pending").length;
    if (sendable === 0) {
      throw new HttpError(
        400,
        `No valid email addresses found in the "${mapping.email}" column.`
      );
    }

    const content = readCampaignContent(body);

    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        name: requireString(body.name, "Campaign name", { max: 160 }),
        status: "draft",
        sourceId: source.id,
        sourceLabel: source.fileName ?? source.url ?? "Imported data",
        columns: source.columns,
        smtpProfileId: profile.id,
        templateId,
        subject: content.subject,
        html: content.html,
        design: content.design,
        editorMode: content.editorMode,
        mapping: mapping as unknown as Prisma.InputJsonValue,
        rateLimit: clampRate(body.rateLimit, profile.rateLimit),
      },
    });

    for (let i = 0; i < recipients.length; i += INSERT_CHUNK) {
      await prisma.recipient.createMany({
        data: recipients.slice(i, i + INSERT_CHUNK).map((r) => ({
          ...r,
          campaignId: campaign.id,
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
    return { campaign: toCampaign(campaign, stats, profile.name) };
  });
}

const EMPTY_STATS: CampaignStats = {
  total: 0,
  sent: 0,
  failed: 0,
  pending: 0,
  skipped: 0,
};

/** Counters for many campaigns in a single grouped query. */
async function statsFor(ids: string[]): Promise<Map<string, CampaignStats>> {
  const map = new Map<string, CampaignStats>();
  if (ids.length === 0) return map;

  const grouped = await prisma.recipient.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: ids } },
    _count: { _all: true },
  });

  for (const g of grouped) {
    const stats = map.get(g.campaignId) ?? { ...EMPTY_STATS };
    const count = g._count._all;
    stats.total += count;
    if (g.status === "sending") stats.pending += count;
    else if (g.status in stats) stats[g.status as keyof CampaignStats] += count;
    map.set(g.campaignId, stats);
  }
  return map;
}
