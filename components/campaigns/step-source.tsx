"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2Icon, DownloadIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/client";
import { autoBind, extractVariables, guessEmailColumn } from "@/lib/template";
import type { SourcePreview } from "@/lib/types";
import type { Patch, WizardState } from "./wizard-types";

export function StepSource({
  state,
  patch,
}: {
  state: WizardState;
  patch: Patch;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function accept(source: SourcePreview) {
    const variables = extractVariables(state.subject, state.html);
    patch({
      source,
      name: state.name || defaultName(source.label),
      mapping: {
        email: guessEmailColumn(source.columns),
        cc: undefined,
        bcc: undefined,
        variables: autoBind(variables, source.columns),
      },
    });
    toast.success(`Imported ${source.rowCount.toLocaleString()} rows`);
  }

  async function importUrl() {
    setLoading(true);
    try {
      accept(
        await api<SourcePreview>("/api/source/preview", {
          method: "POST",
          body: JSON.stringify({ url }),
        })
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function importFile(file: File) {
    setLoading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      accept(
        await api<SourcePreview>("/api/source/preview", { method: "POST", body })
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Where is your list?</CardTitle>
          <CardDescription>
            The first row must be a header row — those column names become the
            placeholders you can drop into the email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="link">
            <TabsList>
              <TabsTrigger value="link">Google Sheet or CSV link</TabsTrigger>
              <TabsTrigger value="upload">Upload a CSV</TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="space-y-3 pt-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && url && !loading) importUrl();
                  }}
                />
                <Button onClick={importUrl} disabled={loading || !url.trim()}>
                  <DownloadIcon />
                  {loading ? "Importing…" : "Import"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share the sheet as <strong>Anyone with the link — Viewer</strong>{" "}
                first. The tab that is open in the link (its <code>gid</code>) is
                the one that gets imported.
              </p>
            </TabsContent>

            <TabsContent value="upload" className="space-y-3 pt-4">
              <Label
                htmlFor="csv-file"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/50"
              >
                <UploadIcon className="size-6 text-muted-foreground" />
                <span className="text-sm font-medium">Choose a .csv file</span>
                <span className="text-xs text-muted-foreground">
                  Up to 15 MB. Nothing is uploaded anywhere but your own MongoDB.
                </span>
              </Label>
              <input
                id="csv-file"
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importFile(file);
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {state.source ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-emerald-600" />
              {state.source.label}
            </CardTitle>
            <CardDescription>
              {state.source.rowCount.toLocaleString()} rows ·{" "}
              {state.source.columns.length} columns · showing the first{" "}
              {state.source.rows.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {state.source.columns.map((column) => (
                      <TableHead key={column} className="whitespace-nowrap">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.source.rows.map((row, i) => (
                    <TableRow key={i}>
                      {state.source!.columns.map((column) => (
                        <TableCell
                          key={column}
                          className="max-w-56 truncate whitespace-nowrap text-xs"
                        >
                          {row[column]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function defaultName(label: string): string {
  const date = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  return `${label.replace(/\.csv$/i, "")} — ${date}`;
}
