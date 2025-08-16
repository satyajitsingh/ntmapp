import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip internal assets & static files
  if (pathname.startsWith("/api")) return NextResponse.next();

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Add cache-busting headers for all other responses (HTML/pages, APIs)
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.set("X-Robots-Tag", "noarchive");
  return res;
}
