import { createHash } from "node:crypto";
import { prisma } from "./db";
import { HttpError } from "./http";

/**
 * Fixed-window attempt counters, kept in Postgres so they hold across restarts
 * and across more than one app instance.
 */
export interface Limit {
  /** Namespaces the bucket, e.g. "login:ip". */
  name: string;
  max: number;
  windowSeconds: number;
}

const FIFTEEN_MINUTES = 15 * 60;
const HOUR = 60 * 60;

// Every attempt from an address counts; roomy enough for a shared office IP.
export const LOGIN_PER_IP: Limit = { name: "login:ip", max: 30, windowSeconds: FIFTEEN_MINUTES };
// Effectively failures only: a successful sign-in clears it.
export const LOGIN_PER_EMAIL: Limit = { name: "login:email", max: 10, windowSeconds: FIFTEEN_MINUTES };
export const REGISTER_PER_IP: Limit = { name: "register:ip", max: 10, windowSeconds: HOUR };
// Each registration emails a code; this caps it beyond the 60s OTP cooldown.
export const REGISTER_PER_EMAIL: Limit = { name: "register:email", max: 5, windowSeconds: HOUR };

function bucketKey(limit: Limit, id: string): string {
  return createHash("sha256").update(`${limit.name}:${id}`).digest("hex");
}

/**
 * Records one attempt and throws a 429 (with Retry-After) once more than
 * `limit.max` land in the current window. Call it before the work it guards,
 * so a burst of parallel requests can't all pass a check-then-increment.
 */
export async function hitLimit(limit: Limit, id: string, message: string): Promise<void> {
  // One atomic statement: start a fresh window if the old one has lapsed,
  // otherwise bump the count. Uses the database clock throughout.
  const [row] = await prisma.$queryRaw<{ count: number; retryAfter: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${bucketKey(limit, id)}, 1, now() + make_interval(secs => ${limit.windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= now()
                THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now()
                  THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", CEIL(EXTRACT(EPOCH FROM "resetAt" - now()))::int AS "retryAfter"
  `;

  // Buckets for addresses that never come back would otherwise pile up.
  if (Math.random() < 0.01) {
    prisma.rateLimit
      .deleteMany({ where: { resetAt: { lt: new Date() } } })
      .catch(() => {});
  }

  if (row.count > limit.max) {
    const wait = Math.max(1, row.retryAfter);
    throw new HttpError(429, `${message} Try again in ${formatWait(wait)}.`, {
      "Retry-After": String(wait),
    });
  }
}

/** Forgets the attempts recorded for `id`, e.g. after a successful sign-in. */
export async function clearLimit(limit: Limit, id: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key: bucketKey(limit, id) } });
}

/**
 * The caller's address for per-IP limits. Next.js fills X-Forwarded-For from
 * the socket when nothing set it, and a reverse proxy appends the address it
 * saw, so the trustworthy entry is counted from the right — anything further
 * left came from the client. Set TRUSTED_PROXY_HOPS when more than one proxy
 * sits in front (e.g. Cloudflare → nginx = 2).
 *
 * With no proxy at all, a client can send its own X-Forwarded-For and Next.js
 * keeps it, so production should sit behind one. Per-email limits don't depend
 * on this.
 */
export function clientIp(request: Request): string {
  const hops = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS)) || 1);
  const chain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return chain[Math.max(0, chain.length - hops)] ?? "unknown";
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
