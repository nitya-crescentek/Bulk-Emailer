import { handle, HttpError, requireString } from "@/lib/http";
import { prisma } from "@/lib/db";
import { issueOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/system-mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const email = requireString(body.email, "Email", { max: 320 }).toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    // Don't reveal whether an address is registered; only send if it makes sense.
    if (user && !user.emailVerifiedAt) {
      const code = await issueOtp(user.id, "EMAIL_VERIFICATION");
      await sendOtpEmail(user.email, user.name, code);
    } else if (user && user.emailVerifiedAt) {
      throw new HttpError(400, "This email is already verified. Try signing in.");
    }

    return { ok: true };
  });
}
