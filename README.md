# Bulk Mailer

A multi-user platform for sending personalised bulk email from a Google Sheet or
CSV. Register, map your sheet's columns into a template, add SMTP credentials,
and send — with every recipient tracked so you can pause, resume, and retry.

Built with Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui, and
PostgreSQL via Prisma. Each account's data is fully isolated.

## Setup

1. **Install and configure**

   ```bash
   npm install            # also runs `prisma generate`
   cp .env.example .env.local
   ```

   Fill in `.env.local`:

   | Variable            | Purpose                                                                 |
   | ------------------- | ----------------------------------------------------------------------- |
   | `DATABASE_URL`      | Postgres the app uses. Supabase: the **pooled** URL (port 6543).        |
   | `DIRECT_URL`        | Direct connection for migrations. Supabase: port 5432.                  |
   | `APP_SECRET`        | Encrypts SMTP passwords and signs OTP codes. 16+ chars.                 |
   | `SYSTEM_SMTP_*`     | The platform mailbox (e.g. smtp2go) that sends OTP verification emails. |

   > If a password in a connection URL contains `@ : / ? #`, percent-encode it
   > (`@` → `%40`). This is a common cause of "invalid connection string".
   >
   > `SYSTEM_SMTP_*` is separate from the SMTP profiles users add for their
   > campaigns. If it's left unset, in development the OTP code is printed to the
   > server console instead of emailed.

2. **Create the schema**

   ```bash
   npm run db:deploy      # applies prisma/migrations to DATABASE_URL/DIRECT_URL
   ```

   A database only shows up in the Supabase UI once tables exist — this step
   creates them.

3. **Run it**

   ```bash
   npm run dev
   ```

   Open the app, **register**, and enter the code sent to your email.

## Accounts & auth

- **Register** with name, email, password → a 6-digit code is emailed via the
  system mailbox → **verify** to activate the account and sign in.
- Email must be verified before the app is usable; unverified sign-ins are
  redirected back to the verification screen with a fresh code.
- Sessions are opaque tokens stored hashed in the database and set as an
  httpOnly cookie. Passwords are hashed with scrypt; OTP codes are hashed too —
  neither is ever stored in the clear.
- `/account` covers profile, campaign defaults (timezone, default send rate),
  and password change.

## How a send works

1. **Data source** — paste a Google Sheet link, paste a CSV link, or upload a
   CSV. The first row must be a header row; those column names become the
   placeholders you can use. Google Sheets must be shared as **Anyone with the
   link — Viewer**.
2. **Email** — pick a saved template or write one. Anything in
   `{{Double Braces}}` is a placeholder.
3. **Mapping** — choose the recipient-address column (with a live count of
   valid / duplicate / invalid / blank addresses) and bind each placeholder to a
   column, with an optional fallback for blank cells. The preview renders real
   rows.
4. **Send** — name the run, choose the SMTP profile and rate limit, create it.
   Nothing goes out until you press **Start sending**.

The campaign page shows live progress, a per-recipient log, a **Send test** box,
and **Pause** / **Resume** / **Retry failed**.

## Behaviour worth knowing

- **Nothing sends automatically.** Creating a campaign only queues it.
- **Snapshots.** A campaign copies the subject and body at creation time, so
  editing a template later never changes a run already created.
- **Duplicates and bad addresses** are marked `skipped` with a reason.
- **Values are HTML-escaped** into the body; subject lines are plain text.
- **Rate limiting** is one email every `60 / rate` seconds.
- **Auth/connection SMTP failures** stop the whole run and mark it `failed`; the
  in-flight row is returned to the queue. Per-recipient rejections fail only
  that row.
- **Sending runs in the Node process** using a `FOR UPDATE SKIP LOCKED` queue,
  so it's safe to resume; a restart requeues anything interrupted. Designed for a
  long-lived server (local machine, VPS, container), not short-lived serverless.

## Data model (Prisma / PostgreSQL)

| Table          | Holds                                                            |
| -------------- | ---------------------------------------------------------------- |
| `User`         | Account, scrypt password hash, verification, profile & settings. |
| `Session`      | Hashed session tokens with expiry.                               |
| `OtpCode`      | Hashed email verification codes.                                 |
| `SmtpProfile`  | A user's SMTP servers; password encrypted with `APP_SECRET`.     |
| `Template`     | Reusable subject + HTML body.                                    |
| `Source`       | Raw CSV of each import, so campaigns can be rebuilt.             |
| `Campaign`     | Run config, snapshotted copy, mapping, status.                  |
| `Recipient`    | One row per email with status, error, and SMTP message id.       |

Everything except `Session`/`OtpCode`/`Recipient` carries a `userId`; recipients
belong to a campaign. Deleting a user cascades to all their data.

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm start           # serve the build
npm run lint        # eslint
npm run db:deploy   # apply migrations (production / first setup)
npm run db:migrate  # create + apply a new migration in development
npm run db:studio   # browse data in Prisma Studio
```
