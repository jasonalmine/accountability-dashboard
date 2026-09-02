import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, readSession } from "@/lib/auth";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`. A file named
 * middleware.ts here would simply never run, leaving the dashboard — and the
 * roster of real people behind it — open to anyone with the URL.
 */
export async function proxy(request: NextRequest) {
  if (await readSession(request.cookies.get(AUTH_COOKIE)?.value)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Only the facilitator dashboard is gated. Members land on / and check in
  // via a capability token, which is their credential; neither needs a password.
  matcher: ["/dashboard/:path*"],
};
