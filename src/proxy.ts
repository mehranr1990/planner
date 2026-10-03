import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: sends cookie-less visitors to sign-in before rendering.
// Real authentication/authorization happens in the data access layer (src/server/*).
const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  // Sliding cookie expiry; the database session is extended in getSessionUser().
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return response;
}

export const config = {
  matcher: ["/home/:path*", "/planner/:path*", "/projects/:path*", "/team/:path*", "/settings/:path*"],
};
