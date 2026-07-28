import { handle } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toTemplate } from "@/lib/serialize";
import { readTemplateInput } from "@/lib/template-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireApiUser();
    const rows = await prisma.template.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    return { templates: rows.map(toTemplate) };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const input = readTemplateInput(await request.json());

    const row = await prisma.template.create({
      data: { userId: user.id, ...input },
    });
    return { template: toTemplate(row) };
  });
}
