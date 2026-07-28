import type {
  Campaign as CampaignRow,
  Recipient as RecipientRow,
  SmtpProfile as SmtpProfileRow,
  Template as TemplateRow,
} from "@/generated/prisma/client";
import type {
  Campaign,
  CampaignStats,
  CampaignStatus,
  EditorMode,
  Mapping,
  Recipient,
  RecipientStatus,
  Row,
  SmtpProfile,
  Template,
} from "./types";
import type { EmailDesign } from "./email-design";

export function toSmtpProfile(row: SmtpProfileRow): SmtpProfile {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    secure: row.secure,
    user: row.username,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyTo: row.replyTo ?? undefined,
    rateLimit: row.rateLimit,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    html: row.html,
    design: (row.design as unknown as EmailDesign | null) ?? null,
    editorMode: (row.editorMode as EditorMode) ?? "visual",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCampaign(
  row: CampaignRow,
  stats: CampaignStats,
  smtpProfileName?: string
): Campaign {
  return {
    id: row.id,
    name: row.name,
    status: row.status as CampaignStatus,
    sourceLabel: row.sourceLabel,
    columns: row.columns,
    smtpProfileId: row.smtpProfileId,
    smtpProfileName,
    templateId: row.templateId,
    subject: row.subject,
    html: row.html,
    design: (row.design as unknown as EmailDesign | null) ?? null,
    editorMode: (row.editorMode as EditorMode) ?? "html",
    mapping: row.mapping as unknown as Mapping,
    rateLimit: row.rateLimit,
    stats,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export function toRecipient(row: RecipientRow): Recipient {
  return {
    id: row.id,
    index: row.index,
    email: row.email,
    row: row.row as unknown as Row,
    status: row.status as RecipientStatus,
    attempts: row.attempts,
    error: row.error,
    messageId: row.messageId,
    sentAt: row.sentAt?.toISOString() ?? null,
  };
}
