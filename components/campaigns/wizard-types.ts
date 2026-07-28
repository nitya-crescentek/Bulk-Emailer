import type { EmailDesign } from "@/lib/email-design";
import type { EditorMode, Mapping, SourcePreview } from "@/lib/types";

export interface WizardState {
  source: SourcePreview | null;
  templateId: string;
  subject: string;
  /** Always the *effective* HTML — the rendered design in visual mode, or the
   *  raw markup in HTML mode. Downstream steps read this directly. */
  html: string;
  /** Structured builder design (used when editorMode === "visual"). */
  design: EmailDesign;
  editorMode: EditorMode;
  mapping: Mapping;
  name: string;
  smtpProfileId: string;
  rateLimit: number;
  dedupe: boolean;
}

export type Patch = (patch: Partial<WizardState>) => void;

/** Radix Select forbids an empty item value, so "not mapped" needs a sentinel. */
export const NONE = "__none__";
