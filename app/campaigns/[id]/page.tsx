import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { collections } from "@/lib/mongodb";
import { toCampaign } from "@/lib/serialize";
import { recomputeStats } from "@/lib/sender";
import type { Campaign } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignPage(props: PageProps<"/campaigns/[id]">) {
  const { id } = await props.params;
  if (!ObjectId.isValid(id)) notFound();

  let campaign: Campaign | null;
  try {
    const _id = new ObjectId(id);
    const { campaigns, smtp } = await collections();
    const doc = await campaigns.findOne({ _id });
    if (doc) {
      const [profile, stats] = await Promise.all([
        smtp.findOne({ _id: doc.smtpProfileId }),
        recomputeStats(_id),
      ]);
      campaign = toCampaign({ ...doc, stats }, profile?.name);
    } else {
      campaign = null;
    }
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
