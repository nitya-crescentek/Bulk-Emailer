import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { SmtpManager } from "@/components/smtp/smtp-manager";
import { collections } from "@/lib/mongodb";
import { toSmtpProfile } from "@/lib/serialize";
import type { SmtpProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SmtpPage() {
  let profiles: SmtpProfile[];
  try {
    const { smtp } = await collections();
    const docs = await smtp.find().sort({ name: 1 }).toArray();
    profiles = docs.map(toSmtpProfile);
  } catch (err) {
    return (
      <>
        <PageHeader title="SMTP" />
        <ConnectionError message={toErrorMessage(err)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="SMTP profiles"
        description="The mailboxes campaigns send through. Passwords are encrypted at rest and never sent back to the browser."
      />
      <SmtpManager initialProfiles={profiles} />
    </>
  );
}
