import { handle, HttpError, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/password";
import { issueOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/system-mailer";
import { isEmail } from "@/lib/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();

    const email = requireString(body.email, "Email", { max: 320 }).toLowerCase();
    if (!isEmail(email)) throw new HttpError(400, "Enter a valid email address.");
    const name = requireString(body.name, "Name", { max: 120 });
    const password = typeof body.password === "string" ? body.password : "";
    const problem = passwordProblem(password);
    if (problem) throw new HttpError(400, problem);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.emailVerifiedAt) {
      throw new HttpError(409, "An account with this email already exists. Sign in instead.");
    }

    const passwordHash = await hashPassword(password);

    // Re-registering an unverified email just refreshes the pending account.
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name, passwordHash },
        })
      : await prisma.user.create({ data: { email, name, passwordHash } });

    const code = await issueOtp(user.id, "EMAIL_VERIFICATION");
    await sendOtpEmail(user.email, user.name, code);

    return { ok: true, needsVerification: true, email };
  });
}
