/**
 * API/DTO shapes shared between server and client. Database row types come from
 * the generated Prisma client (`@/generated/prisma/client`); these are the
 * plain, JSON-safe shapes the browser sees.
 */

export type Row = Record<string, string>;

/* ---------------------------------------------------------------- SMTP --- */

/** Shape sent to the browser: password stripped. */
export interface SmtpProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  rateLimit: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------ Template --- */

export interface Template {
  id: string;
  name: string;
  subject: string;
  html: string;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------- Source --- */

export type SourceKind = "google-sheet" | "csv-url" | "csv-upload";

/** How usable each column would be as the recipient address column. */
export interface ColumnEmailStats {
  valid: number;
  invalid: number;
  blank: number;
  duplicates: number;
}

export interface SourcePreview {
  sourceId: string;
  kind: SourceKind;
  label: string;
  columns: string[];
  rows: Row[];
  rowCount: number;
  emailStats: Record<string, ColumnEmailStats>;
}

/* ------------------------------------------------------------- Mapping --- */

export interface FieldBinding {
  /** Source column name. Empty means "use the constant only". */
  column?: string;
  /** Used when the column is missing or blank for a row. */
  fallback?: string;
}

export interface Mapping {
  /** Column holding the recipient address — required. */
  email: string;
  /** Optional extra address columns. */
  cc?: string;
  bcc?: string;
  /** Template placeholder name -> where its value comes from. */
  variables: Record<string, FieldBinding>;
}

/* ------------------------------------------------------------ Campaign --- */

export type CampaignStatus =
  | "draft"
  | "sending"
  | "paused"
  | "completed"
  | "failed";

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  sourceLabel: string;
  columns: string[];
  smtpProfileId: string | null;
  smtpProfileName?: string;
  templateId?: string | null;
  subject: string;
  html: string;
  mapping: Mapping;
  rateLimit: number;
  stats: CampaignStats;
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

/* ----------------------------------------------------------- Recipient --- */

export type RecipientStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

export interface Recipient {
  id: string;
  index: number;
  email: string;
  row: Row;
  status: RecipientStatus;
  attempts: number;
  error?: string | null;
  messageId?: string | null;
  sentAt?: string | null;
}
