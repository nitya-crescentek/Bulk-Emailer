import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { HttpError } from "./http";
import type { OtpPurpose } from "@/generated/prisma/enums";

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
// Don't let someone spam the mail server / user's inbox.
const RESEND_COOLDOWN_SECONDS = 60;

function secret(): string {
  const value = process.env.APP_SECRET;
  if (!value || value.length < 16) {
    throw new Error("APP_SECRET is missing or too short (min 16 chars).");
  }
  return value;
}

function hashCode(code: string): string {
  return createHmac("sha256", secret()).update(code).digest("hex");
}

/**
 * Creates a fresh 6-digit code for the user, invalidating any earlier one for
 * the same purpose. Returns the plain code so the caller can email it.
 */
export async function issueOtp(
  userId: string,
  purpose: OtpPurpose
): Promise<string> {
  const recent = await prisma.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const age = (Date.now() - recent.createdAt.getTime()) / 1000;
    if (age < RESEND_COOLDOWN_SECONDS) {
      throw new HttpError(
        429,
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - age)}s before requesting another code.`
      );
    }
  }

  await prisma.otpCode.deleteMany({ where: { userId, purpose } });

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.otpCode.create({
    data: {
      userId,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
    },
  });
  return code;
}

/** Throws an HttpError with a human message on any failure; returns on success. */
export async function consumeOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string
): Promise<void> {
  const entry = await prisma.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!entry) {
    throw new HttpError(400, "No verification code is pending. Request a new one.");
  }
  if (entry.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.delete({ where: { id: entry.id } });
    throw new HttpError(400, "That code has expired. Request a new one.");
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.delete({ where: { id: entry.id } });
    throw new HttpError(429, "Too many wrong attempts. Request a new code.");
  }

  const given = hashCode((code ?? "").trim());
  const a = Buffer.from(given, "hex");
  const b = Buffer.from(entry.codeHash, "hex");
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    await prisma.otpCode.update({
      where: { id: entry.id },
      data: { attempts: { increment: 1 } },
    });
    const left = MAX_ATTEMPTS - entry.attempts - 1;
    throw new HttpError(
      400,
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Incorrect code. Request a new one."
    );
  }

  await prisma.otpCode.update({
    where: { id: entry.id },
    data: { consumedAt: new Date() },
  });
}

export const OTP_TTL_MINUTES = TTL_MINUTES;
