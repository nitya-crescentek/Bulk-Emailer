"use client";

import { useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailPreview } from "@/components/email-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { autoBind, extractVariables, render } from "@/lib/template";
import type { Template } from "@/lib/types";
import { NONE, type Patch, type WizardState } from "./wizard-types";

export function StepContent({
  state,
  patch,
  templates,
}: {
  state: WizardState;
  patch: Patch;
  templates: Template[];
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const variables = useMemo(
    () => extractVariables(state.subject, state.html),
    [state.subject, state.html]
  );

  const previewHtml = useMemo(
    () =>
      render(
        state.html,
        Object.fromEntries(variables.map((v) => [v, `<mark>${v}</mark>`]))
      ),
    [state.html, variables]
  );

  /** Re-bind placeholders whenever the copy changes, keeping manual choices. */
  function rebind(subject: string, html: string) {
    const columns = state.source?.columns ?? [];
    const fresh = autoBind(extractVariables(subject, html), columns);
    for (const [name, binding] of Object.entries(state.mapping.variables)) {
      if (name in fresh && binding.column) fresh[name] = binding;
    }
    patch({
      subject,
      html,
      mapping: { ...state.mapping, variables: fresh },
    });
  }

  function applyTemplate(id: string) {
    if (id === NONE) {
      patch({ templateId: "" });
      return;
    }
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const columns = state.source?.columns ?? [];
    patch({
      templateId: id,
      subject: template.subject,
      html: template.html,
      name: state.name || template.name,
      mapping: {
        ...state.mapping,
        variables: autoBind(
          extractVariables(template.subject, template.html),
          columns
        ),
      },
    });
  }

  /** Drops `{{Column}}` at the caret, or at the end if the body isn't focused. */
  function insertColumn(column: string) {
    const token = `{{${column}}}`;
    const el = bodyRef.current;
    if (!el) {
      rebind(state.subject, state.html + token);
      return;
    }
    const start = el.selectionStart ?? state.html.length;
    const end = el.selectionEnd ?? start;
    const next = state.html.slice(0, start) + token + state.html.slice(end);
    rebind(state.subject, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>The email</CardTitle>
          <CardDescription>
            Start from a saved template or write it here. Use{" "}
            <code>{"{{Column Name}}"}</code> anywhere you want a value from the
            sheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Start from a template
            </Label>
            <Select
              value={state.templateId || NONE}
              onValueChange={applyTemplate}
            >
              <SelectTrigger>
                <SelectValue placeholder="Write from scratch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Write from scratch</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Subject line</Label>
            <Input
              value={state.subject}
              onChange={(e) => rebind(e.target.value, state.html)}
              placeholder="A quick proposal for {{Company}}"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Body (HTML)</Label>
            <Textarea
              ref={bodyRef}
              value={state.html}
              onChange={(e) => rebind(state.subject, e.target.value)}
              className="min-h-72 font-mono text-xs"
              spellCheck={false}
            />
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

          {state.source ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-3">
              <span className="w-full text-xs text-muted-foreground">
                Insert a column:
              </span>
              {state.source.columns.map((column) => (
                <Button
                  key={column}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="font-mono"
                  onClick={() => insertColumn(column)}
                >
                  {column}
                </Button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription className="truncate">
            Subject: {state.subject || "—"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailPreview html={previewHtml} className="h-[520px]" />
        </CardContent>
      </Card>
    </div>
  );
}
