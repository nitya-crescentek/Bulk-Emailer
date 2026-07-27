"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2Icon, SaveIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { api, errorMessage, formatDate } from "@/lib/client";
import type { PublicUser } from "@/lib/auth";

export function AccountForm({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [company, setCompany] = useState(user.company ?? "");
  const [timezone, setTimezone] = useState(user.timezone);
  const [defaultRate, setDefaultRate] = useState(String(user.defaultRate));
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          name,
          company,
          timezone,
          defaultRate: Number(defaultRate),
        }),
      });
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await api("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {user.email}
            {user.emailVerified ? (
              <Badge
                variant="secondary"
                className="ml-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2Icon />
                Verified
              </Badge>
            ) : null}
            <span className="ml-2 text-xs">
              · joined {formatDate(user.createdAt)}
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your name and company for your own reference.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Company (optional)">
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" disabled={savingProfile} className="w-fit">
              <SaveIcon />
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card id="settings">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Defaults applied to new campaigns.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Timezone">
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="UTC"
                />
              </Field>
              <Field label="Default emails per minute">
                <Input
                  inputMode="numeric"
                  value={defaultRate}
                  onChange={(e) =>
                    setDefaultRate(e.target.value.replace(/\D/g, ""))
                  }
                />
              </Field>
            </div>
            <Button type="submit" disabled={savingProfile} className="w-fit">
              <SaveIcon />
              {savingProfile ? "Saving…" : "Save settings"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Current password">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="New password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </Field>
            </div>
            <Button type="submit" disabled={savingPassword} className="w-fit">
              {savingPassword ? "Changing…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
