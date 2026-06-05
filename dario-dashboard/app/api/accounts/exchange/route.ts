import { NextResponse } from "next/server";
import {
  loadOAuthConfig,
  parsePastedCode,
  takePending,
  MANUAL_REDIRECT_URI,
} from "@/lib/cc-oauth";
import {
  safeAlias,
  validateProxyUrl,
  detectClaudeIdentity,
  loadAccountFile,
  writeAccountFile,
  type DarioAccount,
} from "@/lib/accounts-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Step 2 of the manual OAuth add: take the pasted code#state, exchange it for
// tokens (PKCE verifier recovered from the pending store), and write the
// account file. Takes effect on the next `dario proxy` restart.
export async function POST(req: Request) {
  let body: { alias?: string; pasted?: string; proxy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const alias = safeAlias(body.alias ?? "");
  if (!alias) {
    return NextResponse.json({ error: "invalid alias" }, { status: 400 });
  }

  let proxy: string | null;
  try {
    proxy = validateProxyUrl(body.proxy);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const pending = takePending(alias);
  if (!pending) {
    return NextResponse.json(
      { error: "no pending authorization for this alias (expired?) — start over" },
      { status: 400 },
    );
  }

  const { code, state } = parsePastedCode(body.pasted ?? "");
  if (!code) {
    return NextResponse.json({ error: "no authorization code provided" }, { status: 400 });
  }
  if (state && state !== pending.state) {
    return NextResponse.json(
      { error: "state mismatch — the pasted code is from a different attempt" },
      { status: 400 },
    );
  }

  const cfg = loadOAuthConfig();
  let tokens: { access_token: string; refresh_token: string; expires_in: number; scope?: string };
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

  // Preserve identity + proxy of an account being re-added under the same alias.
  const existing = loadAccountFile(alias);
  const identity = existing
    ? { deviceId: existing.deviceId, accountUuid: existing.accountUuid }
    : detectClaudeIdentity();

  const acc: DarioAccount = {
    alias,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: tokens.scope?.split(" ") ?? cfg.scopes.split(" "),
    deviceId: identity.deviceId,
    accountUuid: identity.accountUuid,
    ...(proxy ? { proxy } : existing?.proxy ? { proxy: existing.proxy } : {}),
  };

  try {
    writeAccountFile(acc);
  } catch (err) {
    return NextResponse.json(
      { error: `failed to write account: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, alias, restartRequired: true });
}
