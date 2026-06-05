import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authEnabled,
  passwordMatches,
  sessionToken,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!authEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }
  let password = "";
  try {
    password = (await req.json())?.password ?? "";
  } catch {
    /* empty */
  }
  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  // Mark the cookie Secure only when the request actually arrived over HTTPS.
  // Keying off NODE_ENV instead would set Secure on a plain-HTTP production
  // deploy, and browsers silently drop a Secure cookie sent over HTTP — the
  // user logs in, the cookie never persists, and every page bounces back to
  // /login. x-forwarded-proto picks up TLS terminated at a reverse proxy.
  const proto =
    req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

// Logout.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
