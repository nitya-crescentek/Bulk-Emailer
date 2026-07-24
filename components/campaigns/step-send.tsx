"use client";

import Link from "next/link";
import { InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { SmtpProfile } from "@/lib/types";
import type { Patch, WizardState } from "./wizard-types";

export function StepSend({
  state,
  patch,
  profiles,
}: {
  state: WizardState;
  patch: Patch;
  profiles: SmtpProfile[];
}) {
  const source = state.source;
  const stats = source && state.mapping.email
    ? source.emailStats[state.mapping.email]
    : undefined;

  const willSend = stats
    ? state.dedupe
      ? stats.valid
      : stats.valid + stats.duplicates
    : 0;
  const minutes = willSend / Math.max(1, state.rateLimit);
  const profile = profiles.find((p) => p.id === state.smtpProfileId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Sending</CardTitle>
          <CardDescription>
            How the run is labelled, and how fast it goes out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Campaign name</Label>
            <Input
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Design proposals — July"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Send through</Label>
            {profiles.length === 0 ? (
              <Alert variant="destructive">
                <InfoIcon />
                <AlertTitle>No SMTP profile</AlertTitle>
                <AlertDescription>
                  <Link href="/smtp" className="underline">
                    Add one first
                  </Link>{" "}
                  — a campaign cannot be created without it.
                </AlertDescription>
              </Alert>
            ) : (
              <Select
                value={state.smtpProfileId}
                onValueChange={(value) => {
                  const next = profiles.find((p) => p.id === value);
                  patch({
                    smtpProfileId: value,
                    rateLimit: next?.rateLimit ?? state.rateLimit,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.fromEmail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Emails per minute
            </Label>
            <Input
              inputMode="numeric"
              value={state.rateLimit}
              onChange={(e) =>
                patch({ rateLimit: Number(e.target.value.replace(/\D/g, "")) || 0 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Stay under your provider&apos;s limit — Gmail and Workspace
              accounts throttle hard above roughly 30/minute.
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-lg border p-3">
            <Switch
              checked={state.dedupe}
              onCheckedChange={(checked) => patch({ dedupe: checked })}
            />
            <span className="text-sm">
              Skip duplicate addresses
              <span className="block text-xs text-muted-foreground">
                Only the first row for each address is sent.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ready to create</CardTitle>
          <CardDescription>
            Nothing is sent yet — you get a preview and a Start button on the
            next screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Source</dt>
            <dd className="truncate">{source?.label ?? "—"}</dd>

            <dt className="text-muted-foreground">Rows</dt>
            <dd>{source?.rowCount.toLocaleString() ?? 0}</dd>

            <dt className="text-muted-foreground">Address column</dt>
            <dd>{state.mapping.email || "not chosen"}</dd>

            <dt className="text-muted-foreground">Will send</dt>
            <dd className="font-medium">{willSend.toLocaleString()} emails</dd>

            <dt className="text-muted-foreground">Skipped</dt>
            <dd>
              {stats
                ? (
                    stats.invalid +
                    stats.blank +
                    (state.dedupe ? stats.duplicates : 0)
                  ).toLocaleString()
                : 0}{" "}
              rows
            </dd>

            <dt className="text-muted-foreground">From</dt>
            <dd className="truncate">
              {profile ? `${profile.fromName} <${profile.fromEmail}>` : "—"}
            </dd>

            <dt className="text-muted-foreground">Est. duration</dt>
            <dd>
              {minutes < 1
                ? "under a minute"
                : `about ${Math.ceil(minutes)} minutes`}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
