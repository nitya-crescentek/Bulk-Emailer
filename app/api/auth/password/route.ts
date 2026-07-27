import { handle, HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const body = await request.json();

    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const next = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!(await verifyPassword(current, user.passwordHash))) {
      throw new HttpError(400, "Your current password is incorrect.");
    }
    const problem = passwordProblem(next);
    if (problem) throw new HttpError(400, problem);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(next) },
    });

    return { ok: true };
  });
}
