import { handle, HttpError, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { issueOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/system-mailer";
import { isEmail } from "@/lib/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Emails a password-reset code. Unknown addresses get the same `{ ok: true }`
 * so the form doesn't say whether an account exists.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const email = requireString(body.email, "Email", { max: 320 }).toLowerCase();
    if (!isEmail(email)) throw new HttpError(400, "Enter a valid email address.");

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const code = await issueOtp(user.id, "PASSWORD_RESET");
      await sendOtpEmail(user.email, user.name, code, "PASSWORD_RESET");
    }

    return { ok: true };
  });
}
