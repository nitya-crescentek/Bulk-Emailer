"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/client";

export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/reset", {
        method: "POST",
        body: JSON.stringify({ email, code, password }),
      });
      toast.success("Password updated — you're signed in");
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      await api("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success("A new code is on its way");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      description={
        <>
          Enter the 6-digit code sent to <strong>{email}</strong>, then pick a
          new password.
        </>
      }
      footer={
        <>
          Wrong email?{" "}
          <Link
            href={`/forgot-password?email=${encodeURIComponent(email)}`}
            className="text-foreground underline"
          >
            Start over
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Reset code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="text-center text-lg tracking-[0.5em]"
            autoFocus
            required
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={mismatch}
            required
          />
          {mismatch ? (
            <p className="text-xs text-destructive">The passwords don&apos;t match.</p>
          ) : null}
        </Field>
        <Button
          type="submit"
          disabled={busy || code.length !== 6 || !password || password !== confirm}
        >
          {busy ? "Saving…" : "Reset password & sign in"}
        </Button>
        <Button type="button" variant="ghost" onClick={resend} disabled={resending}>
          {resending ? "Sending…" : "Resend code"}
        </Button>
      </form>
    </AuthCard>
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
