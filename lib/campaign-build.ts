import { HttpError, requireString } from "./http";
import { columnEmailStats, isEmail, parseCsv, splitAddresses } from "./source";
import { isEmailDesign, renderDesign, type EmailDesign } from "./email-design";
import { Prisma } from "@/generated/prisma/client";
import type {
  FieldBinding,
  Mapping,
  Row,
  SourcePreview,
} from "./types";

const PREVIEW_ROWS = 10;

/** Validated, ready-to-insert recipient row. */
export interface NewRecipient {
  index: number;
  email: string;
  row: Row;
  cc: string | null;
  bcc: string | null;
  status: string;
  attempts: number;
  error: string | null;
}

/**
 * Validates a mapping against the source's columns, dropping any column
 * reference that no longer exists.
 */
export function normalizeMapping(input: unknown, columns: string[]): Mapping {
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

/** Materializes recipient rows, flagging blanks, invalids, and duplicates. */
export function buildRecipients(
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

export interface CampaignContent {
  subject: string;
  html: string;
  // `Prisma.JsonNull` writes SQL NULL to the nullable Json column.
  design: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  editorMode: string;
}

/**
 * Validates the email copy for a campaign. In visual mode the HTML is
 * re-rendered from the design on the server, so the stored HTML always matches
 * the structured design and can't be tampered with independently. Mirrors
 * `readTemplateInput`, minus the template name.
 */
export function readCampaignContent(body: {
  subject?: unknown;
  html?: unknown;
  design?: unknown;
  editorMode?: unknown;
}): CampaignContent {
  const subject = requireString(body.subject, "Subject", { max: 500 });
  const editorMode = body.editorMode === "visual" ? "visual" : "html";

  if (editorMode === "visual") {
    if (!isEmailDesign(body.design)) {
      throw new HttpError(400, "The email design is missing or invalid.");
    }
    const design = body.design as EmailDesign;
    const html = renderDesign(design);
    if (html.length > 500_000) {
      throw new HttpError(400, "This design is too large.");
    }
    return {
      subject,
      html,
      design: design as unknown as Prisma.InputJsonValue,
      editorMode,
    };
  }

  return {
    subject,
    html: requireString(body.html, "Email body", { max: 200_000 }),
    design: Prisma.JsonNull,
    editorMode,
  };
}

/** Rebuilds a SourcePreview from a stored source so the editor can show it. */
export function sourceToPreview(source: {
  id: string;
  kind: string;
  fileName: string | null;
  url: string | null;
  csv: string;
}): SourcePreview {
  const { columns, rows } = parseCsv(source.csv);
  return {
    sourceId: source.id,
    kind: source.kind as SourcePreview["kind"],
    label: source.fileName ?? source.url ?? "Imported data",
    columns,
    rows: rows.slice(0, PREVIEW_ROWS),
    rowCount: rows.length,
    emailStats: columnEmailStats(columns, rows),
  };
}
