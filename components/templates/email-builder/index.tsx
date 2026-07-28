"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  GripVerticalIcon,
  ImageIcon,
  MinusIcon,
  MoveVerticalIcon,
  PlusIcon,
  Settings2Icon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  blockDefaults,
  sectionDefaults,
  type Block,
  type BlockType,
  type EmailDesign,
  type Section,
  type SectionRole,
} from "@/lib/email-design";
import { RichText } from "./rich-text";
import {
  AlignControl,
  ColorControl,
  FontControl,
  NumberControl,
  Row,
  TextControl,
} from "./controls";

type Selection =
  | { kind: "settings" }
  | { kind: "section"; sectionId: string }
  | { kind: "block"; sectionId: string; blockId: string };

// `Partial<Block>` collapses to only the union's common keys, so block edits
// use a loose patch that we merge and re-assert as a Block.
type BlockPatch = Record<string, unknown>;

const BLOCK_PALETTE: { type: BlockType; label: string; icon: typeof TypeIcon }[] = [
  { type: "heading", label: "Heading", icon: TypeIcon },
  { type: "text", label: "Text", icon: TypeIcon },
  { type: "button", label: "Button", icon: SquareIcon },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "divider", label: "Divider", icon: MinusIcon },
  { type: "spacer", label: "Spacer", icon: MoveVerticalIcon },
];

const ROLE_LABEL: Record<SectionRole, string> = {
  header: "Header",
  body: "Body",
  footer: "Footer",
  section: "Section",
};

