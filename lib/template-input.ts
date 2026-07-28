import { HttpError, requireString } from "./http";
import { isEmailDesign, renderDesign, type EmailDesign } from "./email-design";
import { Prisma } from "@/generated/prisma/client";

export interface TemplateWrite {
  name: string;
  subject: string;
  html: string;
  // `Prisma.JsonNull` writes SQL NULL to the nullable Json column.
  design: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  editorMode: string;
}

/**
 * Validates a template payload from the client. In visual mode the HTML is
 * re-rendered from the design on the server, so the stored HTML always matches
 * the structured design and can't be tampered with independently.
 */
export function readTemplateInput(body: {
  name?: unknown;
  subject?: unknown;
  html?: unknown;
  design?: unknown;
  editorMode?: unknown;
}): TemplateWrite {
  const name = requireString(body.name, "Template name", { max: 160 });
  const subject = requireString(body.subject, "Subject", { max: 500 });
  const editorMode = body.editorMode === "html" ? "html" : "visual";

  if (editorMode === "visual") {
    if (!isEmailDesign(body.design)) {
      throw new HttpError(400, "The template design is missing or invalid.");
    }
    const design = body.design as EmailDesign;
    const html = renderDesign(design);
    if (html.length > 500_000) {
      throw new HttpError(400, "This design is too large.");
    }
    return {
      name,
      subject,
      html,
      design: design as unknown as Prisma.InputJsonValue,
      editorMode,
    };
  }

  // Raw HTML mode.
  return {
    name,
    subject,
    html: requireString(body.html, "Email body", { max: 200_000 }),
    design: Prisma.JsonNull,
    editorMode,
  };
}
