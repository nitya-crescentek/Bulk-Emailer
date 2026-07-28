import { notFound } from "next/navigation";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toCampaign, toSmtpProfile, toTemplate } from "@/lib/serialize";
import { sourceToPreview } from "@/lib/campaign-build";
import { recomputeStats } from "@/lib/sender";
import type { Campaign, SmtpProfile, SourcePreview, Template } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage(
  props: PageProps<"/campaigns/[id]/edit">
) {
  const user = await requireUser();
  const { id } = await props.params;

  let campaign: Campaign | null;
  let profiles: SmtpProfile[];
  let templates: Template[];
  let sourcePreview: SourcePreview | null = null;

  try {
    const doc = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
    });
    if (!doc) notFound();

    const [smtpDocs, templateDocs, source] = await Promise.all([
      prisma.smtpProfile.findMany({
        where: { userId: user.id },
        orderBy: { name: "asc" },
      }),
      prisma.template.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
      }),
      doc.sourceId
        ? prisma.source.findFirst({ where: { id: doc.sourceId, userId: user.id } })
        : null,
    ]);

    campaign = toCampaign(doc, await recomputeStats(doc.id));
    profiles = smtpDocs.map(toSmtpProfile);
    templates = templateDocs.map(toTemplate);
    if (source) {
      try {
        sourcePreview = sourceToPreview(source);
      } catch {
        // A malformed stored CSV shouldn't block editing the copy.
        sourcePreview = null;
      }
    }
  } catch (err) {
    return (
      <>
        <PageHeader title="Edit campaign" />
        <ConnectionError message={toErrorMessage(err)} />
      </>
    );
  }

  const draft = campaign.status === "draft";
  return (
    <>
      <PageHeader
        title={`Edit ${campaign.name}`}
        description={
          draft
            ? "Change the data source, email, mapping, or send settings before you launch."
            : "This campaign has already run — you can update the email copy."
        }
      />
      <CampaignWizard
        profiles={profiles}
        templates={templates}
        campaign={campaign}
        sourcePreview={sourcePreview}
      />
    </>
  );
}
