import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("fp_jwt")?.value;

  // Public routes:
  const { pathname } = req.nextUrl;
  const publicPaths = ["/login", "/favicon.ico"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p)) ||
                    pathname.startsWith("/_next") ||
                    pathname.endsWith(".png");

  if (!token && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (token && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api).*)"], // skip Next.js API routes
};
