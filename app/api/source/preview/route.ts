import { handle, HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import {
  columnEmailStats,
  fetchCsv,
  parseCsv,
  resolveSourceUrl,
} from "@/lib/source";
import type { SourceKind, SourcePreview } from "@/lib/types";

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
    const user = await requireApiUser();
    const contentType = request.headers.get("content-type") ?? "";

    let kind: SourceKind;
    let csv: string;
    let label: string;
    let url: string | null = null;
    let fetchUrl: string | null = null;
    let fileName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "No file was uploaded.");
      if (file.size === 0) throw new HttpError(400, "The uploaded file is empty.");
      if (file.size > MAX_BYTES) {
        throw new HttpError(400, "That file is larger than 15 MB.");
      }
      label = file.name || "upload.csv";
      fileName = label;
      kind = "csv-upload";
      csv = await file.text();
    } else {
      const body = await request.json();
      if (typeof body.url !== "string" || !body.url.trim()) {
        throw new HttpError(400, "Paste a Google Sheet or CSV link.");
      }
      const resolved = resolveSourceUrl(body.url);
      label = resolved.label;
      kind = resolved.kind;
      url = body.url.trim();
      fetchUrl = resolved.fetchUrl;
      csv = await fetchCsv(resolved.fetchUrl);
    }

    const { columns, rows } = parseCsv(csv);
    if (rows.length === 0) {
      throw new HttpError(400, "The source has a header row but no data rows.");
    }

    const source = await prisma.source.create({
      data: {
        userId: user.id,
        kind,
        url,
        fetchUrl,
        fileName,
        csv,
        columns,
        rowCount: rows.length,
      },
    });

    return {
      sourceId: source.id,
      kind,
      label,
      columns,
      rows: rows.slice(0, PREVIEW_ROWS),
      rowCount: rows.length,
      emailStats: columnEmailStats(columns, rows),
    };
  });
}
