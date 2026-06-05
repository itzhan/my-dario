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
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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
