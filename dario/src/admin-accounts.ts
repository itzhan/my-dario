/**
 * Dario — Admin account provisioning (non-interactive)
 *
 * Building blocks for adding a pool account over HTTP instead of the
 * interactive `dario accounts add` CLI. A remote provisioner (e.g. a Claude
 * registration bot) drives the manual copy-paste OAuth flow: ask for an
 * authorize URL, have a browser approve it, then hand the displayed code
 * back for exchange + persist.
 *
 * The manual redirect URI is used (same as `accounts add --manual`) so
 * Anthropic renders the code on a copy-paste success page — the only flow
 * that works when the approving browser is on a different host than dario.
 */

import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { detectCCOAuthConfig } from './cc-oauth-detect.js';
import { buildManualAuthorizeUrl } from './oauth.js';
import { saveAccount, detectClaudeIdentity, type AccountCredentials } from './accounts.js';
import { redactSecrets } from './redact.js';

// Mirrors oauth.ts — Anthropic special-cases this redirect to show the
// authorization code instead of bouncing to a localhost callback.
const MANUAL_REDIRECT_URI = 'https://platform.claude.com/oauth/code/callback';

// Pending authorize sessions live in memory only. A session holds the PKCE
// verifier + state between generate-auth-url and exchange-code. Short TTL:
// the operator approves within seconds, and a leaked verifier is useless
// without the matching code.
const SESSION_TTL_MS = 10 * 60 * 1000;
interface AuthSession { codeVerifier: string; state: string; createdAt: number; }
const sessions = new Map<string, AuthSession>();

function pruneSessions(now: number): void {
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export interface AdminTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;   // epoch ms
  scopes: string[];
}

/**
 * Step 1 — build a manual-flow authorize URL and stash the PKCE verifier
 * under an opaque session id. The caller opens auth_url in a browser, the
 * account owner approves, and Anthropic shows a `code#state` string.
 */
export async function adminGenerateAuthUrl(): Promise<{ authUrl: string; sessionId: string }> {
  const cfg = await detectCCOAuthConfig();
  const { codeVerifier, codeChallenge } = generatePKCE();
  // 32-byte state — Anthropic's authorize endpoint rejects shorter ones
  // ("Invalid request format"). See oauth.ts / dario#71.
  const state = base64url(randomBytes(32));
  const sessionId = base64url(randomBytes(18));
  const now = Date.now();
  pruneSessions(now);
  sessions.set(sessionId, { codeVerifier, state, createdAt: now });
  return { authUrl: buildManualAuthorizeUrl(cfg, codeChallenge, state), sessionId };
}

/**
 * Step 2 — exchange the pasted code for tokens using the stored verifier.
 * `code` may be the bare code or the full `code#state` paste; trailing
 * state is stripped here so callers can forward the raw success-page value.
 */
export async function adminExchangeCode(sessionId: string, code: string): Promise<AdminTokens> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('unknown or expired session_id — call generate-auth-url again');
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    throw new Error('session expired — call generate-auth-url again');
  }
  // Accept "code#state" or bare code; the token endpoint only needs the code.
  const cleanCode = code.includes('#') ? code.slice(0, code.indexOf('#')).trim() : code.trim();
  if (!cleanCode) throw new Error('empty authorization code');

  const cfg = await detectCCOAuthConfig();
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: cfg.clientId,
      code: cleanCode,
      redirect_uri: MANUAL_REDIRECT_URI,
      code_verifier: session.codeVerifier,
      state: session.state,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (HTTP ${res.status}): ${redactSecrets(body.slice(0, 200))}`);
  }
  const data = await res.json() as {
    access_token: string; refresh_token: string; expires_in: number; scope?: string;
  };
  sessions.delete(sessionId);  // single-use
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scopes: data.scope?.split(' ') || cfg.scopes.split(' '),
  };
}

/**
 * Coerce an arbitrary label (often an email) into a filesystem-safe alias
 * matching the `safeAliasPath` charset in accounts.ts. Invalid chars become
 * `-`, a leading non-alphanumeric is dropped, and the result is capped at
 * 64 chars. Empty input falls back to a random alias.
 */
export function sanitizeAlias(raw: string): string {
  let s = (raw || '').replace(/[^A-Za-z0-9_.-]/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  if (s.length > 64) s = s.slice(0, 64);
  return s || `acct-${base64url(randomBytes(6))}`;
}

/**
 * Step 3 — persist tokens as a pool account file. deviceId / accountUuid
 * fall back to fresh random UUIDs (same as the manual CLI flow when no local
 * Claude Code identity is detectable) so each provisioned account is distinct.
 * Returns the saved credentials; caller is responsible for live pool wiring.
 */
export async function adminPersistAccount(opts: {
  alias: string;
  tokens: AdminTokens;
  proxy?: string;
}): Promise<AccountCredentials> {
  const alias = sanitizeAlias(opts.alias);
  const identity = (await detectClaudeIdentity()) ?? {
    deviceId: randomUUID(),
    accountUuid: randomUUID(),
  };
  const creds: AccountCredentials = {
    alias,
    accessToken: opts.tokens.accessToken,
    refreshToken: opts.tokens.refreshToken,
    expiresAt: opts.tokens.expiresAt,
    scopes: opts.tokens.scopes,
    deviceId: identity.deviceId,
    accountUuid: identity.accountUuid,
    ...(opts.proxy ? { proxy: opts.proxy } : {}),
  };
  await saveAccount(creds);
  return creds;
}

/** Test-only — clear the in-memory session store between scenarios. */
export function _clearAdminSessionsForTest(): void {
  sessions.clear();
}
