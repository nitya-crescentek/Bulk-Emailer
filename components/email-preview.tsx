"use client";

/**
 * Renders email HTML in a sandboxed iframe so the app's own styles (and any
 * scripts in the template) cannot leak in either direction.
 */
export function EmailPreview({
  html,
  className = "h-[420px]",
}: {
  html: string;
  className?: string;
}) {
  const doc = `<!doctype html><html><head><meta charset="utf-8" />
<style>
  body { margin:0; padding:16px; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:1.55; color:#111; background:#fff; }
  img { max-width:100%; }
  mark { background:#fde68a; border-radius:3px; padding:0 2px; }
</style></head><body>${html}</body></html>`;

  return (
    <iframe
      title="Email preview"
      sandbox=""
      srcDoc={doc}
      className={`w-full rounded-lg border bg-white ${className}`}
    />
  );
}
