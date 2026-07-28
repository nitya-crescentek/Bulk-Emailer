import { prisma } from "./db";
import { renderDesign } from "./email-design";
import { DEFAULT_TEMPLATE_PRESETS } from "./default-template-presets";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Seeds the built-in templates for a user. Skips any whose name already exists,
 * so it is safe to call more than once and won't recreate ones a user renamed
 * or deleted (as long as the original names are gone).
 */
export async function seedDefaultTemplates(userId: string): Promise<number> {
  const existing = await prisma.template.findMany({
    where: { userId, name: { in: DEFAULT_TEMPLATE_PRESETS.map((p) => p.name) } },
    select: { name: true },
  });
  const have = new Set(existing.map((t) => t.name));
  const toCreate = DEFAULT_TEMPLATE_PRESETS.filter((p) => !have.has(p.name));
  if (toCreate.length === 0) return 0;

  await prisma.template.createMany({
    data: toCreate.map((p) => ({
      userId,
      name: p.name,
      subject: p.subject,
      html: renderDesign(p.design),
      design: p.design as unknown as Prisma.InputJsonValue,
      editorMode: "visual",
    })),
  });
  return toCreate.length;
}
