import type {
  Campaign,
  CampaignDoc,
  Recipient,
  RecipientDoc,
  SmtpProfile,
  SmtpProfileDoc,
  Template,
  TemplateDoc,
} from "./types";

export function toSmtpProfile(doc: SmtpProfileDoc): SmtpProfile {
  return {
    id: doc._id!.toString(),
    name: doc.name,
    host: doc.host,
    port: doc.port,
    secure: doc.secure,
    user: doc.user,
    fromName: doc.fromName,
    fromEmail: doc.fromEmail,
    replyTo: doc.replyTo,
    rateLimit: doc.rateLimit,
    isDefault: Boolean(doc.isDefault),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toTemplate(doc: TemplateDoc): Template {
  return {
    id: doc._id!.toString(),
    name: doc.name,
    subject: doc.subject,
    html: doc.html,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toCampaign(
  doc: CampaignDoc,
  smtpProfileName?: string
): Campaign {
  return {
    id: doc._id!.toString(),
    name: doc.name,
    status: doc.status,
    sourceLabel: doc.sourceLabel,
    columns: doc.columns,
    smtpProfileId: doc.smtpProfileId.toString(),
    smtpProfileName,
    templateId: doc.templateId?.toString(),
    subject: doc.subject,
    html: doc.html,
    mapping: doc.mapping,
    rateLimit: doc.rateLimit,
    stats: doc.stats,
    error: doc.error,
    createdAt: doc.createdAt.toISOString(),
    startedAt: doc.startedAt?.toISOString(),
    finishedAt: doc.finishedAt?.toISOString(),
  };
}

export function toRecipient(doc: RecipientDoc): Recipient {
  return {
    id: doc._id!.toString(),
    index: doc.index,
    email: doc.email,
    row: doc.row,
    status: doc.status,
    attempts: doc.attempts,
    error: doc.error,
    messageId: doc.messageId,
    sentAt: doc.sentAt?.toISOString(),
  };
}
