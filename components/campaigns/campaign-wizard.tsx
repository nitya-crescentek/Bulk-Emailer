"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  SaveIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client";
import {
  blankDesign,
  isEmailDesign,
  renderDesign,
  type EmailDesign,
} from "@/lib/email-design";
import { cn } from "@/lib/utils";
import type { Campaign, SmtpProfile, SourcePreview, Template } from "@/lib/types";
import { StepContent } from "./step-content";
import { StepMapping } from "./step-mapping";
import { StepSend } from "./step-send";
import { StepSource } from "./step-source";
import type { WizardState } from "./wizard-types";

const STEPS = ["Data source", "Email", "Mapping", "Send"] as const;

export function CampaignWizard({
  profiles,
  templates,
  campaign,
  sourcePreview,
}: {
  profiles: SmtpProfile[];
  templates: Template[];
  /** When present, the wizard edits this campaign instead of creating one. */
  campaign?: Campaign;
  sourcePreview?: SourcePreview | null;
}) {
  const router = useRouter();
  const isEdit = !!campaign;
  // Copy is always editable; the recipient-shaping steps only when it's a draft.
  const contentOnly = isEdit && campaign!.status !== "draft";

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<WizardState>(() => {
    if (campaign) {
      return initialFromCampaign(campaign, sourcePreview ?? null, profiles);
    }
    // Start on a blank canvas in the visual builder, with the effective HTML
    // rendered from it so the preview and mapping stay in sync from the start.
    const design = blankDesign();
    return {
      source: null,
      templateId: "",
      subject: "A quick proposal for {{Company}}",
      html: renderDesign(design),
      design,
      editorMode: "visual" as const,
      mapping: { email: "", variables: {} },
      name: "",
      smtpProfileId:
        profiles.find((p) => p.isDefault)?.id ?? profiles[0]?.id ?? "",
      rateLimit:
        profiles.find((p) => p.isDefault)?.rateLimit ??
        profiles[0]?.rateLimit ??
        30,
      dedupe: true,
    };
  });

  const patch = (update: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...update }));

  const blocker = validate(state, step);

  function contentPayload() {
    return {
      name: state.name,
      subject: state.subject,
      html: state.html,
      design: state.design,
      editorMode: state.editorMode,
      templateId: state.templateId || undefined,
    };
  }

  async function submit() {
    setSaving(true);
    try {
      if (isEdit) {
        const body = contentOnly
          ? contentPayload()
          : {
              ...contentPayload(),
              sourceId: state.source!.sourceId,
              smtpProfileId: state.smtpProfileId,
              mapping: state.mapping,
              rateLimit: state.rateLimit,
              dedupe: state.dedupe,
            };
        await api(`/api/campaigns/${campaign!.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("Campaign updated");
        router.push(`/campaigns/${campaign!.id}`);
        router.refresh();
      } else {
        const { campaign: created } = await api<{ campaign: Campaign }>(
          "/api/campaigns",
          {
            method: "POST",
            body: JSON.stringify({
              ...contentPayload(),
              sourceId: state.source!.sourceId,
              smtpProfileId: state.smtpProfileId,
              mapping: state.mapping,
              rateLimit: state.rateLimit,
              dedupe: state.dedupe,
            }),
          }
        );
        toast.success("Campaign created");
        router.push(`/campaigns/${created.id}`);
      }
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  // A finished campaign only exposes the copy — no stepper, just edit + save.
  if (contentOnly) {
    const contentBlocker = !state.name.trim()
      ? "Name the campaign."
      : !state.subject.trim()
        ? "Add a subject line."
        : !state.html.trim()
          ? "Write the email body."
          : undefined;
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Campaign name</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Q3 outreach"
            />
          </CardContent>
        </Card>

        <StepContent state={state} patch={patch} templates={templates} />

        <div className="flex items-center gap-2 border-t pt-4">
          <Button onClick={submit} disabled={Boolean(contentBlocker) || saving}>
            <SaveIcon />
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/campaigns/${campaign!.id}`)}
          >
            Cancel
          </Button>
          {contentBlocker ? (
            <p className="text-sm text-muted-foreground">{contentBlocker}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  active && "bg-primary text-primary-foreground",
                  done && "text-foreground hover:bg-muted",
                  !active && !done && "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-xs",
                    active && "border-primary-foreground",
                    done && "border-emerald-600 text-emerald-600"
                  )}
                >
                  {done ? <CheckIcon className="size-3" /> : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 ? (
                <span className="text-muted-foreground">/</span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {step === 0 ? <StepSource state={state} patch={patch} /> : null}
      {step === 1 ? (
        <StepContent state={state} patch={patch} templates={templates} />
      ) : null}
      {step === 2 ? <StepMapping state={state} patch={patch} /> : null}
      {step === 3 ? (
        <StepSend state={state} patch={patch} profiles={profiles} />
      ) : null}

      <div className="flex items-center gap-2 border-t pt-4">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeftIcon />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={Boolean(blocker)}>
            Continue
            <ArrowRightIcon />
          </Button>
        ) : (
          <Button onClick={submit} disabled={Boolean(blocker) || saving}>
            {isEdit ? <SaveIcon /> : <CheckIcon />}
            {saving
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create campaign"}
          </Button>
        )}

        {blocker ? (
          <p className="text-sm text-muted-foreground">{blocker}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Rebuilds editor state from a stored campaign. */
function initialFromCampaign(
  campaign: Campaign,
  source: SourcePreview | null,
  profiles: SmtpProfile[]
): WizardState {
  const hasDesign = isEmailDesign(campaign.design);
  return {
    source,
    templateId: campaign.templateId ?? "",
    subject: campaign.subject,
    html: campaign.html,
    design: hasDesign ? (campaign.design as EmailDesign) : blankDesign(),
    // A campaign with no valid design must edit as HTML so its markup survives.
    editorMode: hasDesign && campaign.editorMode === "visual" ? "visual" : "html",
    mapping: campaign.mapping,
    name: campaign.name,
    smtpProfileId:
      campaign.smtpProfileId ??
      profiles.find((p) => p.isDefault)?.id ??
      profiles[0]?.id ??
      "",
    rateLimit: campaign.rateLimit,
    dedupe: true,
  };
}

/** Returns the reason the current step cannot be left, or undefined. */
function validate(state: WizardState, step: number): string | undefined {
  if (step === 0 && !state.source) return "Import a sheet or CSV to continue.";
  if (step === 1) {
    if (!state.subject.trim()) return "Add a subject line.";
    if (!state.html.trim()) return "Write the email body.";
  }
  if (step >= 2 && !state.mapping.email) {
    return "Choose the column that holds the email address.";
  }
  if (step === 3) {
    if (!state.name.trim()) return "Name the campaign.";
    if (!state.smtpProfileId) return "Choose an SMTP profile.";
    if (state.rateLimit < 1) return "Set at least 1 email per minute.";
  }
  return undefined;
}
