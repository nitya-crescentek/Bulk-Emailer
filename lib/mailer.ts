import nodemailer, { type Transporter } from "nodemailer";
import { decrypt } from "./crypto";
import type { SmtpProfileDoc } from "./types";

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export function createTransport(creds: SmtpCredentials): Transporter {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    // Implicit TLS on 465; STARTTLS upgrade everywhere else.
    secure: creds.secure,
    auth: { user: creds.user, pass: creds.password },
    pool: true,
    maxConnections: 1,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });
}

export function transportForProfile(profile: SmtpProfileDoc): Transporter {
  return createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.secure,
    user: profile.user,
    password: decrypt(profile.password),
  });
}

export function fromAddress(profile: {
  fromName?: string;
  fromEmail: string;
}): string {
  return profile.fromName
    ? `"${profile.fromName.replace(/"/g, "'")}" <${profile.fromEmail}>`
    : profile.fromEmail;
}

/** Turns nodemailer/SMTP failures into something worth showing a human. */
export function describeMailError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const code = e?.code;
  const message = e?.message ?? String(err);

  // A TLS handshake against a plaintext port, or the reverse — by far the most
  // common way an otherwise-correct profile fails, so name the actual fix.
  if (/wrong version number/i.test(message)) {
    return `The port is not expecting an SSL handshake. Turn OFF "Implicit TLS (SSL)" for ports 587, 25 and 2525 — those upgrade with STARTTLS — and turn it ON only for port 465. (${message})`;
  }
  if (/packet length too long|record layer failure|SSL routines/i.test(message)) {
    return `TLS negotiation failed — the "Implicit TLS (SSL)" setting probably does not match the port. Use it for 465 only; leave it off for 587 and 25. (${message})`;
  }

  switch (code) {
    case "EAUTH":
      return `Authentication failed — check the username and password. ${message}`;
    case "ECONNECTION":
    case "ESOCKET":
      return `Could not reach the SMTP server — check host, port and TLS settings. ${message}`;
    case "ETIMEDOUT":
      return `The SMTP server timed out. ${message}`;
    case "EENVELOPE":
      return `The server rejected the sender or recipient address. ${message}`;
    default:
      return message;
  }
}

/** Errors that mean "stop the whole run", not "skip this recipient". */
export function isFatalMailError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "EAUTH" || code === "ECONNECTION" || code === "ESOCKET";
}
