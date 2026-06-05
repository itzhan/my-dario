import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "dario_dash";
const MARKER = "dario-dashboard-session-v1";

/**
 * Recompute the session token with Web Crypto (middleware runs on the Edge
 * runtime — no node:crypto). HMAC-SHA256 hex is identical to what the Node
 * login route produces, so the two agree on the same cookie value.
 */
async function expectedToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(MARKER));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PUBLIC = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  // Auth disabled (no password set) → wide open, intended for loopback use.
  if (!process.env.DASHBOARD_PASSWORD) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const ok =
    cookie === (await expectedToken(process.env.AUTH_SECRET || "insecure-default-change-me"));

  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
