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

export function ForgotPasswordForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success("If that email has an account, a reset code is on its way");
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we'll send you a 6-digit code."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-foreground underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send reset code"}
        </Button>
      </form>
    </AuthCard>
  );
}
