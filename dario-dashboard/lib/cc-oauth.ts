/**
 * Minimal CC OAuth helper for the dashboard's "add account" flow.
 *
 * dario owns OAuth end-to-end via cc-oauth-detect.ts (it scans the CC
 * binary for the live client_id / URLs / scopes). The dashboard is a
 * separate app and can't import dario's source, so we reuse the values
 * dario already resolved by reading its on-disk cache
 * (~/.dario/cc-oauth-cache-v6.json), falling back to the same known-good
 * constants dario ships. This keeps us in lockstep without re-scanning.
 *
 * Flow used here is dario's MANUAL paste flow (oauth.ts:
 * buildManualAuthorizeUrl + parseManualPaste): the browser can't run a
 * localhost callback for a server deployment, so the operator opens the
 * authorize URL, logs in, and pastes the `code#state` Anthropic shows back.
 */
import "server-only";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

export interface OAuthConfig {
  clientId: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
}

// Mirrors dario's FALLBACK in src/cc-oauth-detect.ts (CC v2.1.104 PROD,
// authorizeUrl normalized to claude.ai per dario#71). Last resort only.
const FALLBACK: OAuthConfig = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorizeUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://platform.claude.com/v1/oauth/token",
  scopes:
    "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload",
};

// dario writes the resolved config to this cache keyed by CC binary hash.
const CACHE_PATH = join(homedir(), ".dario", "cc-oauth-cache-v6.json");

// platform.claude.com page that displays the code#state for manual paste.
export const MANUAL_REDIRECT_URI =
  "https://platform.claude.com/oauth/code/callback";

/** Prefer dario's resolved cache; fall back to shipped constants. */
export function loadOAuthConfig(): OAuthConfig {
  try {
    const raw = readFileSync(CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { config?: Partial<OAuthConfig> };
    const c = parsed.config;
    if (c?.clientId && c.authorizeUrl && c.tokenUrl && c.scopes) {
      return {
        clientId: c.clientId,
        authorizeUrl: c.authorizeUrl,
        tokenUrl: c.tokenUrl,
        scopes: c.scopes,
      };
    }
  } catch {
    /* no cache → fallback */
  }
  return FALLBACK;
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkce(): {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
} {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  // 32-byte state — Anthropic's /oauth/authorize rejects shorter (dario#71).
  const state = base64url(randomBytes(32));
  return { codeVerifier, codeChallenge, state };
}

export function buildAuthorizeUrl(
  cfg: OAuthConfig,
  codeChallenge: string,
  state: string,
): string {
  const params = new URLSearchParams({
    code: "true",
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: MANUAL_REDIRECT_URI,
    scope: cfg.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

/** Mirror of dario's parseManualPaste — accepts "code#state" or bare code. */
export function parsePastedCode(input: string): {
  code: string;
  state: string | null;
} {
  const trimmed = input.trim();
  if (!trimmed) return { code: "", state: null };
  const hashIdx = trimmed.indexOf("#");
  if (hashIdx === -1) return { code: trimmed, state: null };
  return {
    code: trimmed.slice(0, hashIdx).trim(),
    state: trimmed.slice(hashIdx + 1).trim(),
  };
}

// ── pending-auth store ───────────────────────────────────────────────
// The authorize-url and exchange calls are two separate HTTP requests; the
// PKCE verifier + state must survive between them. A module-scope Map is
// fine for the single-process Next.js server (dev + `next start`). Entries
// expire after 10 min so an abandoned flow doesn't linger.

export interface PendingAuth {
  codeVerifier: string;
  state: string;
  createdAt: number;
}

const pending = new Map<string, PendingAuth>();
const PENDING_TTL_MS = 10 * 60 * 1000;

export function putPending(alias: string, p: PendingAuth): void {
  pending.set(alias, p);
  for (const [k, v] of pending) {
    if (Date.now() - v.createdAt > PENDING_TTL_MS) pending.delete(k);
  }
}

export function takePending(alias: string): PendingAuth | null {
  const p = pending.get(alias);
  if (!p) return null;
  pending.delete(alias);
  if (Date.now() - p.createdAt > PENDING_TTL_MS) return null;
  return p;
}
