"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, errorMessage, formatDate } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Recipient, RecipientStatus } from "@/lib/types";

const FILTERS: { value: RecipientStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Queued" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
];

interface Page {
  recipients: Recipient[];
  page: number;
  pageCount: number;
  total: number;
}

export function RecipientTable({
  campaignId,
  refreshKey,
}: {
  campaignId: string;
  /** Bump to reload — the detail page changes it while sending. */
  refreshKey: number;
}) {
  const [status, setStatus] = useState<RecipientStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (status !== "all") params.set("status", status);
      if (query.trim()) params.set("q", query.trim());
      try {
        const result = await api<Page>(
          `/api/campaigns/${campaignId}/recipients?${params}`
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) toast.error(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [campaignId, page, query, status, refreshKey]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={status === filter.value ? "secondary" : "ghost"}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search addresses…"
          className="ml-auto w-56"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-44">Sent at</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.recipients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {loading ? "Loading…" : "Nothing matches that filter."}
                </TableCell>
              </TableRow>
            ) : (
              data?.recipients.map((recipient) => (
                <TableRow key={recipient.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {recipient.index}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {recipient.email || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={recipient.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {recipient.sentAt ? formatDate(recipient.sentAt) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-md truncate text-xs",
                      recipient.status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                    title={recipient.error ?? recipient.messageId ?? ""}
                  >
                    {recipient.error ?? recipient.messageId ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.pageCount} · {data.total.toLocaleString()}{" "}
            rows
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={data.page >= data.pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
