import { NextResponse, type NextRequest } from "next/server";
import { readSessionFromCookie, SESSION_COOKIE } from "@/lib/session-core";

const protectedRoutes = ["/dashboard", "/admin", "/chat"];
const authRoutes = ["/login/customer", "/login/agent"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSessionFromCookie(
    request.cookies.get(SESSION_COOKIE)?.value
  );
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.includes(pathname);

  if (isProtectedRoute && !session) {
    const loginPath = pathname.startsWith("/admin")
      ? "/login/agent"
      : "/login/customer";

    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  if (pathname.startsWith("/admin") && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/chat",
    "/login/customer",
    "/login/agent"
  ]
};
