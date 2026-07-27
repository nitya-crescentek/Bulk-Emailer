import { notFound } from "next/navigation";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toCampaign } from "@/lib/serialize";
import { recomputeStats } from "@/lib/sender";
import type { Campaign } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignPage(props: PageProps<"/campaigns/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;

  let campaign: Campaign | null;
  try {
    const doc = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      include: { smtpProfile: { select: { name: true } } },
    });
    campaign = doc
      ? toCampaign(doc, await recomputeStats(doc.id), doc.smtpProfile?.name)
      : null;
  } catch (err) {
    return (
      <>
        <PageHeader title="Campaign" />
        <ConnectionError message={toErrorMessage(err)} />
      </>
    );
  }

  if (!campaign) notFound();

  return (
    <>
      <PageHeader title={campaign.name} description={campaign.subject} />
      <CampaignDetail initial={campaign} />
    </>
  );
}
