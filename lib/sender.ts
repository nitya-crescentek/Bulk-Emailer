import { prisma } from "./db";
import { HttpError } from "./http";
import {
  describeMailError,
  fromAddress,
  isFatalMailError,
  transportForProfile,
} from "./mailer";
import { buildContext, htmlToText, render } from "./template";
import type { CampaignStats, Mapping, Row } from "./types";
import type { Campaign, SmtpProfile } from "@/generated/prisma/client";

interface Control {
  stop: boolean;
}

// Runners live in the Node process, so they survive between requests but not a
// restart. `finalize()` requeues anything a restart interrupted.
const globalForRunner = globalThis as unknown as {
  _campaignRunners?: Map<string, Control>;
};
const runners = (globalForRunner._campaignRunners ??= new Map<string, Control>());

export function isRunning(campaignId: string): boolean {
  return runners.has(campaignId);
}

export function requestStop(campaignId: string): boolean {
  const control = runners.get(campaignId);
  if (!control) return false;
  control.stop = true;
  return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function recomputeStats(campaignId: string): Promise<CampaignStats> {
  const grouped = await prisma.recipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });

  const stats: CampaignStats = { total: 0, sent: 0, failed: 0, pending: 0, skipped: 0 };
  for (const g of grouped) {
    const count = g._count._all;
    stats.total += count;
    // An interrupted claim ("sending") is still work to do.
    if (g.status === "sending") stats.pending += count;
    else if (g.status in stats) stats[g.status as keyof CampaignStats] += count;
  }
  return stats;
}

/**
 * Kicks off (or resumes) a campaign. Returns once the background loop is
 * scheduled — poll `GET /api/campaigns/:id` for progress.
 */
export async function startCampaign(campaignId: string): Promise<void> {
  if (runners.has(campaignId)) {
    throw new HttpError(409, "This campaign is already sending.");
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new HttpError(404, "Campaign not found.");

  if (!campaign.smtpProfileId) {
    throw new HttpError(400, "This campaign has no SMTP profile.");
  }
  const profile = await prisma.smtpProfile.findUnique({
    where: { id: campaign.smtpProfileId },
  });
  if (!profile) {
    throw new HttpError(400, "The SMTP profile for this campaign no longer exists.");
  }

  // Reclaim rows left in-flight by a restart or crash.
  await prisma.recipient.updateMany({
    where: { campaignId, status: "sending" },
    data: { status: "pending" },
  });

  const pending = await prisma.recipient.count({
    where: { campaignId, status: "pending" },
  });
  if (pending === 0) {
    throw new HttpError(400, "There is nothing left to send in this campaign.");
  }

  const control: Control = { stop: false };
  runners.set(campaignId, control);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "sending",
      startedAt: campaign.startedAt ?? new Date(),
      finishedAt: null,
      error: null,
    },
  });

  void run(campaign, profile, control)
    .catch(async (err) => {
      console.error("[sender] campaign crashed", err);
      await prisma.campaign
        .update({
          where: { id: campaignId },
          data: {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
            finishedAt: new Date(),
          },
        })
        .catch(() => {});
    })
    .finally(() => runners.delete(campaignId));
}

/** Atomically claims the next queued recipient (FOR UPDATE SKIP LOCKED). */
async function claimNext(campaignId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Recipient"
    SET status = 'sending', attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Recipient"
      WHERE "campaignId" = ${campaignId} AND status = 'pending'
      ORDER BY "index" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id;
  `;
  return rows[0]?.id ?? null;
}

async function run(
  campaign: Campaign,
  profile: SmtpProfile,
  control: Control
): Promise<void> {
  const campaignId = campaign.id;
  const mapping = campaign.mapping as unknown as Mapping;
  const transport = transportForProfile(profile);
  const from = fromAddress(profile);
  const gap = Math.round(60_000 / Math.max(1, campaign.rateLimit));

  let fatalError: string | undefined;

  try {
    await transport.verify();

    while (!control.stop) {
      const id = await claimNext(campaignId);
      if (!id) break;

      const recipient = await prisma.recipient.findUnique({ where: { id } });
      if (!recipient) continue;

      const context = buildContext(recipient.row as unknown as Row, mapping);
      const html = render(campaign.html, context, { escape: true });

      try {
        const info = await transport.sendMail({
          from,
          to: recipient.email,
          cc: recipient.cc || undefined,
          bcc: recipient.bcc || undefined,
          replyTo: profile.replyTo || undefined,
          subject: render(campaign.subject, context),
          html,
          text: htmlToText(html),
        });

        await prisma.recipient.update({
          where: { id },
          data: {
            status: "sent",
            sentAt: new Date(),
            messageId: info.messageId,
            error: null,
          },
        });
      } catch (err) {
        if (isFatalMailError(err)) {
          // Not this recipient's fault — put it back and stop the run.
          await prisma.recipient.update({
            where: { id },
            data: { status: "pending" },
          });
          fatalError = describeMailError(err);
          break;
        }
        await prisma.recipient.update({
          where: { id },
          data: { status: "failed", error: describeMailError(err) },
        });
      }

      if (gap > 0 && !control.stop) await sleep(gap);
    }
  } catch (err) {
    fatalError = describeMailError(err);
  } finally {
    transport.close();
  }

  await finalize(campaignId, control.stop, fatalError);
}

async function finalize(
  campaignId: string,
  stopped: boolean,
  fatalError?: string
): Promise<void> {
  await prisma.recipient.updateMany({
    where: { campaignId, status: "sending" },
    data: { status: "pending" },
  });

  const stats = await recomputeStats(campaignId);
  const status = fatalError
    ? "failed"
    : stopped || stats.pending > 0
      ? "paused"
      : "completed";

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status,
      error: fatalError ?? null,
      finishedAt:
        status === "completed" || status === "failed" ? new Date() : null,
    },
  });
}

/** Moves failed rows back into the queue so they can be retried. */
export async function requeueFailed(campaignId: string): Promise<number> {
  const result = await prisma.recipient.updateMany({
    where: { campaignId, status: "failed" },
    data: { status: "pending", error: null },
  });
  return result.count;
}
