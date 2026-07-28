import { handle, HttpError, requireId } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toTemplate } from "@/lib/serialize";
import { readTemplateInput } from "@/lib/template-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/templates/[id]">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);
    const row = await prisma.template.findFirst({ where: { id, userId: user.id } });
    if (!row) throw new HttpError(404, "Template not found.");
    return { template: toTemplate(row) };
  });
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/templates/[id]">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);
    const body = await request.json();

    const existing = await prisma.template.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new HttpError(404, "Template not found.");

    const row = await prisma.template.update({
      where: { id },
      data: readTemplateInput(body),
    });
    return { template: toTemplate(row) };
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/templates/[id]">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);
    const result = await prisma.template.deleteMany({
      where: { id, userId: user.id },
    });
    if (result.count === 0) throw new HttpError(404, "Template not found.");
    return { ok: true };
  });
}
