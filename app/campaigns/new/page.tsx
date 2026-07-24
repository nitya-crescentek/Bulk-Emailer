import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { collections } from "@/lib/mongodb";
import { toSmtpProfile, toTemplate } from "@/lib/serialize";
import type { SmtpProfile, Template } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  let profiles: SmtpProfile[];
  let templates: Template[];

  try {
    const { smtp, templates: templateCol } = await collections();
    const [smtpDocs, templateDocs] = await Promise.all([
      smtp.find().sort({ name: 1 }).toArray(),
      templateCol.find().sort({ updatedAt: -1 }).toArray(),
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
