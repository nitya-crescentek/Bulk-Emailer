"use client";

import { useMemo, useState } from "react";
import { AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailPreview } from "@/components/email-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildContext, extractVariables, render } from "@/lib/template";
import type { FieldBinding } from "@/lib/types";
import { NONE, type Patch, type WizardState } from "./wizard-types";

export function StepMapping({
  state,
  patch,
}: {
  state: WizardState;
  patch: Patch;
}) {
  const [rowIndex, setRowIndex] = useState(0);
  const source = state.source;

  const variables = useMemo(
    () => extractVariables(state.subject, state.html),
    [state.subject, state.html]
  );

  const row = source?.rows[rowIndex];
  const context = useMemo(
    () => (row ? buildContext(row, state.mapping) : {}),
    [row, state.mapping]
  );

  const unbound = variables.filter((v) => !state.mapping.variables[v]?.column);
  const emptyForRow = variables.filter((v) => !context[v]);

  if (!source) return null;

  const emailStats = state.mapping.email
    ? source.emailStats[state.mapping.email]
    : undefined;

  function setBinding(variable: string, binding: Partial<FieldBinding>) {
    patch({
      mapping: {
        ...state.mapping,
        variables: {
          ...state.mapping.variables,
          [variable]: { ...state.mapping.variables[variable], ...binding },
        },
      },
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Recipient address</CardTitle>
            <CardDescription>
              Which column holds the address each email goes to.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Select
                value={state.mapping.email || NONE}
                onValueChange={(value) =>
                  patch({
                    mapping: {
                      ...state.mapping,
                      email: value === NONE ? "" : value,
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a column" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Choose a column</SelectItem>
                  {source.columns.map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                      {source.emailStats[column]?.valid
                        ? ` — ${source.emailStats[column].valid} valid`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {emailStats ? (
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <Stat label="Valid" value={emailStats.valid} tone="text-emerald-600" />
                <Stat label="Duplicates" value={emailStats.duplicates} />
                <Stat label="Invalid" value={emailStats.invalid} />
                <Stat label="Blank" value={emailStats.blank} />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <OptionalColumn
                label="Cc column (optional)"
                value={state.mapping.cc}
                columns={source.columns}
                onChange={(cc) => patch({ mapping: { ...state.mapping, cc } })}
              />
              <OptionalColumn
                label="Bcc column (optional)"
                value={state.mapping.bcc}
                columns={source.columns}
                onChange={(bcc) => patch({ mapping: { ...state.mapping, bcc } })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Placeholders</CardTitle>
            <CardDescription>
              Point each placeholder at a column. A fallback is used when that
              cell is empty.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {variables.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                This email has no placeholders — nothing to map.
              </p>
            ) : (
              variables.map((variable) => {
                const binding = state.mapping.variables[variable] ?? {};
                return (
                  <div
                    key={variable}
                    className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
                  >
                    <code className="truncate rounded-md bg-muted px-2 py-1.5 text-xs">
                      {`{{${variable}}}`}
                    </code>
                    <Select
                      value={binding.column || NONE}
                      onValueChange={(value) =>
                        setBinding(variable, {
                          column: value === NONE ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not mapped</SelectItem>
                        {source.columns.map((column) => (
                          <SelectItem key={column} value={column}>
                            {column}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={binding.fallback ?? ""}
                      onChange={(e) =>
                        setBinding(variable, { fallback: e.target.value })
                      }
                      placeholder="Fallback"
                    />
                  </div>
                );
              })
            )}

            {unbound.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangleIcon />
                <AlertTitle>
                  {unbound.length} placeholder{unbound.length === 1 ? "" : "s"} not
                  mapped
                </AlertTitle>
                <AlertDescription>
                  {unbound.join(", ")} will be replaced with the fallback, or with
                  nothing at all.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle>Preview with real data</CardTitle>
          <CardDescription>
            Row {rowIndex + 1} of the first {source.rows.length} ·{" "}
            {row?.[state.mapping.email] || "no address"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setRowIndex((i) => Math.max(0, i - 1))}
              disabled={rowIndex === 0}
              aria-label="Previous row"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setRowIndex((i) => Math.min(source.rows.length - 1, i + 1))
              }
              disabled={rowIndex >= source.rows.length - 1}
              aria-label="Next row"
            >
              <ChevronRightIcon />
            </Button>
            <p className="truncate text-sm">
              <span className="text-muted-foreground">Subject: </span>
              {render(state.subject, context) || "—"}
            </p>
          </div>

          {emptyForRow.length > 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Empty for this row: {emptyForRow.join(", ")}
            </p>
          ) : null}

          <EmailPreview
            html={render(state.html, context, { escape: true })}
            className="h-[460px]"
          />
        </CardContent>
      </Card>
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
    <div className="rounded-lg border py-2">
      <p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function OptionalColumn({
  label,
  value,
  columns,
  onChange,
}: {
  label: string;
  value?: string;
  columns: string[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={value || NONE}
        onValueChange={(next) => onChange(next === NONE ? undefined : next)}
      >
        <SelectTrigger>
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {columns.map((column) => (
            <SelectItem key={column} value={column}>
              {column}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
