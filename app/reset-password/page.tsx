import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password · Bulk Mailer" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { email } = await props.searchParams;
  const value = typeof email === "string" ? email : "";
  if (!value) redirect("/forgot-password");
  return <ResetPasswordForm email={value} />;
}
