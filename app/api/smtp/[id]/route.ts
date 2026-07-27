import { encrypt } from "@/lib/crypto";
import {
  clampRate,
  handle,
  HttpError,
  requireId,
  requireString,
} from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toSmtpProfile } from "@/lib/serialize";
import { isUniqueViolation } from "../route";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, ctx: RouteContext<"/api/smtp/[id]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);
    const body = await request.json();

    // Scope the update to this user's own profile.
    const existing = await prisma.smtpProfile.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new HttpError(404, "SMTP profile not found.");

    const name = requireString(body.name, "Profile name", { max: 120 });
    const isDefault = Boolean(body.isDefault);

    const data: Prisma.SmtpProfileUpdateInput = {
      name,
      host: requireString(body.host, "SMTP host", { max: 255 }),
      port: Number(body.port) || 587,
      secure: Boolean(body.secure),
      username: requireString(body.user, "SMTP username", { max: 255 }),
      fromName: typeof body.fromName === "string" ? body.fromName.trim() : "",
      fromEmail: requireString(body.fromEmail, "From address", { max: 255 }),
      replyTo:
        typeof body.replyTo === "string" && body.replyTo.trim()
          ? body.replyTo.trim()
          : null,
      rateLimit: clampRate(body.rateLimit),
      isDefault,
    };
    // A blank password field means "keep the stored one".
    if (typeof body.password === "string" && body.password !== "") {
      data.password = encrypt(body.password);
    }

    if (isDefault) {
      await prisma.smtpProfile.updateMany({
        where: { userId: user.id, id: { not: id } },
        data: { isDefault: false },
      });
    }

    try {
      const row = await prisma.smtpProfile.update({ where: { id }, data });
      return { profile: toSmtpProfile(row) };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, `You already have a profile named "${name}".`);
      }
      throw err;
    }
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/smtp/[id]">
) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    requireId(id);

    const existing = await prisma.smtpProfile.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new HttpError(404, "SMTP profile not found.");

    const inUse = await prisma.campaign.count({
      where: { smtpProfileId: id, status: { in: ["sending", "paused"] } },
    });
    if (inUse > 0) {
      throw new HttpError(
        409,
        "This profile is used by a campaign that has not finished sending."
      );
    }

    await prisma.smtpProfile.delete({ where: { id } });
    return { ok: true };
  });
}
