import { encrypt } from "@/lib/crypto";
import { clampRate, handle, requireString } from "@/lib/http";
import { collections } from "@/lib/mongodb";
import { toSmtpProfile } from "@/lib/serialize";
import type { SmtpProfileDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const { smtp } = await collections();
    const docs = await smtp.find().sort({ name: 1 }).toArray();
    return { profiles: docs.map(toSmtpProfile) };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json();
    const { smtp } = await collections();

    const now = new Date();
    const doc: SmtpProfileDoc = {
      name: requireString(body.name, "Profile name", { max: 120 }),
      host: requireString(body.host, "SMTP host", { max: 255 }),
      port: Number(body.port) || 587,
      secure: Boolean(body.secure),
      user: requireString(body.user, "SMTP username", { max: 255 }),
      password: encrypt(requireString(body.password, "SMTP password", { max: 500 })),
      fromName: typeof body.fromName === "string" ? body.fromName.trim() : "",
      fromEmail: requireString(body.fromEmail, "From address", { max: 255 }),
      replyTo:
        typeof body.replyTo === "string" && body.replyTo.trim()
          ? body.replyTo.trim()
          : undefined,
      rateLimit: clampRate(body.rateLimit),
      isDefault: Boolean(body.isDefault),
      createdAt: now,
      updatedAt: now,
    };

    if (doc.isDefault) {
      await smtp.updateMany({}, { $set: { isDefault: false } });
    }

    const { insertedId } = await smtp.insertOne(doc);
    return { profile: toSmtpProfile({ ...doc, _id: insertedId }) };
  });
}
