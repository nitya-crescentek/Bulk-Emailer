import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "bm_session";

// Anything not matched here (auth pages, static assets) is public.
const PROTECTED = ["/", "/campaigns", "/templates", "/smtp", "/account"];
const AUTH_PAGES = ["/login", "/register", "/verify"];

/**
 * A lightweight gate: it only checks whether a session cookie is present, so it
 * stays fast and never touches the database. The real validation happens in
 * each page/route via requireUser(); this just handles the redirects.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  const isProtected = PROTECTED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const isAuthPage = AUTH_PAGES.some((path) => pathname.startsWith(path));

  if (isProtected && !hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in? Skip the auth screens.
  if (isAuthPage && hasSession && !pathname.startsWith("/verify")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on pages only — exclude API routes and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
