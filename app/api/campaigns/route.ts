import { ObjectId } from "mongodb";
import { clampRate, handle, HttpError, requireString, toObjectId } from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { toCampaign } from "@/lib/serialize";
import { isEmail, parseCsv, splitAddresses } from "@/lib/source";
import type {
  CampaignDoc,
  FieldBinding,
  Mapping,
  RecipientDoc,
  Row,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSERT_CHUNK = 1000;

export async function GET() {
  return handle(async () => {
    const { campaigns, smtp } = await collections();
    const docs = await campaigns.find().sort({ createdAt: -1 }).limit(100).toArray();
    const profiles = await smtp.find().toArray();
    const names = new Map(profiles.map((p) => [p._id!.toString(), p.name]));
    return {
      campaigns: docs.map((doc) =>
        toCampaign(doc, names.get(doc.smtpProfileId.toString()))
      ),
    };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const { campaigns, recipients, sources, smtp, templates } = await collections();

    const source = await sources.findOne({ _id: toObjectId(body.sourceId, "sourceId") });
    if (!source) {
      throw new HttpError(400, "That data source has expired — re-import the sheet or file.");
    }

    const profile = await smtp.findOne({
      _id: toObjectId(body.smtpProfileId, "smtpProfileId"),
    });
    if (!profile) throw new HttpError(400, "Choose an SMTP profile.");

    const mapping = normalizeMapping(body.mapping, source.columns);
    const { rows } = parseCsv(source.csv);

    const templateId = body.templateId
      ? toObjectId(body.templateId, "templateId")
      : undefined;
    if (templateId && !(await templates.countDocuments({ _id: templateId }))) {
      throw new HttpError(400, "That template no longer exists.");
    }

    const campaignId = new ObjectId();
    const docs = buildRecipients(rows, mapping, campaignId, {
      dedupe: body.dedupe !== false,
    });

    const sendable = docs.filter((d) => d.status === "pending").length;
    if (sendable === 0) {
      throw new HttpError(
        400,
        `No valid email addresses found in the "${mapping.email}" column.`
      );
    }

    const campaign: CampaignDoc = {
      _id: campaignId,
      name: requireString(body.name, "Campaign name", { max: 160 }),
      status: "draft",
      sourceId: source._id!,
      sourceLabel: source.fileName ?? source.url ?? "Imported data",
      columns: source.columns,
      smtpProfileId: profile._id!,
      templateId,
      subject: requireString(body.subject, "Subject", { max: 500 }),
      html: requireString(body.html, "Email body", { max: 200_000 }),
      mapping,
      rateLimit: clampRate(body.rateLimit, profile.rateLimit),
      stats: {
        total: docs.length,
        sent: 0,
        failed: 0,
        pending: sendable,
        skipped: docs.length - sendable,
      },
      createdAt: new Date(),
    };

    await campaigns.insertOne(campaign);
    for (let i = 0; i < docs.length; i += INSERT_CHUNK) {
      await recipients.insertMany(docs.slice(i, i + INSERT_CHUNK));
    }

    return { campaign: toCampaign(campaign, profile.name) };
  });
}

function normalizeMapping(input: unknown, columns: string[]): Mapping {
  const raw = (input ?? {}) as Partial<Mapping>;
  const email = typeof raw.email === "string" ? raw.email : "";
  if (!email || !columns.includes(email)) {
    throw new HttpError(400, "Pick the column that holds the recipient email address.");
  }

  const variables: Record<string, FieldBinding> = {};
  for (const [name, binding] of Object.entries(raw.variables ?? {})) {
    const column = binding?.column && columns.includes(binding.column) ? binding.column : "";
    variables[name] = {
      column,
      fallback: typeof binding?.fallback === "string" ? binding.fallback : "",
    };
  }

  const optional = (value: unknown) =>
    typeof value === "string" && columns.includes(value) ? value : undefined;

  return { email, cc: optional(raw.cc), bcc: optional(raw.bcc), variables };
}

function buildRecipients(
  rows: Row[],
  mapping: Mapping,
  campaignId: ObjectId,
  { dedupe }: { dedupe: boolean }
): RecipientDoc[] {
  const seen = new Set<string>();

  return rows.map((row, i) => {
    const email = (row[mapping.email] ?? "").trim();
    const key = email.toLowerCase();

    let status: RecipientDoc["status"] = "pending";
    let error: string | undefined;

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
      campaignId,
      index: i + 1,
      email,
      row,
      cc: mapping.cc ? splitAddresses(row[mapping.cc]).join(", ") : undefined,
      bcc: mapping.bcc ? splitAddresses(row[mapping.bcc]).join(", ") : undefined,
      status,
      attempts: 0,
      ...(error ? { error } : {}),
    };
  });
}
