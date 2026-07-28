"use client";

import { useMemo, useRef } from "react";
import { CodeIcon, EyeIcon, PaintbrushIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmailBuilder } from "@/components/templates/email-builder";
import { EmailPreview } from "@/components/email-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  blankDesign,
  isEmailDesign,
  renderDesign,
  type EmailDesign,
} from "@/lib/email-design";
import { autoBind, extractVariables, render } from "@/lib/template";
import { cn } from "@/lib/utils";
import type { EditorMode, Template } from "@/lib/types";
import { type Patch, type WizardState } from "./wizard-types";

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

  /**
   * Re-derives placeholder bindings whenever the copy changes, preserving any
   * manual column choices. `html` here is always the *effective* HTML so the
   * mapping step and preview stay in sync in both editor modes.
   */
  function apply(next: {
    subject?: string;
    html?: string;
    design?: EmailDesign;
    extra?: Partial<WizardState>;
  }) {
    const subject = next.subject ?? state.subject;
    const html = next.html ?? state.html;
    const columns = state.source?.columns ?? [];
    const fresh = autoBind(extractVariables(subject, html), columns);
    for (const [name, binding] of Object.entries(state.mapping.variables)) {
      if (name in fresh && binding.column) fresh[name] = binding;
    }
    patch({
      subject,
      html,
      ...(next.design ? { design: next.design } : {}),
      ...next.extra,
      mapping: { ...state.mapping, variables: fresh },
    });
  }

  function switchMode(mode: EditorMode) {
    if (mode === state.editorMode) return;
    // Keep the effective HTML aligned with the design when returning to visual.
    apply({ html: renderDesign(state.design), extra: { editorMode: mode } });
  }

  function applyTemplate(template: Template | null) {
    if (!template) {
      const design = blankDesign();
      apply({
        html: renderDesign(design),
        design,
        extra: { templateId: "", editorMode: "visual" },
      });
      return;
    }
    const useVisual =
      template.editorMode === "visual" && isEmailDesign(template.design);
    const design = useVisual ? (template.design as EmailDesign) : state.design;
    apply({
      subject: template.subject,
      html: useVisual ? renderDesign(design) : template.html,
      design,
      extra: {
        templateId: template.id,
        editorMode: useVisual ? "visual" : "html",
        name: state.name || template.name,
      },
    });
  }

  /** Drops `{{Column}}` at the caret (HTML mode only). */
  function insertColumn(column: string) {
    const token = `{{${column}}}`;
    const el = bodyRef.current;
    if (!el) {
      apply({ html: state.html + token });
      return;
    }
    const start = el.selectionStart ?? state.html.length;
    const end = el.selectionEnd ?? start;
    const next = state.html.slice(0, start) + token + state.html.slice(end);
    apply({ html: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Choose a starting point</CardTitle>
          <CardDescription>
            Pick a saved template to edit for this campaign, or start from a
            blank canvas. Editing here never changes the saved template.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <ScratchCard
              selected={!state.templateId}
              onClick={() => applyTemplate(null)}
            />
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={state.templateId === template.id}
                onClick={() => applyTemplate(template)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>The email</CardTitle>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border p-0.5">
                  <ModeButton
                    active={state.editorMode === "visual"}
                    onClick={() => switchMode("visual")}
                  >
                    <PaintbrushIcon />
                    Visual
                  </ModeButton>
                  <ModeButton
                    active={state.editorMode === "html"}
                    onClick={() => switchMode("html")}
                  >
                    <CodeIcon />
                    HTML
                  </ModeButton>
                </div>
                <PreviewDialog subject={state.subject} html={previewHtml} />
              </div>
            </div>
            <CardDescription>
              Use <code>{"{{Column Name}}"}</code> anywhere you want a value from
              the sheet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Subject line</Label>
              <Input
                value={state.subject}
                onChange={(e) => apply({ subject: e.target.value })}
                placeholder="A quick proposal for {{Company}}"
              />
            </div>

            {state.editorMode === "visual" ? (
              <EmailBuilder
                design={state.design}
                onChange={(design) =>
                  apply({ design, html: renderDesign(design) })
                }
              />
            ) : (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Body (HTML)</Label>
                <Textarea
                  ref={bodyRef}
                  value={state.html}
                  onChange={(e) => apply({ html: e.target.value })}
                  className="min-h-72 font-mono text-xs"
                  spellCheck={false}
                />
              </div>
            )}

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

            {state.editorMode === "html" && state.source ? (
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
    </div>
  );
}

function PreviewDialog({ subject, html }: { subject: string; html: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <EyeIcon />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription className="truncate">
            Subject: {subject || "—"}
          </DialogDescription>
        </DialogHeader>
        <EmailPreview html={html} className="h-[70vh]" />
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: Template;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border text-left transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "hover:border-muted-foreground/40"
      )}
    >
      <div className="pointer-events-none h-28 overflow-hidden border-b bg-white">
        <EmailPreview
          html={template.html}
          className="h-[420px] rounded-none border-0"
        />
      </div>
      <span className="truncate px-2.5 py-2 text-sm font-medium">
        {template.name}
      </span>
    </button>
  );
}

function ScratchCard({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-center transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
      )}
    >
      <PlusIcon className="size-6" />
      <span className="text-sm font-medium">Start from scratch</span>
    </button>
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
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors [&_svg]:size-4",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
