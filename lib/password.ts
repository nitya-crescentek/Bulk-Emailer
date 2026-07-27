import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/**
 * Hashes a password with scrypt (built into Node — no native dependency).
 * Format: `scrypt$<saltHex>$<hashHex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length
  )) as Buffer;

  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

/** Basic strength gate for registration. */
export function passwordProblem(password: string): string | undefined {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 200) return "Password is too long.";
  return undefined;
}
