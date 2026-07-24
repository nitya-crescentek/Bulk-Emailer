"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SaveIcon, Trash2Icon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/client";
import { extractVariables, render, STARTER_TEMPLATE } from "@/lib/template";
import type { Template } from "@/lib/types";

export function TemplateEditor({ template }: { template?: Template }) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(
    template?.subject ?? "A quick proposal for {{Company}}"
  );
  const [html, setHtml] = useState(template?.html ?? STARTER_TEMPLATE);
  const [saving, setSaving] = useState(false);

  const variables = useMemo(
    () => extractVariables(subject, html),
    [subject, html]
  );

  // Preview substitutes each placeholder with its own name, highlighted.
  const previewHtml = useMemo(() => {
    const sample = Object.fromEntries(
      variables.map((v) => [v, `<mark>${v}</mark>`])
    );
    return render(html, sample);
  }, [html, variables]);

  const previewSubject = useMemo(
    () => render(subject, Object.fromEntries(variables.map((v) => [v, v]))),
    [subject, variables]
  );

  async function save() {
    setSaving(true);
    try {
      const body = JSON.stringify({ name, subject, html });
      const result = template
        ? await api<{ template: Template }>(`/api/templates/${template.id}`, {
            method: "PUT",
            body,
          })
        : await api<{ template: Template }>("/api/templates", {
            method: "POST",
            body,
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>
              Write <code>{"{{Column Name}}"}</code> wherever a value from your
              sheet should go. You will map each one to a column when you build
              the campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Template name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Website redesign proposal"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Subject line</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Body (HTML)
              </Label>
              <Textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                className="min-h-80 font-mono text-xs"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Placeholders found:
              </span>
              {variables.length === 0 ? (
                <span className="text-xs text-muted-foreground">none yet</span>
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

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            <SaveIcon />
            {saving ? "Saving…" : "Save template"}
          </Button>
          {template ? (
            <Button variant="destructive" onClick={remove}>
              <Trash2Icon />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription className="truncate">
            Subject: {previewSubject || "—"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailPreview html={previewHtml} className="h-[520px]" />
        </CardContent>
      </Card>
    </div>
  );
}
