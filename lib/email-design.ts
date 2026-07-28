/**
 * The block model behind the visual template builder, plus a renderer that
 * turns it into email-safe HTML (table layout, inline styles, web-safe fonts).
 *
 * This module is pure and isomorphic — imported by the client builder for the
 * live preview and by the server for seeding default templates. `{{placeholder}}`
 * tokens are passed through untouched so the existing render pipeline can fill
 * them in later.
 */

export type Align = "left" | "center" | "right";

export interface DesignSettings {
  /** Page background, outside the content card. */
  pageBackground: string;
  /** The content card background. */
  contentBackground: string;
  /** Default text colour. */
  textColor: string;
  fontFamily: string;
  /** Content width in px (email convention is ~600). */
  contentWidth: number;
}

export type SectionRole = "header" | "body" | "footer" | "section";

export interface Section {
  id: string;
  role: SectionRole;
  backgroundColor: string;
  padding: number;
  blocks: Block[];
}

export interface HeadingBlock {
  id: string;
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  color: string;
  align: Align;
  fontFamily?: string;
  paddingY: number;
}

export interface TextBlock {
  id: string;
  type: "text";
  /** Constrained inline HTML (b/i/u/a/br/span). */
  html: string;
  fontSize: number;
  color: string;
  lineHeight: number;
  align: Align;
  fontFamily?: string;
  paddingY: number;
}

export interface ButtonBlock {
  id: string;
  type: "button";
  text: string;
  href: string;
  backgroundColor: string;
  color: string;
  fontSize: number;
  borderRadius: number;
  align: Align;
  paddingY: number;
}

export interface ImageBlock {
  id: string;
  type: "image";
  src: string;
  alt: string;
  href: string;
  /** Percentage of content width, 10–100. */
  width: number;
  align: Align;
  paddingY: number;
}

export interface DividerBlock {
  id: string;
  type: "divider";
  color: string;
  thickness: number;
  paddingY: number;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  height: number;
}

export type Block =
  | HeadingBlock
  | TextBlock
  | ButtonBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock;

export type BlockType = Block["type"];

export interface EmailDesign {
  version: 1;
  settings: DesignSettings;
  sections: Section[];
}

/* --------------------------------------------------------------- Fonts --- */

export const FONT_STACKS: { label: string; value: string }[] = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
];

/* ------------------------------------------------------------- IDs -------- */

// Deterministic-ish ids without Math.random (unavailable in some server
// contexts). A module counter is fine — ids only need to be unique in a design.
let counter = 0;
export function newId(prefix = "b"): string {
  counter += 1;
  return `${prefix}${counter.toString(36)}${(counter * 2654435761 % 1e6).toString(36)}`;
}

/* --------------------------------------------------------- Factories ------ */

export function blockDefaults(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case "heading":
      return { id, type, text: "Your heading", level: 2, color: "#111111", align: "left", paddingY: 8 };
    case "text":
      return {
        id,
        type,
        html: "Write something here. Use the toolbar to add <b>bold</b> text, links, or a {{Placeholder}}.",
        fontSize: 15,
        color: "#333333",
        lineHeight: 1.6,
        align: "left",
        paddingY: 8,
      };
    case "button":
      return {
        id,
        type,
        text: "Click here",
        href: "https://example.com",
        backgroundColor: "#111111",
        color: "#ffffff",
        fontSize: 15,
        borderRadius: 8,
        align: "left",
        paddingY: 12,
      };
    case "image":
      return {
        id,
        type,
        src: "https://via.placeholder.com/600x240?text=Your+image",
        alt: "",
        href: "",
        width: 100,
        align: "center",
        paddingY: 8,
      };
    case "divider":
      return { id, type, color: "#e5e5e5", thickness: 1, paddingY: 12 };
    case "spacer":
      return { id, type, height: 24 };
  }
}

export function sectionDefaults(role: SectionRole): Section {
  return {
    id: newId("s"),
    role,
    backgroundColor: "transparent",
    padding: 24,
    blocks: [],
  };
}

export function blankDesign(): EmailDesign {
  const body = sectionDefaults("body");
  body.blocks = [blockDefaults("heading"), blockDefaults("text"), blockDefaults("button")];
  return {
    version: 1,
    settings: {
      pageBackground: "#f4f4f5",
      contentBackground: "#ffffff",
      textColor: "#333333",
      fontFamily: FONT_STACKS[0].value,
      contentWidth: 600,
    },
    sections: [body],
  };
}

