import Link from "next/link";
import { FileTextIcon, PlusIcon } from "lucide-react";
import { ConnectionError, toErrorMessage } from "@/components/connection-error";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/client";
import { collections } from "@/lib/mongodb";
import { toTemplate } from "@/lib/serialize";
import { extractVariables } from "@/lib/template";
import type { Template } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let templates: Template[];
  try {
    const { templates: col } = await collections();
    const docs = await col.find().sort({ updatedAt: -1 }).toArray();
    templates = docs.map(toTemplate);
  } catch (err) {
    return (
      <>
        <PageHeader title="Templates" />
        <ConnectionError message={toErrorMessage(err)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable subject lines and email bodies with {{placeholders}}."
        actions={
          <Button asChild>
            <Link href="/templates/new">
              <PlusIcon />
              New template
            </Link>
          </Button>
        }
      />

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileTextIcon className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No templates yet</p>
              <p className="text-sm text-muted-foreground">
                Write one once and reuse it for every proposal run.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/templates/new">
                <PlusIcon />
                New template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((template) => {
            const variables = extractVariables(template.subject, template.html);
            return (
              <Link
                key={template.id}
                href={`/templates/${template.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="font-medium">{template.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {template.subject}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>
                    {variables.length} placeholder
                    {variables.length === 1 ? "" : "s"}
                  </p>
                  <p>Updated {formatDate(template.updatedAt)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
