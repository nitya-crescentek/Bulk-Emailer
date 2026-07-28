"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CodeIcon, PaintbrushIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { EmailBuilder } from "@/components/templates/email-builder";
import { EmailPreview } from "@/components/email-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client";
import { cn } from "@/lib/utils";
import {
  blankDesign,
  isEmailDesign,
  renderDesign,
  type EmailDesign,
} from "@/lib/email-design";
import { extractVariables, render } from "@/lib/template";
import type { EditorMode, Template } from "@/lib/types";

export function TemplateEditor({ template }: { template?: Template }) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(
    template?.subject ?? "A quick update from {{Company}}"
  );
  // A template is only "visual" if it actually carries a valid design — an
  // older HTML template (no design) must open in HTML mode so its markup is
  // never silently replaced by a blank builder.
  const hasDesign = !!template && isEmailDesign(template.design);
  const [mode, setMode] = useState<EditorMode>(
    template ? (hasDesign ? "visual" : "html") : "visual"
  );
  const [design, setDesign] = useState<EmailDesign>(
    hasDesign ? template!.design! : blankDesign()
  );
  const [htmlDraft, setHtmlDraft] = useState(template?.html ?? "");
  const [saving, setSaving] = useState(false);

  const currentHtml = mode === "visual" ? renderDesign(design) : htmlDraft;

  const variables = useMemo(
    () => extractVariables(subject, currentHtml),
    [subject, currentHtml]
  );

  // Preview substitutes each placeholder with its own name, highlighted.
  const previewHtml = useMemo(() => {
    const sample = Object.fromEntries(variables.map((v) => [v, `<mark>${v}</mark>`]));
    return render(currentHtml, sample);
  }, [currentHtml, variables]);

  function switchMode(next: EditorMode) {
    if (next === mode) return;
    // Entering HTML mode, seed the textarea from the current design.
    if (next === "html") setHtmlDraft(renderDesign(design));
    setMode(next);
  }

  async function save() {
    setSaving(true);
    try {
      const payload =
        mode === "visual"
          ? { name, subject, editorMode: "visual", design, html: renderDesign(design) }
          : { name, subject, editorMode: "html", html: htmlDraft, design: null };
      const result = template
        ? await api<{ template: Template }>(`/api/templates/${template.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await api<{ template: Template }>("/api/templates", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      toast.success("Template saved");
      router.push(`/templates/${result.template.id}`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!template) return;
    if (!confirm(`Delete the template "${template.name}"?`)) return;
    try {
      await api(`/api/templates/${template.id}`, { method: "DELETE" });
      toast.success("Template deleted");
      router.push("/templates");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Design the email visually, or switch to HTML for full control. Use{" "}
            <code>{"{{Column Name}}"}</code> anywhere a value from your sheet
            should go.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Template name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Monthly newsletter"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Subject line</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border p-0.5">
              <ModeButton active={mode === "visual"} onClick={() => switchMode("visual")}>
                <PaintbrushIcon />
                Visual
              </ModeButton>
              <ModeButton active={mode === "html"} onClick={() => switchMode("html")}>
                <CodeIcon />
                HTML
              </ModeButton>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {template ? (
                <Button variant="destructive" size="sm" onClick={remove}>
                  <Trash2Icon />
                  Delete
                </Button>
              ) : null}
              <Button size="sm" onClick={save} disabled={saving}>
                <SaveIcon />
                {saving ? "Saving…" : "Save template"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Placeholders:</span>
            {variables.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                none — every recipient gets identical copy
              </span>
            ) : (
              variables.map((v) => (
                <Badge key={v} variant="outline" className="font-mono">
                  {v}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {mode === "visual" ? (
        <Tabs defaultValue="build">
          <TabsList>
            <TabsTrigger value="build">Build</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="build" className="pt-4">
            <EmailBuilder design={design} onChange={setDesign} />
          </TabsContent>
          <TabsContent value="preview" className="pt-4">
            <EmailPreview html={previewHtml} className="h-[600px]" />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>HTML source</CardTitle>
              <CardDescription>
                Table-based markup with inline styles works best in email clients.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={htmlDraft}
                onChange={(e) => setHtmlDraft(e.target.value)}
                className="min-h-[520px] font-mono text-xs"
                spellCheck={false}
              />
            </CardContent>
          </Card>
          <Card className="lg:sticky lg:top-20 lg:self-start">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription className="truncate">Subject: {subject || "—"}</CardDescription>
            </CardHeader>
            <CardContent>
              <EmailPreview html={previewHtml} className="h-[520px]" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors [&_svg]:size-4",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