export function EmailBuilder({
  design,
  onChange,
}: {
  design: EmailDesign;
  onChange: (design: EmailDesign) => void;
}) {
  const [sel, setSel] = useState<Selection>({ kind: "settings" });

  /* ---- immutable operations -------------------------------------------- */

  const setSections = (sections: Section[]) => onChange({ ...design, sections });

  const mapSection = (id: string, fn: (s: Section) => Section) =>
    setSections(design.sections.map((s) => (s.id === id ? fn(s) : s)));

  function addSection(role: SectionRole) {
    const section = sectionDefaults(role);
    setSections([...design.sections, section]);
    setSel({ kind: "section", sectionId: section.id });
  }

  function moveSection(id: string, dir: -1 | 1) {
    const i = design.sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= design.sections.length) return;
    const next = [...design.sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
  }

  function removeSection(id: string) {
    setSections(design.sections.filter((s) => s.id !== id));
    setSel({ kind: "settings" });
  }

  function addBlock(sectionId: string, type: BlockType) {
    const block = blockDefaults(type);
    mapSection(sectionId, (s) => ({ ...s, blocks: [...s.blocks, block] }));
    setSel({ kind: "block", sectionId, blockId: block.id });
  }

  function updateBlock(sectionId: string, blockId: string, patch: BlockPatch) {
    mapSection(sectionId, (s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.id === blockId ? ({ ...b, ...patch } as Block) : b
      ),
    }));
  }

  function moveBlock(sectionId: string, blockId: string, dir: -1 | 1) {
    mapSection(sectionId, (s) => {
      const i = s.blocks.findIndex((b) => b.id === blockId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.blocks.length) return s;
      const blocks = [...s.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...s, blocks };
    });
  }

  function duplicateBlock(sectionId: string, blockId: string) {
    mapSection(sectionId, (s) => {
      const i = s.blocks.findIndex((b) => b.id === blockId);
      if (i < 0) return s;
      const copy = { ...s.blocks[i], id: blockDefaults(s.blocks[i].type).id };
      const blocks = [...s.blocks];
      blocks.splice(i + 1, 0, copy);
      return { ...s, blocks };
    });
  }

  function removeBlock(sectionId: string, blockId: string) {
    mapSection(sectionId, (s) => ({
      ...s,
      blocks: s.blocks.filter((b) => b.id !== blockId),
    }));
    setSel({ kind: "section", sectionId });
  }

  /* ---- render ----------------------------------------------------------- */

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* Canvas */}
      <div
        className="min-h-[400px] rounded-lg border p-4"
        style={{ background: design.settings.pageBackground }}
        onClick={() => setSel({ kind: "settings" })}
      >
        <div
          className="mx-auto overflow-hidden rounded-lg shadow-sm"
          style={{
            maxWidth: design.settings.contentWidth,
            background: design.settings.contentBackground,
            fontFamily: design.settings.fontFamily,
            color: design.settings.textColor,
          }}
        >
          {design.sections.map((section, i) => (
            <SectionCanvas
              key={section.id}
              section={section}
              first={i === 0}
              last={i === design.sections.length - 1}
              sel={sel}
              settings={design.settings}
              onSelectSection={() => setSel({ kind: "section", sectionId: section.id })}
              onSelectBlock={(blockId) =>
                setSel({ kind: "block", sectionId: section.id, blockId })
              }
              onMoveSection={(dir) => moveSection(section.id, dir)}
              onAddBlock={(type) => addBlock(section.id, type)}
              onUpdateBlock={(blockId, patch) => updateBlock(section.id, blockId, patch)}
              onMoveBlock={(blockId, dir) => moveBlock(section.id, blockId, dir)}
              onDuplicateBlock={(blockId) => duplicateBlock(section.id, blockId)}
              onRemoveBlock={(blockId) => removeBlock(section.id, blockId)}
            />
          ))}
        </div>

        <div
          className="mx-auto mt-3 flex flex-wrap justify-center gap-1.5"
          style={{ maxWidth: design.settings.contentWidth }}
          onClick={(e) => e.stopPropagation()}
        >
          {(["header", "body", "footer", "section"] as SectionRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => addSection(role)}
              className="flex items-center gap-1 rounded-md border border-dashed border-neutral-300 bg-white/80 px-2 py-1 text-xs text-neutral-600 shadow-sm transition-colors hover:bg-white hover:text-neutral-900"
            >
              <PlusIcon className="size-3" />
              {ROLE_LABEL[role]}
            </button>
          ))}
        </div>
      </div>

      {/* Inspector */}
      <div className="h-fit rounded-lg border lg:sticky lg:top-20">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">
            {sel.kind === "settings"
              ? "Page settings"
              : sel.kind === "section"
                ? "Section"
                : "Block"}
          </p>
          <button
            type="button"
            onClick={() => setSel({ kind: "settings" })}
            title="Page settings"
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted [&_svg]:size-4",
              sel.kind === "settings" && "bg-muted text-foreground"
            )}
          >
            <Settings2Icon />
          </button>
        </div>

        <div className="space-y-3 p-3">
          {sel.kind === "settings" ? (
            <SettingsInspector
              design={design}
              onChange={(settings) => onChange({ ...design, settings })}
            />
          ) : null}

          {sel.kind === "section"
            ? (() => {
                const section = design.sections.find((s) => s.id === sel.sectionId);
                if (!section) return null;
                return (
                  <SectionInspector
                    section={section}
                    canDelete={design.sections.length > 1}
                    onChange={(patch) => mapSection(section.id, (s) => ({ ...s, ...patch }))}
                    onDelete={() => removeSection(section.id)}
                  />
                );
              })()
            : null}

          {sel.kind === "block"
            ? (() => {
                const section = design.sections.find((s) => s.id === sel.sectionId);
                const block = section?.blocks.find((b) => b.id === sel.blockId);
                if (!block) return null;
                return (
                  <BlockInspector
                    block={block}
                    onChange={(patch) => updateBlock(sel.sectionId, block.id, patch)}
                  />
                );
              })()
            : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Canvas ----- */

function SectionCanvas({
  section,
  first,
  last,
  sel,
  settings,
  onSelectSection,
  onSelectBlock,
  onMoveSection,
  onAddBlock,
  onUpdateBlock,
  onMoveBlock,
  onDuplicateBlock,
  onRemoveBlock,
}: {
  section: Section;
  first: boolean;
  last: boolean;
  sel: Selection;
  settings: EmailDesign["settings"];
  onSelectSection: () => void;
  onSelectBlock: (blockId: string) => void;
  onMoveSection: (dir: -1 | 1) => void;
  onAddBlock: (type: BlockType) => void;
  onUpdateBlock: (blockId: string, patch: BlockPatch) => void;
  onMoveBlock: (blockId: string, dir: -1 | 1) => void;
  onDuplicateBlock: (blockId: string) => void;
  onRemoveBlock: (blockId: string) => void;
}) {
  const selected = sel.kind === "section" && sel.sectionId === section.id;
  return (
    <div
      className={cn("group/section relative", selected && "outline-2 outline-primary")}
      style={{
        background:
          section.backgroundColor === "transparent" ? undefined : section.backgroundColor,
        padding: section.padding,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelectSection();
      }}
    >
      <div className="pointer-events-none absolute left-0 top-0 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/section:opacity-100">
        <span className="pointer-events-auto flex items-center gap-1 rounded-br-md bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          <GripVerticalIcon className="size-3" />
          {ROLE_LABEL[section.role]}
        </span>
        <button
          type="button"
          className="pointer-events-auto rounded bg-primary/80 p-0.5 text-primary-foreground disabled:opacity-40"
          disabled={first}
          onClick={(e) => { e.stopPropagation(); onMoveSection(-1); }}
          aria-label="Move section up"
        >
          <ChevronUpIcon className="size-3" />
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded bg-primary/80 p-0.5 text-primary-foreground disabled:opacity-40"
          disabled={last}
          onClick={(e) => { e.stopPropagation(); onMoveSection(1); }}
          aria-label="Move section down"
        >
          <ChevronDownIcon className="size-3" />
        </button>
      </div>

      {section.blocks.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Empty section — add a block below.
        </p>
      ) : (
        section.blocks.map((block, i) => (
          <BlockCanvas
            key={block.id}
            block={block}
            settings={settings}
            selected={sel.kind === "block" && sel.blockId === block.id}
            first={i === 0}
            last={i === section.blocks.length - 1}
            onSelect={() => onSelectBlock(block.id)}
            onChange={(patch) => onUpdateBlock(block.id, patch)}
            onMove={(dir) => onMoveBlock(block.id, dir)}
            onDuplicate={() => onDuplicateBlock(block.id)}
            onRemove={() => onRemoveBlock(block.id)}
          />
        ))
      )}

      <div
        className="mt-2 flex flex-wrap gap-1 border-t border-dashed border-neutral-300/60 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        {BLOCK_PALETTE.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => onAddBlock(type)}
            className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white/90 px-1.5 py-0.5 text-[11px] text-neutral-600 shadow-sm transition-colors hover:bg-neutral-100 hover:text-neutral-900 [&_svg]:size-3"
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockCanvas({
  block,
  settings,
  selected,
  first,
  last,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  block: Block;
  settings: EmailDesign["settings"];
  selected: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onChange: (patch: BlockPatch) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "relative rounded-sm",
        selected ? "outline-2 outline-primary" : "hover:outline hover:outline-primary/30"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="absolute -top-2 right-1 z-20 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100">
        <MiniButton label="Up" disabled={first} onClick={() => onMove(-1)}>
          <ChevronUpIcon />
        </MiniButton>
        <MiniButton label="Down" disabled={last} onClick={() => onMove(1)}>
          <ChevronDownIcon />
        </MiniButton>
        <MiniButton label="Duplicate" onClick={onDuplicate}>
          <CopyIcon />
        </MiniButton>
        <MiniButton label="Delete" onClick={onRemove} destructive>
          <Trash2Icon />
        </MiniButton>
      </div>
      <BlockContent block={block} settings={settings} onChange={onChange} />
    </div>
  );
}

function BlockContent({
  block,
  settings,
  onChange,
}: {
  block: Block;
  settings: EmailDesign["settings"];
  onChange: (patch: BlockPatch) => void;
}) {
  switch (block.type) {
    case "heading": {
      const size = block.level === 1 ? 28 : block.level === 2 ? 22 : 18;
      return (
        <div
          style={{
            padding: `${block.paddingY}px 0`,
            textAlign: block.align,
            color: block.color,
            fontSize: size,
            fontWeight: 700,
            lineHeight: 1.25,
            fontFamily: block.fontFamily || settings.fontFamily,
          }}
        >
          {block.text || "Heading"}
        </div>
      );
    }
    case "text":
      return (
        <div style={{ padding: `${block.paddingY}px 0` }}>
          <RichText
            value={block.html}
            onChange={(html) => onChange({ html })}
            style={{
              textAlign: block.align,
              color: block.color,
              fontSize: block.fontSize,
              lineHeight: block.lineHeight,
              fontFamily: block.fontFamily || settings.fontFamily,
            }}
          />
        </div>
      );
    case "button":
      return (
        <div style={{ padding: `${block.paddingY}px 0`, textAlign: block.align }}>
          <span
            style={{
              display: "inline-block",
              background: block.backgroundColor,
              color: block.color,
              fontSize: block.fontSize,
              fontWeight: 600,
              padding: "12px 22px",
              borderRadius: block.borderRadius,
            }}
          >
            {block.text || "Button"}
          </span>
        </div>
      );
    case "image":
      return (
        <div style={{ padding: `${block.paddingY}px 0`, textAlign: block.align }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.alt}
            style={{ display: "inline-block", width: `${block.width}%`, maxWidth: "100%", border: 0 }}
          />
        </div>
      );
    case "divider":
      return (
        <div style={{ padding: `${block.paddingY}px 0` }}>
          <div style={{ borderTop: `${block.thickness}px solid ${block.color}` }} />
        </div>
      );
    case "spacer":
      return (
        <div
          className="flex items-center justify-center border border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground"
          style={{ height: block.height }}
        >
          {block.height}px
        </div>
      );
  }
}

function MiniButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        // Fixed colours (not theme tokens): these float over the email canvas,
        // whose sections can be any colour, so they must read everywhere.
        "flex size-6 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100 disabled:opacity-30 [&_svg]:size-3",
        destructive && "border-red-200 text-red-600 hover:bg-red-50"
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------- Inspectors ----- */

function SettingsInspector({
  design,
  onChange,
}: {
  design: EmailDesign;
  onChange: (settings: EmailDesign["settings"]) => void;
}) {
  const s = design.settings;
  const set = (patch: Partial<EmailDesign["settings"]>) => onChange({ ...s, ...patch });
  return (
    <>
      <Row label="Page bg">
        <ColorControl value={s.pageBackground} onChange={(v) => set({ pageBackground: v })} />
      </Row>
      <Row label="Content bg">
        <ColorControl value={s.contentBackground} onChange={(v) => set({ contentBackground: v })} />
      </Row>
      <Row label="Text color">
        <ColorControl value={s.textColor} onChange={(v) => set({ textColor: v })} />
      </Row>
      <Row label="Font">
        <FontControl value={s.fontFamily} onChange={(v) => set({ fontFamily: v })} />
      </Row>
      <Row label="Width">
        <NumberControl value={s.contentWidth} min={320} max={800} suffix="px" onChange={(v) => set({ contentWidth: v })} />
      </Row>
    </>
  );
}

function SectionInspector({
  section,
  canDelete,
  onChange,
  onDelete,
}: {
  section: Section;
  canDelete: boolean;
  onChange: (patch: Partial<Section>) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Row label="Role">
        <select
          value={section.role}
          onChange={(e) => onChange({ role: e.target.value as SectionRole })}
          className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
        >
          {(["header", "body", "footer", "section"] as SectionRole[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </Row>
      <Row label="Background">
        <ColorControl value={section.backgroundColor} allowTransparent onChange={(v) => onChange({ backgroundColor: v })} />
      </Row>
      <Row label="Padding">
        <NumberControl value={section.padding} min={0} max={80} suffix="px" onChange={(v) => onChange({ padding: v })} />
      </Row>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-destructive/40 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40 [&_svg]:size-3.5"
      >
        <Trash2Icon /> Delete section
      </button>
    </>
  );
}

function BlockInspector({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: BlockPatch) => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <>
          <Row label="Text"><TextControl value={block.text} onChange={(text) => onChange({ text })} /></Row>
          <Row label="Level">
            <select
              value={block.level}
              onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 | 3 })}
              className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
            >
              <option value={1}>H1 — large</option>
              <option value={2}>H2 — medium</option>
              <option value={3}>H3 — small</option>
            </select>
          </Row>
          <Row label="Color"><ColorControl value={block.color} onChange={(color) => onChange({ color })} /></Row>
          <Row label="Align"><AlignControl value={block.align} onChange={(align) => onChange({ align })} /></Row>
          <Row label="Font"><FontControl value={block.fontFamily ?? ""} onChange={(fontFamily) => onChange({ fontFamily })} /></Row>
          <Row label="Spacing"><NumberControl value={block.paddingY} min={0} max={60} suffix="px" onChange={(paddingY) => onChange({ paddingY })} /></Row>
        </>
      );
    case "text":
      return (
        <>
          <p className="text-xs text-muted-foreground">Edit the words on the canvas; style the whole block here.</p>
          <Row label="Font size"><NumberControl value={block.fontSize} min={10} max={40} suffix="px" onChange={(fontSize) => onChange({ fontSize })} /></Row>
          <Row label="Color"><ColorControl value={block.color} onChange={(color) => onChange({ color })} /></Row>
          <Row label="Line height"><NumberControl value={Math.round(block.lineHeight * 10)} min={10} max={25} onChange={(v) => onChange({ lineHeight: v / 10 })} /></Row>
          <Row label="Align"><AlignControl value={block.align} onChange={(align) => onChange({ align })} /></Row>
          <Row label="Font"><FontControl value={block.fontFamily ?? ""} onChange={(fontFamily) => onChange({ fontFamily })} /></Row>
          <Row label="Spacing"><NumberControl value={block.paddingY} min={0} max={60} suffix="px" onChange={(paddingY) => onChange({ paddingY })} /></Row>
        </>
      );
    case "button":
      return (
        <>
          <Row label="Label"><TextControl value={block.text} onChange={(text) => onChange({ text })} /></Row>
          <Row label="Link"><TextControl value={block.href} onChange={(href) => onChange({ href })} placeholder="https://…" /></Row>
          <Row label="Button bg"><ColorControl value={block.backgroundColor} onChange={(backgroundColor) => onChange({ backgroundColor })} /></Row>
          <Row label="Text color"><ColorControl value={block.color} onChange={(color) => onChange({ color })} /></Row>
          <Row label="Font size"><NumberControl value={block.fontSize} min={10} max={30} suffix="px" onChange={(fontSize) => onChange({ fontSize })} /></Row>
          <Row label="Radius"><NumberControl value={block.borderRadius} min={0} max={40} suffix="px" onChange={(borderRadius) => onChange({ borderRadius })} /></Row>
          <Row label="Align"><AlignControl value={block.align} onChange={(align) => onChange({ align })} /></Row>
        </>
      );
    case "image":
      return (
        <>
          <Row label="Image URL"><TextControl value={block.src} onChange={(src) => onChange({ src })} placeholder="https://…" /></Row>
          <Row label="Alt text"><TextControl value={block.alt} onChange={(alt) => onChange({ alt })} /></Row>
          <Row label="Link"><TextControl value={block.href} onChange={(href) => onChange({ href })} placeholder="optional" /></Row>
          <Row label="Width"><NumberControl value={block.width} min={10} max={100} suffix="%" onChange={(width) => onChange({ width })} /></Row>
          <Row label="Align"><AlignControl value={block.align} onChange={(align) => onChange({ align })} /></Row>
        </>
      );
    case "divider":
      return (
        <>
          <Row label="Color"><ColorControl value={block.color} onChange={(color) => onChange({ color })} /></Row>
          <Row label="Thickness"><NumberControl value={block.thickness} min={1} max={10} suffix="px" onChange={(thickness) => onChange({ thickness })} /></Row>
          <Row label="Spacing"><NumberControl value={block.paddingY} min={0} max={60} suffix="px" onChange={(paddingY) => onChange({ paddingY })} /></Row>
        </>
      );
    case "spacer":
      return (
        <Row label="Height"><NumberControl value={block.height} min={4} max={120} suffix="px" onChange={(height) => onChange({ height })} /></Row>
      );
  }
}
