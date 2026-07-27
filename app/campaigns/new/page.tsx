import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toSmtpProfile, toTemplate } from "@/lib/serialize";
import type { SmtpProfile, Template } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const user = await requireUser();
  let profiles: SmtpProfile[];
  let templates: Template[];

  try {
    const [smtpDocs, templateDocs] = await Promise.all([
      prisma.smtpProfile.findMany({
        where: { userId: user.id },
        orderBy: { name: "asc" },
      }),
      prisma.template.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    profiles = smtpDocs.map(toSmtpProfile);
    templates = templateDocs.map(toTemplate);
  } catch (err) {
    return (
      <>
        <PageHeader title="New campaign" />
        <ConnectionError message={toErrorMessage(err)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="New campaign"
        description="Import your list, write the email, map the columns, and queue it up."
      />
      <CampaignWizard profiles={profiles} templates={templates} />
    </>
  );
}
