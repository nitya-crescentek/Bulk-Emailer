import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { VerifyForm } from "@/components/auth/verify-form";

export const metadata: Metadata = { title: "Verify email · Bulk Mailer" };

export default async function VerifyPage(props: PageProps<"/verify">) {
  const { email } = await props.searchParams;
  const value = typeof email === "string" ? email : "";
  if (!value) redirect("/login");
  return <VerifyForm email={value} />;
}
