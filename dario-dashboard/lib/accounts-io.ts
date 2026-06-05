/**
 * Direct read/write of dario's per-account credential files
 * (~/.dario/accounts/<alias>.json). Same deployment assumption as
 * config-io.ts: the dashboard runs on the same machine as the proxy.
 *
 * dario reads these files into its pool at startup, so a new/edited account
 * here takes effect on the next `dario proxy` restart (the UI says so) —
 * same contract as the config editor. The file shape mirrors dario's
 * AccountCredentials (src/accounts.ts), including the optional `proxy`
 * field this feature adds.
 */
import "server-only";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";

const ACCOUNTS_DIR =
  process.env.DARIO_ACCOUNTS_DIR || join(homedir(), ".dario", "accounts");

export interface DarioAccount {
  alias: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  deviceId: string;
  accountUuid: string;
  proxy?: string;
}

/** Mirror of dario's safeAliasPath — strip traversal, enforce charset. */
export function safeAlias(alias: string): string | null {
  if (typeof alias !== "string" || alias.length === 0) return null;
  const leaf = basename(alias);
  if (leaf !== alias || leaf === "." || leaf === "..") return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9_\-.]{0,63}$/.test(leaf)) return null;
  return leaf;
}

function accountPath(alias: string): string {
  return join(ACCOUNTS_DIR, `${alias}.json`);
}

export function listAccounts(): DarioAccount[] {
  if (!existsSync(ACCOUNTS_DIR)) return [];
  const out: DarioAccount[] = [];
  for (const f of readdirSync(ACCOUNTS_DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      out.push(JSON.parse(readFileSync(join(ACCOUNTS_DIR, f), "utf-8")));
    } catch {
      /* skip unreadable / partial files */
    }
  }
  return out;
}

export function loadAccountFile(alias: string): DarioAccount | null {
  const a = safeAlias(alias);
  if (!a) return null;
  try {
    return JSON.parse(readFileSync(accountPath(a), "utf-8"));
  } catch {
    return null;
  }
}

/** Atomic write — temp file + rename, mirroring dario's saveAccount. */
export function writeAccountFile(acc: DarioAccount): void {
  const a = safeAlias(acc.alias);
  if (!a) throw new Error(`invalid account alias: ${acc.alias}`);
  mkdirSync(ACCOUNTS_DIR, { recursive: true, mode: 0o700 });
  const path = accountPath(a);
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(acc, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

export function removeAccountFile(alias: string): boolean {
  const a = safeAlias(alias);
  if (!a) return false;
  try {
    unlinkSync(accountPath(a));
    return true;
  } catch {
    return false;
  }
}

/** Set or clear an account's egress proxy. Returns the updated account. */
export function setAccountProxy(
  alias: string,
  proxy: string | null,
): DarioAccount {
  const acc = loadAccountFile(alias);
  if (!acc) throw new Error(`account not found: ${alias}`);
  if (proxy && proxy.trim()) acc.proxy = proxy.trim();
  else delete acc.proxy;
  writeAccountFile(acc);
  return acc;
}

/**
 * Validate a proxy URL string for an account. dario tunnels socks5/socks5h
 * and passes http/https straight to Bun fetch. Empty → null (clear proxy).
 * Throws on an unsupported scheme so the API can return a clear 400.
 */
export function validateProxyUrl(raw: unknown): string | null {
  if (raw == null || (typeof raw === "string" && raw.trim() === "")) return null;
  if (typeof raw !== "string") throw new Error("proxy must be a string");
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error(`not a valid URL: ${raw}`);
  }
  const scheme = u.protocol.replace(/:$/, "").toLowerCase();
  const ok = ["http", "https", "socks5", "socks5h"];
  if (!ok.includes(scheme)) {
    throw new Error(
      `unsupported proxy scheme "${scheme}" — use http, https, socks5 or socks5h (socks4 is not supported)`,
    );
  }
  return u.toString();
}

/**
 * Detect deviceId + accountUuid from an installed Claude Code, mirroring
 * dario's detectClaudeIdentity. Falls back to fresh random IDs when CC
 * isn't present on this host.
 */
export function detectClaudeIdentity(): {
  deviceId: string;
  accountUuid: string;
} {
  const paths = [
    join(homedir(), ".claude", ".claude.json"),
    join(homedir(), ".claude.json"),
  ];
  for (const p of paths) {
    try {
      const data = JSON.parse(readFileSync(p, "utf-8"));
      const deviceId = data.userID || data.installId || data.deviceId || "";
      const accountUuid =
        data.oauthAccount?.accountUuid || data.accountUuid || "";
      if (deviceId || accountUuid) {
        return {
          deviceId: deviceId || randomUUID(),
          accountUuid: accountUuid || randomUUID(),
        };
      }
    } catch {
      /* try next */
    }
  }
  return { deviceId: randomUUID(), accountUuid: randomUUID() };
}
