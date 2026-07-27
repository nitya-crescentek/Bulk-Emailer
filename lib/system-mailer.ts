import nodemailer, { type Transporter } from "nodemailer";
import { describeMailError } from "./mailer";
import { OTP_TTL_MINUTES } from "./otp";

/**
 * The platform's own mailbox (e.g. smtp2go) used for account emails like OTP
 * codes. This is separate from the SMTP profiles users configure for their
 * campaigns.
 */
interface SystemSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function readConfig(): SystemSmtp | null {
  const host = process.env.SYSTEM_SMTP_HOST;
  const user = process.env.SYSTEM_SMTP_USER;
  const pass = process.env.SYSTEM_SMTP_PASS;
  const from = process.env.SYSTEM_SMTP_FROM;
  if (!host || !user || !pass || !from) return null;

  const port = Number(process.env.SYSTEM_SMTP_PORT) || 587;
  const secure =
    process.env.SYSTEM_SMTP_SECURE != null
      ? process.env.SYSTEM_SMTP_SECURE === "true"
      : port === 465;

  return { host, port, secure, user, pass, from };
}

let cached: Transporter | null = null;

function transport(config: SystemSmtp): Transporter {
  cached ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 15_000,
  });
  return cached;
}

export function isSystemMailConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Sends a verification code. If no system mailbox is configured, in
 * development the code is logged to the server console so the flow is testable;
 * in production a missing config is an error.
 */
export async function sendOtpEmail(
  to: string,
  name: string,
  code: string
): Promise<void> {
  const config = readConfig();

  if (!config) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "System SMTP is not configured. Set SYSTEM_SMTP_HOST/PORT/USER/PASS/FROM."
      );
    }
    console.info(
      `\n[system-mailer] No SYSTEM_SMTP_* configured — dev fallback.\n` +
        `  Verification code for ${to}: ${code}\n`
    );
    return;
  }

  const subject = `Your Bulk Mailer verification code: ${code}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111">
      <p>Hi ${escapeHtml(name || "there")},</p>
      <p>Your verification code is:</p>
      <p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
      <p>It expires in ${OTP_TTL_MINUTES} minutes. If you didn't request it, you can ignore this email.</p>
    </div>`;

  try {
    await transport(config).sendMail({
      from: config.from,
      to,
      subject,
      html,
      text: `Your Bulk Mailer verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    });
  } catch (err) {
    throw new Error(`Could not send the verification email. ${describeMailError(err)}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
