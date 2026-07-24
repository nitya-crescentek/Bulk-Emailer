/** Browser-side fetch wrapper: unwraps `{ error }` responses into throws. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(isForm || !init?.body ? {} : { "content-type": "application/json" }),
      ...init?.headers,
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sending: "Sending",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
  pending: "Queued",
  sent: "Sent",
  skipped: "Skipped",
};

export function formatDate(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
