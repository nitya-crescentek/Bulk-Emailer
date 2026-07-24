import type { Mapping, SourcePreview } from "@/lib/types";

export interface WizardState {
  source: SourcePreview | null;
  templateId: string;
  subject: string;
  html: string;
  mapping: Mapping;
  name: string;
  smtpProfileId: string;
  rateLimit: number;
  dedupe: boolean;
}

export type Patch = (patch: Partial<WizardState>) => void;

/** Radix Select forbids an empty item value, so "not mapped" needs a sentinel. */
export const NONE = "__none__";
