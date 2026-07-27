import { encrypt } from "@/lib/crypto";
import { clampRate, handle, HttpError, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { toSmtpProfile } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireApiUser();
    const rows = await prisma.smtpProfile.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });
    return { profiles: rows.map(toSmtpProfile) };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const body = await request.json();

    const name = requireString(body.name, "Profile name", { max: 120 });
    const isDefault = Boolean(body.isDefault);

    if (isDefault) {
      await prisma.smtpProfile.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    try {
      const row = await prisma.smtpProfile.create({
        data: {
          userId: user.id,
          name,
          host: requireString(body.host, "SMTP host", { max: 255 }),
          port: Number(body.port) || 587,
          secure: Boolean(body.secure),
          username: requireString(body.user, "SMTP username", { max: 255 }),
          password: encrypt(requireString(body.password, "SMTP password", { max: 500 })),
          fromName: typeof body.fromName === "string" ? body.fromName.trim() : "",
          fromEmail: requireString(body.fromEmail, "From address", { max: 255 }),
          replyTo:
            typeof body.replyTo === "string" && body.replyTo.trim()
              ? body.replyTo.trim()
              : null,
          rateLimit: clampRate(body.rateLimit),
          isDefault,
        },
      });
      return { profile: toSmtpProfile(row) };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, `You already have a profile named "${name}".`);
      }
      throw err;
    }
  });
}

export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2002";
}
