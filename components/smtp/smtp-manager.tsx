"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  ServerIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, errorMessage } from "@/lib/client";
import type { SmtpProfile } from "@/lib/types";

interface FormState {
  id?: string;
  name: string;
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  rateLimit: string;
  isDefault: boolean;
}

const EMPTY: FormState = {
  name: "",
  host: "",
  port: "587",
  secure: false,
  user: "",
  password: "",
  fromName: "",
  fromEmail: "",
  replyTo: "",
  rateLimit: "30",
  isDefault: false,
};

/** Ports whose TLS mode is not a matter of opinion. */
const SECURE_BY_PORT: Record<string, boolean> = {
  "465": true,
  "587": false,
  "25": false,
  "2525": false,
};

const PRESETS = [
  { label: "Gmail / Workspace", host: "smtp.gmail.com", port: "465", secure: true },
  { label: "Outlook 365", host: "smtp.office365.com", port: "587", secure: false },
  { label: "Zoho", host: "smtp.zoho.com", port: "465", secure: true },
  { label: "Brevo", host: "smtp-relay.brevo.com", port: "587", secure: false },
  { label: "SendGrid", host: "smtp.sendgrid.net", port: "587", secure: false },
];

export function SmtpManager({ initialProfiles }: { initialProfiles: SmtpProfile[] }) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  /**
   * Implicit TLS belongs on 465 and nowhere else — using it on a STARTTLS port
   * fails with an opaque "wrong version number", so follow the port.
   */
  function setPort(port: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const known = SECURE_BY_PORT[port];
      return { ...prev, port, secure: known ?? prev.secure };
    });
  }

  function openNew() {
    setTestTo("");
    setForm({ ...EMPTY, isDefault: profiles.length === 0 });
  }

  function openEdit(profile: SmtpProfile) {
    setTestTo("");
    setForm({
      id: profile.id,
      name: profile.name,
      host: profile.host,
      port: String(profile.port),
      secure: profile.secure,
      user: profile.user,
      password: "",
      fromName: profile.fromName,
      fromEmail: profile.fromEmail,
      replyTo: profile.replyTo ?? "",
      rateLimit: String(profile.rateLimit),
      isDefault: profile.isDefault,
    });
  }

  function payload(state: FormState) {
    return {
      name: state.name,
      host: state.host,
      port: Number(state.port),
      secure: state.secure,
      user: state.user,
      password: state.password,
      fromName: state.fromName,
      fromEmail: state.fromEmail,
      replyTo: state.replyTo,
      rateLimit: Number(state.rateLimit),
      isDefault: state.isDefault,
    };
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const body = JSON.stringify(payload(form));
      const result = form.id
        ? await api<{ profile: SmtpProfile }>(`/api/smtp/${form.id}`, {
            method: "PUT",
            body,
          })
        : await api<{ profile: SmtpProfile }>("/api/smtp", { method: "POST", body });

      setProfiles((prev) => {
        const next = form.id
          ? prev.map((p) => (p.id === form.id ? result.profile : p))
          : [...prev, result.profile];
        return next
          .map((p) =>
            result.profile.isDefault && p.id !== result.profile.id
              ? { ...p, isDefault: false }
              : p
          )
          .sort((a, b) => a.name.localeCompare(b.name));
      });
      toast.success(form.id ? "Profile updated" : "Profile saved");
      setForm(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!form) return;
    setTesting(true);
    try {
      const body = form.password
        ? { ...payload(form), to: testTo }
        : { profileId: form.id, to: testTo };
      const result = await api<{ sent: boolean }>("/api/smtp/test", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(
        result.sent ? `Test email sent to ${testTo}` : "Connection and login OK"
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(false);
    }
  }

  async function remove(profile: SmtpProfile) {
    if (!confirm(`Delete the SMTP profile "${profile.name}"?`)) return;
    try {
      await api(`/api/smtp/${profile.id}`, { method: "DELETE" });
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      toast.success("Profile deleted");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}>
          <PlusIcon />
          Add profile
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ServerIcon className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No SMTP profiles yet</p>
              <p className="text-sm text-muted-foreground">
                Add the mailbox your campaigns should send from.
              </p>
            </div>
            <Button onClick={openNew} variant="outline">
              <PlusIcon />
              Add profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {profile.name}
                  {profile.isDefault ? (
                    <Badge variant="secondary">Default</Badge>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  {profile.host}:{profile.port} · {profile.secure ? "SSL" : "STARTTLS"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">From</dt>
                  <dd className="truncate">
                    {profile.fromName ? `${profile.fromName} · ` : ""}
                    {profile.fromEmail}
                  </dd>
                  <dt className="text-muted-foreground">Username</dt>
                  <dd className="truncate">{profile.user}</dd>
                  <dt className="text-muted-foreground">Rate</dt>
                  <dd>{profile.rateLimit} emails / minute</dd>
                </dl>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(profile)}>
                    <PencilIcon />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(profile)}
                  >
                    <Trash2Icon />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit SMTP profile" : "New SMTP profile"}</DialogTitle>
            <DialogDescription>
              Credentials are encrypted with <code>APP_SECRET</code> before they
              are written to MongoDB.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              host: preset.host,
                              port: preset.port,
                              secure: preset.secure,
                            }
                          : prev
                      )
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <Field label="Profile name">
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Work mailbox"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <Field label="SMTP host">
                  <Input
                    value={form.host}
                    onChange={(e) => set("host", e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </Field>
                <Field label="Port">
                  <Input
                    inputMode="numeric"
                    value={form.port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </Field>
              </div>

              <label className="flex items-center gap-3 rounded-lg border p-3">
                <Switch
                  checked={form.secure}
                  onCheckedChange={(checked) => set("secure", checked)}
                />
                <span className="text-sm">
                  Implicit TLS (SSL)
                  <span className="block text-xs text-muted-foreground">
                    On for port 465. Leave off for 587 / 25, which upgrade with
                    STARTTLS.
                  </span>
                  {SECURE_BY_PORT[form.port] !== undefined &&
                  SECURE_BY_PORT[form.port] !== form.secure ? (
                    <span className="mt-1 block text-xs text-destructive">
                      Port {form.port} expects this{" "}
                      {SECURE_BY_PORT[form.port] ? "on" : "off"}. The other way
                      round fails with &quot;wrong version number&quot;.
                    </span>
                  ) : null}
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Username">
                  <Input
                    value={form.user}
                    onChange={(e) => set("user", e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label={form.id ? "Password (leave blank to keep)" : "Password"}
                >
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From name">
                  <Input
                    value={form.fromName}
                    onChange={(e) => set("fromName", e.target.value)}
                    placeholder="Nitya"
                  />
                </Field>
                <Field label="From address">
                  <Input
                    value={form.fromEmail}
                    onChange={(e) => set("fromEmail", e.target.value)}
                    placeholder="you@company.com"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Reply-to (optional)">
                  <Input
                    value={form.replyTo}
                    onChange={(e) => set("replyTo", e.target.value)}
                  />
                </Field>
                <Field label="Emails per minute">
                  <Input
                    inputMode="numeric"
                    value={form.rateLimit}
                    onChange={(e) => set("rateLimit", e.target.value)}
                  />
                </Field>
              </div>

              <label className="flex items-center gap-3 rounded-lg border p-3">
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={(checked) => set("isDefault", checked)}
                />
                <span className="text-sm">Use as the default profile</span>
              </label>

              <div className="rounded-lg border bg-muted/40 p-3">
                <Label className="text-xs text-muted-foreground">
                  Test the connection
                </Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="Send a test to… (optional)"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={runTest}
                    disabled={testing}
                  >
                    {testing ? "Testing…" : <><SendIcon />Test</>}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Leave the address blank to only verify the login.
                  {form.id && !form.password
                    ? " The saved password will be used."
                    : null}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : <><CheckCircle2Icon />Save profile</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
