"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/client";
import { STARTER_TEMPLATE } from "@/lib/template";
import { cn } from "@/lib/utils";
import type { Campaign, SmtpProfile, Template } from "@/lib/types";
import { StepContent } from "./step-content";
import { StepMapping } from "./step-mapping";
import { StepSend } from "./step-send";
import { StepSource } from "./step-source";
import type { WizardState } from "./wizard-types";

const STEPS = ["Data source", "Email", "Mapping", "Send"] as const;

export function CampaignWizard({
  profiles,
  templates,
}: {
  profiles: SmtpProfile[];
  templates: Template[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [state, setState] = useState<WizardState>({
    source: null,
    templateId: "",
    subject: "A quick proposal for {{Company}}",
    html: STARTER_TEMPLATE,
    mapping: { email: "", variables: {} },
    name: "",
    smtpProfileId: profiles.find((p) => p.isDefault)?.id ?? profiles[0]?.id ?? "",
    rateLimit:
      profiles.find((p) => p.isDefault)?.rateLimit ?? profiles[0]?.rateLimit ?? 30,
    dedupe: true,
  });

  const patch = (update: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...update }));

  const blocker = validate(state, step);

  async function create() {
    setCreating(true);
    try {
      const { campaign } = await api<{ campaign: Campaign }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: state.name,
          sourceId: state.source!.sourceId,
          smtpProfileId: state.smtpProfileId,
          templateId: state.templateId || undefined,
          subject: state.subject,
          html: state.html,
          mapping: state.mapping,
          rateLimit: state.rateLimit,
          dedupe: state.dedupe,
        }),
      });
      toast.success("Campaign created");
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setCreating(false);
    }
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
          <Button onClick={create} disabled={Boolean(blocker) || creating}>
            <CheckIcon />
            {creating ? "Creating…" : "Create campaign"}
          </Button>
        )}

        {blocker ? (
          <p className="text-sm text-muted-foreground">{blocker}</p>
        ) : null}
      </div>
    </div>
  );
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
