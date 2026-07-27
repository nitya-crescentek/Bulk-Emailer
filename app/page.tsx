import Link from "next/link";
import {
  ArrowRightIcon,
  FileTextIcon,
  PlusIcon,
  SendIcon,
  ServerIcon,
} from "lucide-react";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toCampaign } from "@/lib/serialize";
import { formatDate } from "@/lib/client";
import type { CampaignStats } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMPTY: CampaignStats = { total: 0, sent: 0, failed: 0, pending: 0, skipped: 0 };

async function loadDashboard(userId: string) {
  const [recent, campaignCount, templateCount, smtpCount, sentAgg] =
    await Promise.all([
      prisma.campaign.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.campaign.count({ where: { userId } }),
      prisma.template.count({ where: { userId } }),
      prisma.smtpProfile.count({ where: { userId } }),
      prisma.recipient.count({
        where: { status: "sent", campaign: { userId } },
      }),
    ]);

  // Counters for the five recent campaigns in one grouped query.
  const grouped = await prisma.recipient.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: recent.map((c) => c.id) } },
    _count: { _all: true },
  });
  const statsById = new Map<string, CampaignStats>();
  for (const g of grouped) {
    const s = statsById.get(g.campaignId) ?? { ...EMPTY };
    const n = g._count._all;
    s.total += n;
    if (g.status === "sending") s.pending += n;
    else if (g.status in s) s[g.status as keyof CampaignStats] += n;
    statsById.set(g.campaignId, s);
  }

  return {
    recent: recent.map((c) => toCampaign(c, statsById.get(c.id) ?? EMPTY)),
    campaignCount,
    templateCount,
    smtpCount,
    totalSent: sentAgg,
  };
}

export default async function DashboardPage() {
  const user = await requireUser();
  let data: Awaited<ReturnType<typeof loadDashboard>>;
  try {
    data = await loadDashboard(user.id);
  } catch (err) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ConnectionError message={toErrorMessage(err)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Turn a Google Sheet or CSV into personalised email, without copy-pasting proposals one at a time."
        actions={
          <Button asChild>
            <Link href="/campaigns/new">
              <PlusIcon />
              New campaign
            </Link>
          </Button>
        }
      />

      {data.smtpCount === 0 ? (
        <Card className="mb-6 border-dashed">
          <CardHeader>
            <CardTitle>Finish setting up</CardTitle>
            <CardDescription>
              Add the SMTP server your mail will be sent through — everything
              else can be done inside a campaign.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/smtp">
                <ServerIcon />
                Add SMTP details
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Emails sent" value={data.totalSent} />
        <Stat label="Campaigns" value={data.campaignCount} />
        <Stat label="Templates" value={data.templateCount} />
        <Stat label="SMTP profiles" value={data.smtpCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent campaigns</CardTitle>
            <CardDescription>The last five runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No campaigns yet.
              </p>
            ) : (
              data.recent.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.stats.sent}/{campaign.stats.total} sent ·{" "}
                      {formatDate(campaign.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={campaign.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shortcuts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Shortcut href="/campaigns/new" icon={SendIcon} label="Start a campaign" />
            <Shortcut href="/templates" icon={FileTextIcon} label="Write a template" />
            <Shortcut href="/smtp" icon={ServerIcon} label="Manage SMTP profiles" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function Shortcut({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/60"
    >
      <Icon className="size-4 text-muted-foreground" />
      {label}
      <ArrowRightIcon className="ml-auto size-4 text-muted-foreground" />
    </Link>
  );
}