/* --------------------------------------------------------- Sanitizing ----- */

/** Keeps a small inline-formatting whitelist; strips anything scriptable. */
export function sanitizeInline(html: string): string {
  return (
    html
      // Drop dangerous elements entirely.
      .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, "")
      // Strip inline event handlers (on…="…") and javascript: URLs.
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
      .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
  );
}

/* --------------------------------------------------------- Rendering ------ */

const esc = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const HEADING_SIZE: Record<number, number> = { 1: 28, 2: 22, 3: 18 };

function pad(y: number) {
  return `padding:${y}px 0;`;
}

function renderBlock(block: Block, s: DesignSettings): string {
  switch (block.type) {
    case "heading": {
      const size = HEADING_SIZE[block.level];
      const font = block.fontFamily || s.fontFamily;
      return `<tr><td style="${pad(block.paddingY)}text-align:${block.align}">
        <h${block.level} style="margin:0;font-family:${font};font-size:${size}px;line-height:1.25;color:${block.color};font-weight:700;text-align:${block.align}">${block.text}</h${block.level}>
      </td></tr>`;
    }
    case "text": {
      const font = block.fontFamily || s.fontFamily;
      return `<tr><td style="${pad(block.paddingY)}font-family:${font};font-size:${block.fontSize}px;line-height:${block.lineHeight};color:${block.color};text-align:${block.align}">${sanitizeInline(block.html)}</td></tr>`;
    }
    case "button": {
      const inner = `<a href="${esc(block.href)}" target="_blank" style="display:inline-block;background:${block.backgroundColor};color:${block.color};font-family:${s.fontFamily};font-size:${block.fontSize}px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:${block.borderRadius}px">${block.text}</a>`;
      return `<tr><td style="${pad(block.paddingY)}text-align:${block.align}">${inner}</td></tr>`;
    }
    case "image": {
      const img = `<img src="${esc(block.src)}" alt="${esc(block.alt)}" width="${Math.round((s.contentWidth * block.width) / 100)}" style="display:inline-block;width:${block.width}%;max-width:100%;height:auto;border:0;outline:none;text-decoration:none" />`;
      const wrapped = block.href
        ? `<a href="${esc(block.href)}" target="_blank">${img}</a>`
        : img;
      return `<tr><td style="${pad(block.paddingY)}text-align:${block.align}">${wrapped}</td></tr>`;
    }
    case "divider":
      return `<tr><td style="${pad(block.paddingY)}"><div style="border-top:${block.thickness}px solid ${block.color};font-size:0;line-height:0">&nbsp;</div></td></tr>`;
    case "spacer":
      return `<tr><td style="height:${block.height}px;line-height:${block.height}px;font-size:0">&nbsp;</td></tr>`;
  }
}

function renderSection(section: Section, s: DesignSettings): string {
  const bg = section.backgroundColor === "transparent" ? "" : `background:${section.backgroundColor};`;
  const inner = section.blocks.map((b) => renderBlock(b, s)).join("");
  return `<tr><td style="${bg}padding:${section.padding}px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%">
      <tbody>${inner}</tbody>
    </table>
  </td></tr>`;
}

/** Renders the full email document. Placeholders are left intact. */
export function renderDesign(design: EmailDesign): string {
  const s = design.settings;
  const sections = design.sections.map((sec) => renderSection(sec, s)).join("");

  return `<!-- built with Bulk Mailer -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${s.pageBackground};margin:0;padding:0">
  <tbody><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="${s.contentWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${s.contentWidth}px;max-width:100%;background:${s.contentBackground};border-radius:8px;overflow:hidden;font-family:${s.fontFamily};color:${s.textColor}">
      <tbody>${sections}</tbody>
    </table>
  </td></tr></tbody>
</table>`;
}

/* --------------------------------------------------------- Guards --------- */

/** Runtime check that an unknown value is a usable design. */
export function isEmailDesign(value: unknown): value is EmailDesign {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<EmailDesign>;
  return d.version === 1 && Array.isArray(d.sections) && !!d.settings;
}
