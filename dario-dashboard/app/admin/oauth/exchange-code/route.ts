import { NextResponse } from "next/server";
import {
  loadOAuthConfig,
  parsePastedCode,
  takePending,
  MANUAL_REDIRECT_URI,
} from "@/lib/cc-oauth";
import { adminKeyOk } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Step 2 of the machine OAuth add: take {session_id, code}, recover the PKCE
// verifier, exchange the code for tokens, and return the credentials. Does
// NOT write the account — the caller posts them to /admin/accounts next.
export async function POST(req: Request) {
  if (!adminKeyOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { session_id?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const pending = takePending(body.session_id ?? "");
  if (!pending) {
    return NextResponse.json(
      { error: "no pending authorization for session_id (expired?) — call generate-auth-url again" },
      { status: 400 },
    );
  }

  const { code, state } = parsePastedCode(body.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "no authorization code provided" }, { status: 400 });
  }
  if (state && state !== pending.state) {
    return NextResponse.json(
      { error: "state mismatch — the code is from a different authorization" },
      { status: 400 },
    );
  }

  const cfg = loadOAuthConfig();
  let tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };
  try {
    const res = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: cfg.clientId,
        code,
        redirect_uri: MANUAL_REDIRECT_URI,
        code_verifier: pending.codeVerifier,
        state: pending.state,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `token exchange failed (${res.status})`, detail: t.slice(0, 300) },
        { status: 502 },
      );
    }
    tokens = await res.json();
  } catch (err) {
    return NextResponse.json(
      { error: `token exchange request failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    // ms epoch — matches dario's AccountCredentials.expiresAt.
    expires_at: Date.now() + (tokens.expires_in ?? 0) * 1000,
    scopes: tokens.scope ? tokens.scope.split(" ") : cfg.scopes.split(" "),
  });
}
