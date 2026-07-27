"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import {
  FileTextIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MailIcon,
  MoonIcon,
  SendIcon,
  ServerIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, errorMessage } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/campaigns", label: "Campaigns", icon: SendIcon },
  { href: "/templates", label: "Templates", icon: FileTextIcon },
  { href: "/smtp", label: "SMTP", icon: ServerIcon },
];

export function AppNav({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (err) {
      toast.error(errorMessage(err));
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MailIcon className="size-4" />
          </span>
          Bulk Mailer
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted text-foreground"
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <SunIcon className="size-4 dark:hidden" />
            <MoonIcon className="hidden size-4 dark:block" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account menu">
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase">
                  {initials(user.name || user.email)}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate">{user.name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account">
                  <UserIcon />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account#settings">
                  <SettingsIcon />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} variant="destructive">
                <LogOutIcon />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).slice(0, 2);
  return value.slice(0, 2);
}
