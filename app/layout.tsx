import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import { ThemeProvider, type Theme } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bulk Mailer",
  description: "Send personalised bulk email from a Google Sheet or CSV.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the theme here means the class ships in the HTML — no inline
  // script, and nothing to flash before hydration.
  const stored = (await cookies()).get("theme")?.value;
  const theme: Theme | undefined =
    stored === "dark" || stored === "light" ? stored : undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ colorScheme: theme }}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${
        theme === "dark" ? "dark" : ""
      }`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider initialTheme={theme}>
          <AppNav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
