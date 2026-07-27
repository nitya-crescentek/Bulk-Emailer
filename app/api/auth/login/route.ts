import { handle, HttpError, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, toPublicUser } from "@/lib/auth";
import { issueOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/system-mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const email = requireString(body.email, "Email", { max: 320 }).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    const user = await prisma.user.findUnique({ where: { email } });
    // Same error whether the email is unknown or the password is wrong.
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) {
      throw new HttpError(401, "Incorrect email or password.");
    }

    if (!user.emailVerifiedAt) {
      // Send a fresh code and route the client to verification.
      const code = await issueOtp(user.id, "EMAIL_VERIFICATION").catch(() => null);
      if (code) await sendOtpEmail(user.email, user.name, code);
      return { ok: true, needsVerification: true, email };
    }

    await createSession(user.id);
    return { ok: true, user: toPublicUser(user) };
  });
}
