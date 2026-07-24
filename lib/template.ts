import type { FieldBinding, Mapping, Row } from "./types";

/** Matches `{{ Column Name }}` — letters, digits, spaces, _ . - are allowed. */
const PLACEHOLDER = /\{\{\s*([\w .\-]+?)\s*\}\}/g;

/** Every distinct placeholder used across the given strings, in first-seen order. */
export function extractVariables(...sources: string[]): string[] {
  const found: string[] = [];
  for (const source of sources) {
    for (const match of source.matchAll(PLACEHOLDER)) {
      const name = match[1].trim();
      if (name && !found.includes(name)) found.push(name);
    }
  }
  return found;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Guesses a column for each variable by fuzzy-matching names. */
export function autoBind(
  variables: string[],
  columns: string[]
): Record<string, FieldBinding> {
  const byNormalized = new Map(columns.map((c) => [normalize(c), c]));
  const bindings: Record<string, FieldBinding> = {};
  for (const variable of variables) {
    const key = normalize(variable);
    const exact = byNormalized.get(key);
    const partial = exact
      ? undefined
      : columns.find((c) => {
          const n = normalize(c);
          return n.includes(key) || key.includes(n);
        });
    bindings[variable] = { column: exact ?? partial ?? "", fallback: "" };
  }
  return bindings;
}

/** Picks the most likely email column. */
export function guessEmailColumn(columns: string[]): string {
  const scored = columns.map((c) => {
    const n = normalize(c);
    if (n === "email" || n === "emailaddress" || n === "mail") return [c, 3] as const;
    if (n.includes("email") || n.includes("mail")) return [c, 2] as const;
    return [c, 0] as const;
  });
  const best = scored.sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : "";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Resolves each template variable to its value for one source row. */
export function buildContext(row: Row, mapping: Mapping): Record<string, string> {
  const context: Record<string, string> = {};
  for (const [variable, binding] of Object.entries(mapping.variables ?? {})) {
    const raw = binding.column ? (row[binding.column] ?? "") : "";
    context[variable] = raw.trim() !== "" ? raw : (binding.fallback ?? "");
  }
  return context;
}

export interface RenderOptions {
  /** HTML-escape substituted values. Off for subject lines. */
  escape?: boolean;
}

export function render(
  template: string,
  context: Record<string, string>,
  { escape = false }: RenderOptions = {}
): string {
  return template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = context[name.trim()] ?? "";
    return escape ? escapeHtml(value) : value;
  });
}

/** Placeholders in the template that no row value will fill. */
export function missingVariables(
  template: string,
  context: Record<string, string>
): string[] {
  return extractVariables(template).filter((v) => !context[v]);
}

/** Crude but serviceable plain-text alternative for the multipart email. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const STARTER_TEMPLATE = `<p>Hi {{First Name}},</p>

<p>
  I came across {{Company}} and put together a short proposal on how we could
  help. Happy to walk you through it whenever suits you.
</p>

<p>
  <a href="https://example.com/proposal">View the proposal</a>
</p>

<p>
  Best,<br />
  Your Name
</p>`;
