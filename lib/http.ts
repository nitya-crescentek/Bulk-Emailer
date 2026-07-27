export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

export function unauthorized(message = "You need to sign in."): never {
  throw new HttpError(401, message);
}

export function notFound(message: string): never {
  throw new HttpError(404, message);
}

/** cuid ids are opaque strings; just reject blanks. */
export function requireId(value: string, label = "id"): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `Invalid ${label}.`);
  }
  return value;
}

/** Wraps a handler so thrown HttpErrors become JSON responses. */
export async function handle<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const data = await fn();
    return Response.json(data ?? { ok: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[api]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

/** Emails per minute, kept inside something an SMTP server will tolerate. */
export function clampRate(value: unknown, fallback = 30): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(600, Math.max(1, Math.round(n)));
}

export function requireString(
  value: unknown,
  label: string,
  { max = 20_000 }: { max?: number } = {}
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${label} is required.`);
  }
  if (value.length > max) {
    throw new HttpError(400, `${label} is too long (max ${max} characters).`);
  }
  return value.trim();
}
