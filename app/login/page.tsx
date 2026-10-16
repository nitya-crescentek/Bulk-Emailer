import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in · Bulk Mailer" };

export default async function LoginPage() {
  // Already signed in? Skip the auth screen.
  if (await getCurrentUser()) redirect("/");
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
