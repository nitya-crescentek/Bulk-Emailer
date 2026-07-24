import { handle, HttpError, requireString, toObjectId } from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { toTemplate } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/templates/[id]">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { templates } = await collections();
    const doc = await templates.findOne({ _id: toObjectId(id) });
    if (!doc) throw new HttpError(404, "Template not found.");
    return { template: toTemplate(doc) };
  });
}

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/templates/[id]">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await request.json();
    const { templates } = await collections();

    const doc = await templates.findOneAndUpdate(
      { _id: toObjectId(id) },
      {
        $set: {
          name: requireString(body.name, "Template name", { max: 160 }),
          subject: requireString(body.subject, "Subject", { max: 500 }),
          html: requireString(body.html, "Email body", { max: 200_000 }),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    if (!doc) throw new HttpError(404, "Template not found.");
    return { template: toTemplate(doc) };
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/templates/[id]">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { templates } = await collections();
    const result = await templates.deleteOne({ _id: toObjectId(id) });
    if (result.deletedCount === 0) throw new HttpError(404, "Template not found.");
    return { ok: true };
  });
}
