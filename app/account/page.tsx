import { AccountForm } from "@/components/account/account-form";
import { PageHeader } from "@/components/page-header";
import { requireUser, toPublicUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader
        title="Your account"
        description="Profile, campaign defaults, and password."
      />
      <AccountForm user={toPublicUser(user)} />
    </>
  );
}
