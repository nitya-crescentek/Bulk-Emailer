import { handle, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toTemplate } from "@/lib/serialize";

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
    const body = await request.json();

    const row = await prisma.template.create({
      data: {
        userId: user.id,
        name: requireString(body.name, "Template name", { max: 160 }),
        subject: requireString(body.subject, "Subject", { max: 500 }),
        html: requireString(body.html, "Email body", { max: 200_000 }),
      },
    });
    return { template: toTemplate(row) };
  });
}
