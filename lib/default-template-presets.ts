import type { EmailDesign } from "./email-design";

/**
 * The built-in starter designs, as pure data with only a type import — so they
 * can be consumed by the app, by scripts, and by tests without pulling in the
 * renderer or the database. Built with the same block model the visual builder
 * edits, so users can open and tweak them.
 */
export interface TemplatePreset {
  name: string;
  subject: string;
  design: EmailDesign;
}

const NEWSLETTER: EmailDesign = {
  version: 1,
  settings: {
    pageBackground: "#eef2f7",
    contentBackground: "#ffffff",
    textColor: "#334155",
    fontFamily: "Arial, Helvetica, sans-serif",
    contentWidth: 600,
  },
  sections: [
    {
      id: "s-head",
      role: "header",
      backgroundColor: "#0f172a",
      padding: 28,
      blocks: [
        { id: "h-brand", type: "heading", text: "{{Company}} Newsletter", level: 1, color: "#ffffff", align: "center", paddingY: 4 },
        { id: "h-tag", type: "text", html: "News, tips and updates for {{First Name}}", fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, align: "center", paddingY: 4 },
      ],
    },
    {
      id: "s-body",
      role: "body",
      backgroundColor: "transparent",
      padding: 32,
      blocks: [
        { id: "b-h", type: "heading", text: "This month's highlights", level: 2, color: "#0f172a", align: "left", paddingY: 6 },
        { id: "b-t", type: "text", html: "Hi {{First Name}},<br /><br />Here's what's new. Swap this text for your story, and use the button below to send readers wherever you like.", fontSize: 15, color: "#334155", lineHeight: 1.65, align: "left", paddingY: 6 },
        { id: "b-img", type: "image", src: "https://via.placeholder.com/536x220?text=Featured", alt: "Featured", href: "", width: 100, align: "center", paddingY: 10 },
        { id: "b-btn", type: "button", text: "Read more", href: "https://example.com", backgroundColor: "#2563eb", color: "#ffffff", fontSize: 15, borderRadius: 8, align: "left", paddingY: 14 },
        { id: "b-div", type: "divider", color: "#e2e8f0", thickness: 1, paddingY: 18 },
        { id: "b-t2", type: "text", html: "<b>Quick links</b><br />• Product updates<br />• From the blog<br />• What we're reading", fontSize: 14, color: "#475569", lineHeight: 1.7, align: "left", paddingY: 6 },
      ],
    },
    {
      id: "s-foot",
      role: "footer",
      backgroundColor: "#f1f5f9",
      padding: 24,
      blocks: [
        { id: "f-t", type: "text", html: "You're receiving this because you're on the {{Company}} list.<br />Reply to this email to get in touch.", fontSize: 12, color: "#94a3b8", lineHeight: 1.6, align: "center", paddingY: 4 },
      ],
    },
  ],
};

const LATEST_UPDATE: EmailDesign = {
  version: 1,
  settings: {
    pageBackground: "#f8fafc",
    contentBackground: "#ffffff",
    textColor: "#1f2937",
    fontFamily: "Helvetica, Arial, sans-serif",
    contentWidth: 600,
  },
  sections: [
    {
      id: "u-head",
      role: "header",
      backgroundColor: "transparent",
      padding: 28,
      blocks: [
        { id: "u-badge", type: "text", html: "<b>PRODUCT UPDATE</b>", fontSize: 12, color: "#2563eb", lineHeight: 1.4, align: "left", paddingY: 2 },
        { id: "u-h", type: "heading", text: "What's new at {{Company}}", level: 1, color: "#111827", align: "left", paddingY: 6 },
      ],
    },
    {
      id: "u-body",
      role: "body",
      backgroundColor: "transparent",
      padding: 28,
      blocks: [
        { id: "u-t", type: "text", html: "Hi {{First Name}},<br /><br />We shipped something we think you'll like. Here's the short version:", fontSize: 15, color: "#1f2937", lineHeight: 1.65, align: "left", paddingY: 6 },
        { id: "u-t2", type: "text", html: "<b>New:</b> Describe the headline feature in a sentence.<br /><b>Improved:</b> Note a smaller win here.", fontSize: 15, color: "#374151", lineHeight: 1.7, align: "left", paddingY: 6 },
        { id: "u-btn", type: "button", text: "See what changed", href: "https://example.com/changelog", backgroundColor: "#111827", color: "#ffffff", fontSize: 15, borderRadius: 6, align: "left", paddingY: 14 },
        { id: "u-sp", type: "spacer", height: 8 },
        { id: "u-t3", type: "text", html: "Questions? Just hit reply — a real person reads every message.", fontSize: 14, color: "#6b7280", lineHeight: 1.6, align: "left", paddingY: 6 },
      ],
    },
    {
      id: "u-foot",
      role: "footer",
      backgroundColor: "transparent",
      padding: 24,
      blocks: [
        { id: "u-div", type: "divider", color: "#e5e7eb", thickness: 1, paddingY: 8 },
        { id: "u-f", type: "text", html: "{{Company}} · Sent with care", fontSize: 12, color: "#9ca3af", lineHeight: 1.5, align: "center", paddingY: 6 },
      ],
    },
  ],
};

export const DEFAULT_TEMPLATE_PRESETS: TemplatePreset[] = [
  { name: "Newsletter", subject: "{{Company}} — this month's highlights", design: NEWSLETTER },
  { name: "Latest Update", subject: "What's new at {{Company}}", design: LATEST_UPDATE },
];
