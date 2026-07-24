"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const COOKIE = "theme";
const ONE_YEAR = 60 * 60 * 24 * 365;
const DARK_QUERY = "(prefers-color-scheme: dark)";

interface ThemeContextValue {
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  resolvedTheme: "light",
  setTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** The `<html>` class is the source of truth; this writes it and the cookie. */
function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Theme state without an inline `<script>`: the choice lives in a cookie that
 * the root layout reads, so the correct class is already in the server-rendered
 * HTML and there is nothing to flash. Only a first-ever visit from a machine
 * set to dark has to be corrected on the client.
 */
export function ThemeProvider({
  initialTheme,
  children,
}: {
  /** Whatever the server found in the cookie, or undefined on a first visit. */
  initialTheme?: Theme;
  children: ReactNode;
}) {
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => initialTheme ?? "light"
  );

  // No cookie yet — adopt the operating system's setting and remember it.
  useLayoutEffect(() => {
    if (initialTheme) return;
    apply(window.matchMedia(DARK_QUERY).matches ? "dark" : "light");
  }, [initialTheme]);

  // Keep following the OS until the user picks a side themselves.
  useEffect(() => {
    if (initialTheme) return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      apply(event.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [initialTheme]);

  const setTheme = useCallback((next: Theme) => apply(next), []);

  const value = useMemo(
    () => ({ resolvedTheme, setTheme }),
    [resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
