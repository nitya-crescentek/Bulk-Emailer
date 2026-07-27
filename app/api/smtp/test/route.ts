import { decrypt } from "@/lib/crypto";
import { handle, HttpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { createTransport, describeMailError, fromAddress } from "@/lib/mailer";
import { isEmail } from "@/lib/source";
import { htmlToText } from "@/lib/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies SMTP credentials, and optionally sends a one-off email. Accepts a
 * stored `profileId` (this user's) or inline credentials so the form can be
 * tested before it is saved.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const body = await request.json();
    const profile = await resolveProfile(user.id, body);

    const transport = createTransport({
      host: profile.host,
      port: profile.port,
      secure: profile.secure,
      user: profile.user,
      password: profile.password,
    });

    try {
      await transport.verify();

      const to = typeof body.to === "string" ? body.to.trim() : "";
      if (!to) return { ok: true, verified: true, sent: false };
      if (!isEmail(to)) throw new HttpError(400, `"${to}" is not a valid email address.`);

      const html =
        typeof body.html === "string" && body.html.trim()
          ? body.html
          : "<p>This is a test email from Bulk Mailer. Your SMTP settings work.</p>";

      const info = await transport.sendMail({
        from: fromAddress(profile),
        to,
        replyTo: profile.replyTo || undefined,
        subject:
          typeof body.subject === "string" && body.subject.trim()
            ? body.subject
            : "Bulk Mailer test email",
        html,
        text: htmlToText(html),
      });

      return { ok: true, verified: true, sent: true, messageId: info.messageId };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, describeMailError(err));
    } finally {
      transport.close();
    }
  });
}

interface ResolvedProfile {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
}

async function resolveProfile(
  userId: string,
  body: {
    profileId?: string;
    host?: string;
    port?: number | string;
    secure?: boolean;
    user?: string;
    password?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
  }
): Promise<ResolvedProfile> {
  if (body.profileId) {
    const row = await prisma.smtpProfile.findFirst({
      where: { id: body.profileId, userId },
    });
    if (!row) throw new HttpError(404, "SMTP profile not found.");
    return {
      host: row.host,
      port: row.port,
      secure: row.secure,
      user: row.username,
      password: decrypt(row.password),
      fromName: row.fromName,
      fromEmail: row.fromEmail,
      replyTo: row.replyTo ?? undefined,
    };
  }

  if (!body.host || !body.user || !body.fromEmail) {
    throw new HttpError(400, "Host, username and from address are required.");
  }
  const password = body.password ?? "";
  if (!password) throw new HttpError(400, "Enter the SMTP password to run a test.");

  return {
    host: body.host,
    port: Number(body.port) || 587,
    secure: Boolean(body.secure),
    user: body.user,
    password,
    fromName: body.fromName ?? "",
    fromEmail: body.fromEmail,
    replyTo: body.replyTo,
  };
}
