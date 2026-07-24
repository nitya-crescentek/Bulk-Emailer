import { PageHeader } from "@/components/page-header";
import { TemplateEditor } from "@/components/templates/template-editor";

export default function NewTemplatePage() {
  return (
    <>
      <PageHeader
        title="New template"
        description="Save a subject and body you can reuse across campaigns."
      />
      <TemplateEditor />
    </>
  );
}
