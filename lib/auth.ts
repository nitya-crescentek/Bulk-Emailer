import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { HttpError } from "./http";
import type { User } from "@/generated/prisma/client";

const COOKIE = "bm_session";
const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

/** What the browser is allowed to know about a user. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
  company: string | null;
  timezone: string;
  defaultRate: number;
  createdAt: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    company: user.company,
    timezone: user.timezone,
    defaultRate: user.defaultRate,
    createdAt: user.createdAt.toISOString(),
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a session and sets the cookie. Only call from a Route Handler or
 * Server Action — Server Components cannot write cookies.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const store = await cookies();
  const headerList = await headers();

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      userAgent: headerList.get("user-agent")?.slice(0, 400) ?? null,
      ip:
        headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        headerList.get("x-real-ip") ??
        null,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }
  store.delete(COOKIE);
}

/** Resolves the signed-in user, or null. Safe to call in Server Components. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

/**
 * For Server Components / pages: returns the user or redirects. Unverified
 * users are sent to the verification screen.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt === null) {
    redirect(`/verify?email=${encodeURIComponent(user.email)}`);
  }
  return user;
}

/** For Route Handlers: returns the user or throws a 401/403 HttpError. */
export async function requireApiUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "You need to sign in.");
  if (user.emailVerifiedAt === null) {
    throw new HttpError(403, "Verify your email address first.");
  }
  return user;
}

export const SESSION_COOKIE = COOKIE;
