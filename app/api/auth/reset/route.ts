import { handle, HttpError, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { consumeOtp } from "@/lib/otp";
import { hashPassword, passwordProblem } from "@/lib/password";
import { createSession, toPublicUser } from "@/lib/auth";
import { seedDefaultTemplates } from "@/lib/default-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sets a new password using an emailed reset code, signs out every existing
 * session, and signs the user in. `{ email, code, password }`
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const email = requireString(body.email, "Email", { max: 320 }).toLowerCase();
    const code = requireString(body.code, "Reset code", { max: 12 });
    const password = typeof body.password === "string" ? body.password : "";
    const problem = passwordProblem(password);
    if (problem) throw new HttpError(400, problem);

    const user = await prisma.user.findUnique({ where: { email } });
    // Same answer consumeOtp gives when no code exists, so this can't be used
    // to probe for accounts.
    if (!user) {
      throw new HttpError(400, "No verification code is pending. Request a new one.");
    }

    await consumeOtp(user.id, "PASSWORD_RESET", code);

    // The code proves the address is theirs, so it also verifies the email.
    const firstVerification = user.emailVerifiedAt === null;
    const [, updated] = await prisma.$transaction([
      // Anyone holding an old session (including whoever knew the old
      // password) is signed out.
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(password),
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      }),
    ]);

    if (firstVerification) {
      await seedDefaultTemplates(user.id).catch((err) =>
        console.error("[reset] seeding default templates failed", err)
      );
    }

    await createSession(user.id);
    return { ok: true, user: toPublicUser(updated) };
  });
}
