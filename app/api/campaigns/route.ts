import { clampRate, handle, HttpError, requireId, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toCampaign } from "@/lib/serialize";
import { isEmail, parseCsv, splitAddresses } from "@/lib/source";
import type { CampaignStats, FieldBinding, Mapping, Row } from "@/lib/types";
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
        subject: requireString(body.subject, "Subject", { max: 500 }),
        html: requireString(body.html, "Email body", { max: 200_000 }),
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

function normalizeMapping(input: unknown, columns: string[]): Mapping {
  const raw = (input ?? {}) as Partial<Mapping>;
  const email = typeof raw.email === "string" ? raw.email : "";
  if (!email || !columns.includes(email)) {
    throw new HttpError(400, "Pick the column that holds the recipient email address.");
  }

  const variables: Record<string, FieldBinding> = {};
  for (const [name, binding] of Object.entries(raw.variables ?? {})) {
    const column =
      binding?.column && columns.includes(binding.column) ? binding.column : "";
    variables[name] = {
      column,
      fallback: typeof binding?.fallback === "string" ? binding.fallback : "",
    };
  }

  const optional = (value: unknown) =>
    typeof value === "string" && columns.includes(value) ? value : undefined;

  return { email, cc: optional(raw.cc), bcc: optional(raw.bcc), variables };
}

interface NewRecipient {
  index: number;
  email: string;
  row: Row;
  cc: string | null;
  bcc: string | null;
  status: string;
  attempts: number;
  error: string | null;
}

function buildRecipients(
  rows: Row[],
  mapping: Mapping,
  { dedupe }: { dedupe: boolean }
): NewRecipient[] {
  const seen = new Set<string>();

  return rows.map((row, i) => {
    const email = (row[mapping.email] ?? "").trim();
    const key = email.toLowerCase();

    let status = "pending";
    let error: string | null = null;

    if (!email) {
      status = "skipped";
      error = "No email address in this row";
    } else if (!isEmail(email)) {
      status = "skipped";
      error = "Not a valid email address";
    } else if (dedupe && seen.has(key)) {
      status = "skipped";
      error = "Duplicate address — already included above";
    }

    if (status === "pending") seen.add(key);

    return {
      index: i + 1,
      email,
      row,
      cc: mapping.cc ? splitAddresses(row[mapping.cc]).join(", ") || null : null,
      bcc: mapping.bcc ? splitAddresses(row[mapping.bcc]).join(", ") || null : null,
      status,
      attempts: 0,
      error,
    };
  });
}
