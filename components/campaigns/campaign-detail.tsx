"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CopyIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { EmailPreview } from "@/components/email-preview";
import { StatusBadge } from "@/components/status-badge";
import { RecipientTable } from "@/components/campaigns/recipient-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage, formatDate } from "@/lib/client";
import type { Campaign } from "@/lib/types";

interface PreviewData {
  index: number;
  to: string;
  subject: string;
  html: string;
  missing: string[];
}

const POLL_MS = 2000;

export function CampaignDetail({ initial }: { initial: Campaign }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [testTo, setTestTo] = useState("");

  const { stats } = campaign;
  const finished = stats.sent + stats.failed + stats.skipped;
  const percent = stats.total ? Math.round((finished / stats.total) * 100) : 0;
  const live = campaign.status === "sending";

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ campaign: Campaign }>(
        `/api/campaigns/${initial.id}`
      );
      setCampaign(data.campaign);
      setTick((t) => t + 1);
    } catch {
      // A transient poll failure is not worth interrupting the user over.
    }
  }, [initial.id]);

  // Poll only while the run is actually moving.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [live, refresh]);

  useEffect(() => {
    api<PreviewData>(`/api/campaigns/${initial.id}/preview?index=1`)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [initial.id]);

  async function control(action: "start" | "pause" | "retry-failed") {
    setBusy(true);
    try {
      await api(`/api/campaigns/${campaign.id}/send`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast.success(
        action === "pause"
          ? "Pausing after the current email"
          : action === "retry-failed"
            ? "Retrying failed rows"
            : "Sending started"
      );
      setTimeout(refresh, 400);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      await api(`/api/campaigns/${campaign.id}/test`, {
        method: "POST",
        body: JSON.stringify({ to: testTo, index: preview?.index ?? 1 }),
      });
      toast.success(`Test sent to ${testTo}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${campaign.name}" and its send log?`)) return;
    try {
      await api(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      toast.success("Campaign deleted");
      router.push("/campaigns");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const { campaign: copy } = await api<{ campaign: Campaign }>(
        `/api/campaigns/${campaign.id}/duplicate`,
        { method: "POST" }
      );
      toast.success("Copied to a new draft");
      router.push(`/campaigns/${copy.id}`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  const isDraft = campaign.status === "draft";

  return (
    <div className="space-y-6">
      {campaign.error ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Sending stopped</AlertTitle>
          <AlertDescription>{campaign.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Progress
            <StatusBadge status={campaign.status} />
          </CardTitle>
          <CardDescription>
            {campaign.sourceLabel} · sending through{" "}
            {campaign.smtpProfileName ?? "a deleted profile"} at{" "}
            {campaign.rateLimit}/minute
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={percent} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Total" value={stats.total} />
            <Stat label="Sent" value={stats.sent} tone="text-emerald-600" />
            <Stat label="Queued" value={stats.pending} />
            <Stat label="Failed" value={stats.failed} tone="text-destructive" />
            <Stat label="Skipped" value={stats.skipped} />
          </div>

          <div className="flex flex-wrap gap-2">
            {live ? (
              <Button onClick={() => control("pause")} disabled={busy} variant="outline">
                <PauseIcon />
                Pause
              </Button>
            ) : (
              <Button
                onClick={() => control("start")}
                disabled={busy || stats.pending === 0}
              >
                <PlayIcon />
                {stats.sent > 0 ? "Resume sending" : "Start sending"}
              </Button>
            )}

            {stats.failed > 0 && !live ? (
              <Button
                variant="outline"
                onClick={() => control("retry-failed")}
                disabled={busy}
              >
                <RotateCcwIcon />
                Retry {stats.failed} failed
              </Button>
            ) : null}

            {isDraft ? (
              <Button asChild variant="outline">
                <Link href={`/campaigns/${campaign.id}/edit`}>
                  <PencilIcon />
                  Edit
                </Link>
              </Button>
            ) : null}

            {!isDraft && !live ? (
              <>
                <Button asChild variant="outline">
                  <Link href={`/campaigns/${campaign.id}/edit`}>
                    <PencilIcon />
                    Edit email
                  </Link>
                </Button>
                <Button variant="outline" onClick={duplicate} disabled={busy}>
                  <CopyIcon />
                  Duplicate & resend
                </Button>
              </>
            ) : null}

            <Button variant="destructive" onClick={remove} disabled={live}>
              <Trash2Icon />
              Delete
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Created {formatDate(campaign.createdAt)}
            {campaign.startedAt ? ` · started ${formatDate(campaign.startedAt)}` : ""}
            {campaign.finishedAt
              ? ` · finished ${formatDate(campaign.finishedAt)}`
              : ""}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="recipients">
        <TabsList>
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="recipients" className="pt-4">
          <RecipientTable campaignId={campaign.id} refreshKey={tick} />
        </TabsContent>

        <TabsContent value="email" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardHeader>
                <CardTitle className="truncate">
                  {preview?.subject ?? campaign.subject}
                </CardTitle>
                <CardDescription>
                  Rendered with row {preview?.index ?? 1}
                  {preview?.to ? ` · ${preview.to}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {preview?.missing.length ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Empty for this row: {preview.missing.join(", ")}
                  </p>
                ) : null}
                <EmailPreview
                  html={preview?.html ?? campaign.html}
                  className="h-[520px]"
                />
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Send a test</CardTitle>
                <CardDescription>
                  Delivers this exact email to one address without touching the
                  queue.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="you@company.com"
                />
                <Button
                  className="w-full"
                  onClick={sendTest}
                  disabled={busy || !testTo.trim()}
                >
                  <SendIcon />
                  Send test
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className={`text-xl font-semibold tabular-nums ${tone}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
