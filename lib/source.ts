import Papa from "papaparse";
import { HttpError } from "./http";
import type { Row, SourceKind } from "./types";

export interface ResolvedSource {
  kind: SourceKind;
  fetchUrl: string;
  label: string;
}

const SHEET_ID = /\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/;

/**
 * Turns whatever the user pasted into something that returns CSV.
 *
 * Google Sheets links become the `export?format=csv` endpoint for the tab that
 * was open (`gid`). The sheet must be shared as "anyone with the link can
 * view", otherwise Google answers with an HTML sign-in page.
 */
export function resolveSourceUrl(raw: string): ResolvedSource {
  const input = raw.trim();
  if (!/^https?:\/\//i.test(input)) {
    throw new HttpError(400, "Enter a full URL starting with http:// or https://");
  }

  const url = new URL(input);
  const isSheet = url.hostname === "docs.google.com" && SHEET_ID.test(url.pathname);

  if (!isSheet) {
    return { kind: "csv-url", fetchUrl: input, label: url.pathname.split("/").pop() || input };
  }

  // "Publish to web" links already serve CSV when asked to.
  if (url.pathname.includes("/pub")) {
    url.searchParams.set("output", "csv");
    return { kind: "google-sheet", fetchUrl: url.toString(), label: "Published Google Sheet" };
  }

  const id = url.pathname.match(SHEET_ID)![1];
  const gid =
    url.searchParams.get("gid") ??
    url.hash.match(/gid=(\d+)/)?.[1] ??
    "0";

  return {
    kind: "google-sheet",
    fetchUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,
    label: `Google Sheet (gid ${gid})`,
  };
}

export async function fetchCsv(fetchUrl: string): Promise<string> {
  const res = await fetch(fetchUrl, {
    redirect: "follow",
    cache: "no-store",
    headers: { "user-agent": "bulk-mailer" },
  });

  if (!res.ok) {
    throw new HttpError(
      400,
      `Could not read the source (HTTP ${res.status}). If this is a Google Sheet, share it as "Anyone with the link — Viewer".`
    );
  }

  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html") || /^\s*<(!doctype|html)/i.test(text)) {
    throw new HttpError(
      400,
      'The URL returned a web page instead of CSV. For Google Sheets, set sharing to "Anyone with the link — Viewer".'
    );
  }
  return text;
}

export interface ParsedCsv {
  columns: string[];
  rows: Row[];
}

export function parseCsv(csv: string): ParsedCsv {
  const result = Papa.parse<Row>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const columns = (result.meta.fields ?? []).filter((c) => c && c.length > 0);
  if (columns.length === 0) {
    throw new HttpError(400, "No header row found. The first row must contain column names.");
  }

  const rows = result.data
    .map((row) => {
      const clean: Row = {};
      for (const col of columns) clean[col] = (row[col] ?? "").toString().trim();
      return clean;
    })
    .filter((row) => columns.some((col) => row[col] !== ""));

  return { columns, rows };
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

/** Splits "a@x.com, b@y.com" into validated addresses. */
export function splitAddresses(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map((v) => v.trim())
    .filter((v) => isEmail(v));
}
