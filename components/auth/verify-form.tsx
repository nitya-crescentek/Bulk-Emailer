"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/client";

export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      toast.success("Email verified");
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
      await api("/api/auth/resend", {
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
      title="Verify your email"
      description={
        <>
          Enter the 6-digit code we sent to <strong>{email}</strong>.
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Verification code</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="text-center text-lg tracking-[0.5em]"
            required
          />
        </div>
        <Button type="submit" disabled={busy || code.length !== 6}>
          {busy ? "Verifying…" : "Verify & continue"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={resend}
          disabled={resending}
        >
          {resending ? "Sending…" : "Resend code"}
        </Button>
      </form>
    </AuthCard>
  );
}
