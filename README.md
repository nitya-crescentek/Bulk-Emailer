# Bulk Mailer

Send personalised bulk email from a Google Sheet or CSV. Point it at a data
source, map the columns into a template, give it SMTP credentials, and it sends
— tracking every recipient so you can pause, resume, and retry.

Built with Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui and
MongoDB.

## Setup

1. **Install and configure**

   ```bash
   npm install
   cp .env.example .env.local
   ```

   Fill in `.env.local`:

   | Variable      | Purpose                                                        |
   | ------------- | -------------------------------------------------------------- |
   | `MONGODB_URI` | Local (`mongodb://127.0.0.1:27017`) or an Atlas connection URI. |
   | `MONGODB_DB`  | Database name. Created on first write.                          |
   | `APP_SECRET`  | Encrypts SMTP passwords at rest. 16+ characters.                |

   Generate a secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   > Changing `APP_SECRET` later makes already-saved SMTP passwords unreadable —
   > you would have to re-enter them.

2. **Run it**

   ```bash
   npm run dev
   ```

3. **Add an SMTP profile** at `/smtp`, then hit **Test** to confirm the login
   works before you send anything real.

## How a send works

1. **Data source** — paste a Google Sheet link, paste a CSV link, or upload a
   CSV. The first row must be a header row; those column names become the
   placeholders you can use.

   Google Sheets must be shared as **Anyone with the link — Viewer**. The tab in
   the link (its `gid`) is the one imported. "Publish to web" links work too.

2. **Email** — pick a saved template or write one. Anything in
   `{{Double Braces}}` is a placeholder.

3. **Mapping** — choose the column holding the recipient address (with a live
   count of valid / duplicate / invalid / blank addresses), then bind each
   placeholder to a column. Each binding can have a fallback for blank cells.
   The preview renders real rows from your sheet.

4. **Send** — name the run, choose the SMTP profile and a rate limit, and
   create it. Nothing goes out until you press **Start sending** on the campaign
   page.

The campaign page shows live progress, a per-recipient log with the SMTP message
id or the exact failure, a **Send test** box, **Pause** / **Resume**, and
**Retry failed**.

## Behaviour worth knowing

- **Nothing sends automatically.** Creating a campaign only queues it.
- **Snapshots.** A campaign copies the subject and body at creation time, so
  editing the template afterwards never changes a run that is in flight.
- **Duplicates and bad addresses** are marked `skipped` with a reason rather
  than dropped silently.
- **Values are HTML-escaped** when substituted into the body, so a stray `<` in
  a spreadsheet cell cannot break the markup. Subject lines are plain text.
- **A plain-text alternative** is generated from the HTML for every message.
- **Rate limiting** is one email every `60 / rate` seconds. Gmail and Workspace
  throttle above roughly 30/minute.
- **Auth or connection failures** stop the whole run and mark the campaign
  `failed`; the current row goes back in the queue rather than being burned.
  Per-recipient rejections only fail that row.
- **Sending runs in the Node process.** Restarting the server pauses a run;
  anything interrupted is put back in the queue, and **Resume** picks it up.
  That means this is designed for a long-lived server (local machine, VPS,
  container) rather than short-lived serverless functions.

## Layout

```
app/
  api/                 route handlers (smtp, templates, source, campaigns)
  campaigns/           list, wizard (/new), detail (/[id])
  templates/           list, editor
  smtp/                SMTP profiles
components/
  campaigns/           wizard steps, detail view, recipient table
  smtp/, templates/    feature UI
  ui/                  shadcn components
lib/
  mongodb.ts           connection + collection helpers
  crypto.ts            AES-256-GCM for SMTP passwords
  source.ts            sheet/CSV resolution and parsing
  template.ts          {{placeholder}} extraction, binding and rendering
  mailer.ts            nodemailer transport + error translation
  sender.ts            the background send loop
```

## Collections

| Collection      | Holds                                                       |
| --------------- | ----------------------------------------------------------- |
| `smtp_profiles` | Server details; password encrypted with `APP_SECRET`.       |
| `templates`     | Reusable subject + HTML body.                               |
| `sources`       | Raw CSV text of each import, so campaigns can be rebuilt.   |
| `campaigns`     | Run config, snapshotted copy, mapping, status and counters. |
| `recipients`    | One row per email with status, error and SMTP message id.   |

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm start       # serve the build
npm run lint    # eslint
```
