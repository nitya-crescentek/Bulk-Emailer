import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "bm_session";

// Anything not matched here (auth pages, static assets) is public.
const PROTECTED = ["/", "/campaigns", "/templates", "/smtp", "/account"];

/**
 * A lightweight gate: it only checks whether a session cookie is present, so it
 * stays fast and never touches the database. The real validation happens in
 * each page/route via requireUser(); this just handles the redirects.
 *
 * Bouncing signed-in users off /login and /register happens in those pages
 * instead: a cookie can outlive its session (e.g. after a password reset signs
 * out other devices), and redirecting on the cookie alone would loop between
 * "/" and "/login".
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  const isProtected = PROTECTED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isProtected && !hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on pages only — exclude API routes and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
