import { encrypt } from "@/lib/crypto";
import {
  clampRate,
  handle,
  HttpError,
  requireString,
  toObjectId,
} from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { toSmtpProfile } from "@/lib/serialize";
import type { SmtpProfileDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/smtp/[id]">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const _id = toObjectId(id);
    const body = await request.json();
    const { smtp } = await collections();

    const update: Partial<SmtpProfileDoc> = {
      name: requireString(body.name, "Profile name", { max: 120 }),
      host: requireString(body.host, "SMTP host", { max: 255 }),
      port: Number(body.port) || 587,
      secure: Boolean(body.secure),
      user: requireString(body.user, "SMTP username", { max: 255 }),
      fromName: typeof body.fromName === "string" ? body.fromName.trim() : "",
      fromEmail: requireString(body.fromEmail, "From address", { max: 255 }),
      replyTo:
        typeof body.replyTo === "string" && body.replyTo.trim()
          ? body.replyTo.trim()
          : undefined,
      rateLimit: clampRate(body.rateLimit),
      isDefault: Boolean(body.isDefault),
      updatedAt: new Date(),
    };

    // A blank password field means "keep the stored one".
    if (typeof body.password === "string" && body.password !== "") {
      update.password = encrypt(body.password);
    }

    if (update.isDefault) {
      await smtp.updateMany({ _id: { $ne: _id } }, { $set: { isDefault: false } });
    }

    const doc = await smtp.findOneAndUpdate(
      { _id },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!doc) throw new HttpError(404, "SMTP profile not found.");
    return { profile: toSmtpProfile(doc) };
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/smtp/[id]">
) {
  return handle(async () => {
    const { id } = await ctx.params;
    const _id = toObjectId(id);
    const { smtp, campaigns } = await collections();

    const inUse = await campaigns.countDocuments({
      smtpProfileId: _id,
      status: { $in: ["sending", "paused"] },
    });
    if (inUse > 0) {
      throw new HttpError(
        409,
        "This profile is used by a campaign that has not finished sending."
      );
    }

    const result = await smtp.deleteOne({ _id });
    if (result.deletedCount === 0) {
      throw new HttpError(404, "SMTP profile not found.");
    }
    return { ok: true };
  });
}
