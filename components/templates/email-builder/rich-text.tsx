"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { BoldIcon, ItalicIcon, LinkIcon, UnderlineIcon, BracesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A minimal contentEditable rich-text field for a text block. Emits inline HTML
 * (bold/italic/underline/link) and supports inserting {{placeholders}}. It is
 * intentionally uncontrolled after mount so the caret never jumps.
 */
export function RichText({
  value,
  onChange,
  style,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  style?: CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Seed once; only overwrite if the incoming value diverges from the DOM
  // (e.g. switching between selected blocks), which preserves the cursor.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  }

  function insertVariable() {
    const name = window.prompt("Placeholder name (e.g. First Name)", "First Name");
    if (!name) return;
    ref.current?.focus();
    document.execCommand("insertText", false, `{{${name.trim()}}}`);
    onChange(ref.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    exec("createLink", url);
  }

  return (
    // Fixed colours: this editor sits on the email canvas (any section colour),
    // so the toolbar must stay legible regardless of the app theme.
    <div className="overflow-hidden rounded-md border border-neutral-300">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-neutral-100 px-1 py-1">
        <ToolbarButton label="Bold" onClick={() => exec("bold")}>
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => exec("italic")}>
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => exec("underline")}>
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton label="Link" onClick={addLink}>
          <LinkIcon />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-neutral-300" />
        <ToolbarButton label="Insert placeholder" onClick={insertVariable}>
          <BracesIcon />
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className={cn(
          "min-h-16 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          className
        )}
        style={style}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Keep focus in the editable region so execCommand targets the selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-900 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
