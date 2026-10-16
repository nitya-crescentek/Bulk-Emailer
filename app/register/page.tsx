import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account · Bulk Mailer" };

export default async function RegisterPage() {
  // Already signed in? Skip the auth screen.
  if (await getCurrentUser()) redirect("/");
  return <RegisterForm />;
}
