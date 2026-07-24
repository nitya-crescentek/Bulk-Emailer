import Link from "next/link";
import { PlusIcon, SendIcon } from "lucide-react";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/client";
import { collections } from "@/lib/mongodb";
import { toCampaign } from "@/lib/serialize";
import type { Campaign } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  let campaigns: Campaign[];
  try {
    const { campaigns: col, smtp } = await collections();
    const [docs, profiles] = await Promise.all([
      col.find().sort({ createdAt: -1 }).limit(100).toArray(),
      smtp.find().toArray(),
    ]);
    const names = new Map(profiles.map((p) => [p._id!.toString(), p.name]));
    campaigns = docs.map((doc) =>
      toCampaign(doc, names.get(doc.smtpProfileId.toString()))
    );
  } catch (err) {
    return (
      <>
        <PageHeader title="Campaigns" />
        <ConnectionError message={toErrorMessage(err)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Every run, with what was sent and what failed."
        actions={
          <Button asChild>
            <Link href="/campaigns/new">
              <PlusIcon />
              New campaign
            </Link>
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <SendIcon className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No campaigns yet</p>
              <p className="text-sm text-muted-foreground">
                Import a sheet and send your first batch of proposals.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/campaigns/new">
                <PlusIcon />
                New campaign
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((campaign) => {
            const { total, sent, failed } = campaign.stats;
            const done = total ? Math.round((sent / total) * 100) : 0;
            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="rounded-lg border px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{campaign.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {campaign.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(campaign.createdAt)}</span>
                    <StatusBadge status={campaign.status} />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={done} className="h-1.5 flex-1" />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {sent}/{total} sent
                    {failed ? ` · ${failed} failed` : ""}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
