"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/client";
import type { PublicUser } from "@/lib/auth";

interface LoginResult {
  ok: true;
  user?: PublicUser;
  needsVerification?: boolean;
  email?: string;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api<LoginResult>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (result.needsVerification) {
        toast.info("Verify your email to continue — we sent a new code.");
        router.push(`/verify?email=${encodeURIComponent(result.email ?? email)}`);
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your Bulk Mailer account."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="text-foreground underline">
            Create an account
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
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
