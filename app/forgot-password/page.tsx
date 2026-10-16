import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password · Bulk Mailer" };

export default async function ForgotPasswordPage(props: PageProps<"/forgot-password">) {
  const { email } = await props.searchParams;
  return <ForgotPasswordForm defaultEmail={typeof email === "string" ? email : ""} />;
}
