/**
 * One-off backfill: give every already-verified user the built-in templates
 * they'd now get at registration. Idempotent — skips any preset a user already
 * has by name. Run with:
 *   node --env-file=.env.local --experimental-strip-types scripts/backfill-default-templates.mts
 */
import pg from "pg";
import { randomBytes } from "node:crypto";
import { renderDesign } from "../lib/email-design.ts";
import { DEFAULT_TEMPLATE_PRESETS } from "../lib/default-template-presets.ts";

function cuidish() {
  return "c" + randomBytes(12).toString("hex");
}

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();

const presets = DEFAULT_TEMPLATE_PRESETS.map((p) => ({
  name: p.name,
  subject: p.subject,
  design: p.design,
  html: renderDesign(p.design),
}));
const users = await client.query(
  `SELECT id, email FROM "User" WHERE "emailVerifiedAt" IS NOT NULL`
);
console.log(`Verified users: ${users.rows.length}`);

let created = 0;
for (const user of users.rows) {
  const existing = await client.query(
    `SELECT name FROM "Template" WHERE "userId" = $1 AND name = ANY($2)`,
    [user.id, presets.map((p) => p.name)]
  );
  const have = new Set(existing.rows.map((r) => r.name));
  for (const p of presets) {
    if (have.has(p.name)) continue;
    await client.query(
      `INSERT INTO "Template" (id, "userId", name, subject, html, design, "editorMode", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,'visual',now(),now())`,
      [cuidish(), user.id, p.name, p.subject, p.html, JSON.stringify(p.design)]
    );
    created++;
    console.log(`  + "${p.name}" for ${user.email}`);
  }
}
console.log(`Done. Created ${created} template(s).`);
await client.end();
