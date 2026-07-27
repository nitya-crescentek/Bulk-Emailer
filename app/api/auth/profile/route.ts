import { handle, clampRate, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser, toPublicUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const body = await request.json();

    const name = requireString(body.name, "Name", { max: 120 });
    const company =
      typeof body.company === "string" && body.company.trim()
        ? body.company.trim().slice(0, 160)
        : null;
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim().slice(0, 60)
        : "UTC";

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        company,
        timezone,
        defaultRate: clampRate(body.defaultRate, user.defaultRate),
      },
    });

    return { user: toPublicUser(updated) };
  });
}
