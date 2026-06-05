import { NextResponse } from "next/server";
import {
  loadOAuthConfig,
  generatePkce,
  buildAuthorizeUrl,
  putPending,
} from "@/lib/cc-oauth";
import { safeAlias, validateProxyUrl } from "@/lib/accounts-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Step 1 of the manual OAuth add: mint a PKCE challenge + state, stash the
// verifier server-side keyed by alias, and return the authorize URL for the
// operator to open. Step 2 is /api/accounts/exchange.
export async function POST(req: Request) {
  let body: { alias?: string; proxy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const alias = safeAlias(body.alias ?? "");
  if (!alias) {
    return NextResponse.json(
      { error: "invalid alias — use letters, digits, _ - . (max 64)" },
      { status: 400 },
    );
  }

  // Validate the optional proxy up front so the operator finds out before
  // logging in, not after. The value is echoed back and re-sent on exchange.
  try {
    validateProxyUrl(body.proxy);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const cfg = loadOAuthConfig();
  const { codeVerifier, codeChallenge, state } = generatePkce();
  putPending(alias, { codeVerifier, state, createdAt: Date.now() });
  const authorizeUrl = buildAuthorizeUrl(cfg, codeChallenge, state);

  return NextResponse.json({ alias, authorizeUrl });
}
