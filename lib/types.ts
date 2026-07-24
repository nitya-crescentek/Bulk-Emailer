import type { ObjectId } from "mongodb";

export type Row = Record<string, string>;

/* ---------------------------------------------------------------- SMTP --- */

export interface SmtpProfileDoc {
  _id?: ObjectId;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  /** AES-256-GCM payload — never leaves the server. */
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  /** Emails per minute this server tolerates. */
  rateLimit: number;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface TemplateDoc {
  _id?: ObjectId;
  name: string;
  subject: string;
  html: string;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface SourceDoc {
  _id?: ObjectId;
  kind: SourceKind;
  /** Original URL as pasted by the user (sheet / csv link). */
  url?: string;
  /** Resolved URL actually fetched (sheet export endpoint). */
  fetchUrl?: string;
  fileName?: string;
  /** Raw CSV text, kept so a campaign can be rebuilt without re-uploading. */
  csv: string;
  columns: string[];
  rowCount: number;
  createdAt: Date;
}

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
  /** Optional extra address columns (comma separated values allowed). */
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

export interface CampaignDoc {
  _id?: ObjectId;
  name: string;
  status: CampaignStatus;
  sourceId: ObjectId;
  sourceLabel: string;
  columns: string[];
  smtpProfileId: ObjectId;
  templateId?: ObjectId;
  /** Snapshot — editing the template later never mutates a sent campaign. */
  subject: string;
  html: string;
  mapping: Mapping;
  /** Emails per minute. */
  rateLimit: number;
  stats: CampaignStats;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  sourceLabel: string;
  columns: string[];
  smtpProfileId: string;
  smtpProfileName?: string;
  templateId?: string;
  subject: string;
  html: string;
  mapping: Mapping;
  rateLimit: number;
  stats: CampaignStats;
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

/* ----------------------------------------------------------- Recipient --- */

export type RecipientStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

export interface RecipientDoc {
  _id?: ObjectId;
  campaignId: ObjectId;
  /** Position in the source file, 1-based, for stable ordering. */
  index: number;
  email: string;
  row: Row;
  cc?: string;
  bcc?: string;
  status: RecipientStatus;
  attempts: number;
  error?: string;
  messageId?: string;
  sentAt?: Date;
}

export interface Recipient {
  id: string;
  index: number;
  email: string;
  row: Row;
  status: RecipientStatus;
  attempts: number;
  error?: string;
  messageId?: string;
  sentAt?: string;
}
