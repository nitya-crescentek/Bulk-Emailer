import { handle, HttpError } from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { fetchCsv, isEmail, parseCsv, resolveSourceUrl } from "@/lib/source";
import type {
  ColumnEmailStats,
  Row,
  SourceDoc,
  SourcePreview,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;
const PREVIEW_ROWS = 10;

/**
 * Reads a Google Sheet link, a CSV URL, or an uploaded CSV file and stores the
 * raw text so campaign creation can rebuild the full list without a re-upload.
 *
 * Accepts `multipart/form-data` with a `file`, or JSON `{ url }`.
 */
export async function POST(request: Request) {
  return handle(async (): Promise<SourcePreview> => {
    const contentType = request.headers.get("content-type") ?? "";
    let doc: Omit<SourceDoc, "_id" | "columns" | "rowCount" | "createdAt">;
    let label: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "No file was uploaded.");
      if (file.size === 0) throw new HttpError(400, "The uploaded file is empty.");
      if (file.size > MAX_BYTES) {
        throw new HttpError(400, "That file is larger than 15 MB.");
      }
      label = file.name || "upload.csv";
      doc = { kind: "csv-upload", fileName: label, csv: await file.text() };
    } else {
      const body = await request.json();
      if (typeof body.url !== "string" || !body.url.trim()) {
        throw new HttpError(400, "Paste a Google Sheet or CSV link.");
      }
      const resolved = resolveSourceUrl(body.url);
      label = resolved.label;
      doc = {
        kind: resolved.kind,
        url: body.url.trim(),
        fetchUrl: resolved.fetchUrl,
        csv: await fetchCsv(resolved.fetchUrl),
      };
    }

    const { columns, rows } = parseCsv(doc.csv);
    if (rows.length === 0) {
      throw new HttpError(400, "The source has a header row but no data rows.");
    }

    const { sources } = await collections();
    const { insertedId } = await sources.insertOne({
      ...doc,
      columns,
      rowCount: rows.length,
      createdAt: new Date(),
    });

    return {
      sourceId: insertedId.toString(),
      kind: doc.kind,
      label,
      columns,
      rows: rows.slice(0, PREVIEW_ROWS),
      rowCount: rows.length,
      emailStats: emailStats(columns, rows),
    };
  });
}

/** Per-column address quality, so the mapping step can show real numbers. */
function emailStats(
  columns: string[],
  rows: Row[]
): Record<string, ColumnEmailStats> {
  const stats: Record<string, ColumnEmailStats> = {};

  for (const column of columns) {
    const seen = new Set<string>();
    const counts: ColumnEmailStats = { valid: 0, invalid: 0, blank: 0, duplicates: 0 };

    for (const row of rows) {
      const value = (row[column] ?? "").trim();
      if (!value) counts.blank++;
      else if (!isEmail(value)) counts.invalid++;
      else if (seen.has(value.toLowerCase())) counts.duplicates++;
      else {
        counts.valid++;
        seen.add(value.toLowerCase());
      }
    }
    stats[column] = counts;
  }
  return stats;
}
