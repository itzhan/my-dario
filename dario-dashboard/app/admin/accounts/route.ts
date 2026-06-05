import { NextResponse } from "next/server";
import { adminKeyOk } from "@/lib/admin-auth";
import {
  safeAlias,
  validateProxyUrl,
  detectClaudeIdentity,
  loadAccountFile,
  writeAccountFile,
  listAccounts,
  type DarioAccount,
} from "@/lib/accounts-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Turn an email / display name into a filesystem-safe alias. safeAlias's
// charset excludes '@' and most punctuation, so sanitize first (e.g.
// "foo@bar.com" -> "foo-bar.com") before validating.
function deriveAlias(raw: string): string | null {
  const cleaned = (raw || "")
    .trim()
    .replace(/[^A-Za-z0-9_.-]/g, "-")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 64);
  return safeAlias(cleaned);
}

// Write a pre-authorized account into ~/.dario/accounts/<alias>.json. The
// proxy reads it on its next restart (a fresh-volume proxy is restart-looping
// until the first account lands, then comes up healthy).
export async function POST(req: Request) {
  if (!adminKeyOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    email?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number | string;
    scopes?: string[];
    proxy_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const alias = deriveAlias(body.name || body.email || "");
  if (!alias) {
    return NextResponse.json(
      { error: "could not derive a valid alias from name/email" },
      { status: 400 },
    );
  }
  if (!body.access_token || !body.refresh_token) {
    return NextResponse.json(
      { error: "access_token and refresh_token are required" },
      { status: 400 },
    );
  }

  let proxy: string | null;
  try {
    proxy = validateProxyUrl(body.proxy_url);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  // Preserve a re-added account's stable identity; otherwise mint one.
  const existing = loadAccountFile(alias);
  const identity = existing
    ? { deviceId: existing.deviceId, accountUuid: existing.accountUuid }
    : detectClaudeIdentity();

  const acc: DarioAccount = {
    alias,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Number(body.expires_at) || 0,
    scopes: Array.isArray(body.scopes) ? body.scopes : [],
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

  const count = listAccounts().length;
  return NextResponse.json({ alias, pooled: count > 1, count, restartRequired: true });
}
