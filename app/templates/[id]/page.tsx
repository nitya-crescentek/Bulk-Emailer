import { notFound } from "next/navigation";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { TemplateEditor } from "@/components/templates/template-editor";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toTemplate } from "@/lib/serialize";
import type { Template } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage(
  props: PageProps<"/templates/[id]">
) {
  const user = await requireUser();
  const { id } = await props.params;

  let template: Template | null;
  try {
    const doc = await prisma.template.findFirst({
      where: { id, userId: user.id },
    });
    template = doc ? toTemplate(doc) : null;
  } catch (err) {
    return (
      <>
        <PageHeader title="Template" />
        <ConnectionError message={toErrorMessage(err)} />
      </>
    );
  }

  if (!template) notFound();

  return (
    <>
      <PageHeader
        title={template.name}
        description="Changes here do not affect campaigns that were already created — each campaign keeps its own snapshot."
      />
      <TemplateEditor template={template} />
    </>
  );
}
