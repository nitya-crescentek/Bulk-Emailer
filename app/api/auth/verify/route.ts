import { handle, HttpError, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { consumeOtp } from "@/lib/otp";
import { createSession, toPublicUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirms the email OTP, marks the account verified, and signs the user in. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const email = requireString(body.email, "Email", { max: 320 }).toLowerCase();
    const code = requireString(body.code, "Verification code", { max: 12 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(404, "No account found for that email.");

    if (!user.emailVerifiedAt) {
      await consumeOtp(user.id, "EMAIL_VERIFICATION", code);
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    await createSession(user.id);
    return { ok: true, user: toPublicUser(user) };
  });
}
