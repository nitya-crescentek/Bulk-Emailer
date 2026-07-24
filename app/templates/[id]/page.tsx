import { notFound } from "next/navigation";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { TemplateEditor } from "@/components/templates/template-editor";
import { collections } from "@/lib/mongodb";
import { toTemplate } from "@/lib/serialize";
import type { Template } from "@/lib/types";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage(
  props: PageProps<"/templates/[id]">
) {
  const { id } = await props.params;
  if (!ObjectId.isValid(id)) notFound();

  let template: Template | null;
  try {
    const { templates } = await collections();
    const doc = await templates.findOne({ _id: new ObjectId(id) });
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
