import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const SALT = "bulk-mailer.smtp.v1";

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "APP_SECRET is missing or too short (min 16 chars). SMTP passwords cannot be stored without it."
    );
  }
  cachedKey = scryptSync(secret, SALT, 32);
  return cachedKey;
}

/** Returns `iv:authTag:ciphertext`, all base64. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(":");
  if (!iv || !tag || !data) {
    throw new Error("Stored SMTP password is malformed.");
  }
  const decipher = createDecipheriv(
    ALGO,
    key(),
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
