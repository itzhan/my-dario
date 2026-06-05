import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  loadOAuthConfig,
  generatePkce,
  buildAuthorizeUrl,
  putPending,
} from "@/lib/cc-oauth";
import { adminKeyOk } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Step 1 of the machine OAuth add (registration tooling): mint a PKCE
// challenge + state, stash the verifier keyed by a fresh session_id, and
// return the authorize URL. The caller opens it, clicks Authorize, and
// reads back the code#state shown on the callback page. Step 2 is
// /admin/oauth/exchange-code.
export async function POST(req: Request) {
  if (!adminKeyOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cfg = loadOAuthConfig();
  const { codeVerifier, codeChallenge, state } = generatePkce();
  const sessionId = randomUUID();
  putPending(sessionId, { codeVerifier, state, createdAt: Date.now() });
  return NextResponse.json({
    auth_url: buildAuthorizeUrl(cfg, codeChallenge, state),
    session_id: sessionId,
  });
}
