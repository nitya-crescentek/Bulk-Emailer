"use client";

import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FONT_STACKS, type Align } from "@/lib/email-design";

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function ColorControl({
  value,
  onChange,
  allowTransparent = false,
}: {
  value: string;
  onChange: (value: string) => void;
  allowTransparent?: boolean;
}) {
  const isTransparent = value === "transparent";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={isTransparent ? "#ffffff" : value}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
        aria-label="Colour"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 font-mono text-xs"
      />
      {allowTransparent ? (
        <button
          type="button"
          onClick={() => onChange(isTransparent ? "#ffffff" : "transparent")}
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted",
            isTransparent && "bg-muted"
          )}
        >
          None
        </button>
      ) : null}
    </div>
  );
}

export function NumberControl({
  value,
  onChange,
  min = 0,
  max = 999,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="h-8 w-24"
      />
      {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

export function AlignControl({
  value,
  onChange,
}: {
  value: Align;
  onChange: (value: Align) => void;
}) {
  const options: { value: Align; icon: typeof AlignLeftIcon }[] = [
    { value: "left", icon: AlignLeftIcon },
    { value: "center", icon: AlignCenterIcon },
    { value: "right", icon: AlignRightIcon },
  ];
  return (
    <div className="flex gap-1">
      {options.map(({ value: v, icon: Icon }) => (
        <button
          key={v}
          type="button"
          aria-label={`Align ${v}`}
          onClick={() => onChange(v)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-muted [&_svg]:size-4",
            value === v ? "bg-muted text-foreground" : "text-muted-foreground"
          )}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}

export function FontControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
    >
      {FONT_STACKS.map((f) => (
        <option key={f.value} value={f.value}>
          {f.label}
        </option>
      ))}
    </select>
  );
}

export function TextControl({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8"
    />
  );
}
