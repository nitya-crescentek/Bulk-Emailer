import { ObjectId } from "mongodb";
import { collections } from "./mongodb";
import { HttpError } from "./http";
import {
  describeMailError,
  fromAddress,
  isFatalMailError,
  transportForProfile,
} from "./mailer";
import { buildContext, htmlToText, render } from "./template";
import type { CampaignDoc, CampaignStats, SmtpProfileDoc } from "./types";

interface Control {
  stop: boolean;
}

// Runs live in the Node process, so they survive between requests but not
// between restarts. `finalize()` requeues anything a restart interrupted.
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

const EMPTY_STATS: CampaignStats = {
  total: 0,
  sent: 0,
  failed: 0,
  pending: 0,
  skipped: 0,
};

export async function recomputeStats(
  campaignId: ObjectId
): Promise<CampaignStats> {
  const { recipients } = await collections();
  const grouped = await recipients
    .aggregate<{ _id: string; count: number }>([
      { $match: { campaignId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray();

  const stats = { ...EMPTY_STATS };
  for (const { _id, count } of grouped) {
    stats.total += count;
    // An interrupted claim is still work to do.
    if (_id === "sending") stats.pending += count;
    else if (_id in stats) stats[_id as keyof CampaignStats] += count;
  }
  return stats;
}

/**
 * Kicks off (or resumes) a campaign. Returns as soon as the background loop is
 * scheduled — poll `GET /api/campaigns/:id` for progress.
 */
export async function startCampaign(campaignId: string): Promise<void> {
  if (runners.has(campaignId)) {
    throw new HttpError(409, "This campaign is already sending.");
  }

  const { campaigns, recipients, smtp } = await collections();
  const _id = new ObjectId(campaignId);
  const campaign = await campaigns.findOne({ _id });
  if (!campaign) throw new HttpError(404, "Campaign not found.");

  const profile = await smtp.findOne({ _id: campaign.smtpProfileId });
  if (!profile) {
    throw new HttpError(400, "The SMTP profile for this campaign no longer exists.");
  }

  // Reclaim rows left in-flight by a restart or crash.
  await recipients.updateMany(
    { campaignId: _id, status: "sending" },
    { $set: { status: "pending" } }
  );

  const pending = await recipients.countDocuments({
    campaignId: _id,
    status: "pending",
  });
  if (pending === 0) {
    throw new HttpError(400, "There is nothing left to send in this campaign.");
  }

  const control: Control = { stop: false };
  runners.set(campaignId, control);

  await campaigns.updateOne(
    { _id },
    {
      $set: { status: "sending", startedAt: campaign.startedAt ?? new Date() },
      $unset: { finishedAt: "", error: "" },
    }
  );

  void run(campaign, profile, control)
    .catch(async (err) => {
      console.error("[sender] campaign crashed", err);
      await campaigns.updateOne(
        { _id },
        {
          $set: {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
            finishedAt: new Date(),
          },
        }
      );
    })
    .finally(() => runners.delete(campaignId));
}

async function run(
  campaign: CampaignDoc,
  profile: SmtpProfileDoc,
  control: Control
): Promise<void> {
  const campaignId = campaign._id!;
  const { campaigns, recipients } = await collections();
  const transport = transportForProfile(profile);
  const from = fromAddress(profile);
  const gap = Math.round(60_000 / Math.max(1, campaign.rateLimit));

  let fatalError: string | undefined;

  try {
    await transport.verify();

    while (!control.stop) {
      const recipient = await recipients.findOneAndUpdate(
        { campaignId, status: "pending" },
        { $set: { status: "sending" }, $inc: { attempts: 1 } },
        { sort: { index: 1 }, returnDocument: "after" }
      );
      if (!recipient) break;

      const context = buildContext(recipient.row, campaign.mapping);
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

        await recipients.updateOne(
          { _id: recipient._id },
          {
            $set: {
              status: "sent",
              sentAt: new Date(),
              messageId: info.messageId,
            },
            $unset: { error: "" },
          }
        );
      } catch (err) {
        if (isFatalMailError(err)) {
          // Not this recipient's fault — put it back and stop the run.
          await recipients.updateOne(
            { _id: recipient._id },
            { $set: { status: "pending" } }
          );
          fatalError = describeMailError(err);
          break;
        }
        await recipients.updateOne(
          { _id: recipient._id },
          { $set: { status: "failed", error: describeMailError(err) } }
        );
      }

      // Keep the UI's counters moving without an aggregation per message.
      await campaigns.updateOne(
        { _id: campaignId },
        { $set: { stats: await recomputeStats(campaignId) } }
      );

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
  campaignId: ObjectId,
  stopped: boolean,
  fatalError?: string
): Promise<void> {
  const { campaigns, recipients } = await collections();
  await recipients.updateMany(
    { campaignId, status: "sending" },
    { $set: { status: "pending" } }
  );

  const stats = await recomputeStats(campaignId);
  const status = fatalError
    ? "failed"
    : stopped
      ? "paused"
      : stats.pending > 0
        ? "paused"
        : "completed";

  await campaigns.updateOne(
    { _id: campaignId },
    {
      $set: {
        stats,
        status,
        ...(fatalError ? { error: fatalError } : {}),
        ...(status === "completed" || status === "failed"
          ? { finishedAt: new Date() }
          : {}),
      },
      ...(fatalError ? {} : { $unset: { error: "" } }),
    }
  );
}

/** Moves failed rows back into the queue so they can be retried. */
export async function requeueFailed(campaignId: ObjectId): Promise<number> {
  const { campaigns, recipients } = await collections();
  const result = await recipients.updateMany(
    { campaignId, status: "failed" },
    { $set: { status: "pending" }, $unset: { error: "" } }
  );
  await campaigns.updateOne(
    { _id: campaignId },
    { $set: { stats: await recomputeStats(campaignId) } }
  );
  return result.modifiedCount;
}
