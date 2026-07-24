import { handle, requireString } from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { toTemplate } from "@/lib/serialize";
import type { TemplateDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const { templates } = await collections();
    const docs = await templates.find().sort({ updatedAt: -1 }).toArray();
    return { templates: docs.map(toTemplate) };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const { templates } = await collections();
    const now = new Date();

    const doc: TemplateDoc = {
      name: requireString(body.name, "Template name", { max: 160 }),
      subject: requireString(body.subject, "Subject", { max: 500 }),
      html: requireString(body.html, "Email body", { max: 200_000 }),
      createdAt: now,
      updatedAt: now,
    };

    const { insertedId } = await templates.insertOne(doc);
    return { template: toTemplate({ ...doc, _id: insertedId }) };
  });
}
