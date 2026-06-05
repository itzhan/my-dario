/**
 * Minimal single-password login gate. The dashboard exposes a subscription's
 * full observability surface plus config editing — it must not run open.
 *
 * Cookie holds an HMAC of a fixed marker keyed by AUTH_SECRET, so a leaked
 * cookie can't be forged without the secret, and the password itself never
 * lands in the cookie. If DASHBOARD_PASSWORD is unset the gate is disabled
 * (intended only for loopback-only local use).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "dario_dash";
const MARKER = "dario-dashboard-session-v1";

export function authEnabled(): boolean {
  return !!process.env.DASHBOARD_PASSWORD;
}

function secret(): string {
  return process.env.AUTH_SECRET || "insecure-default-change-me";
}

export function sessionToken(): string {
  return createHmac("sha256", secret()).update(MARKER).digest("hex");
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD || "";
  if (expected.length !== input.length) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

export function cookieValid(value: string | undefined): boolean {
  if (!value) return false;
  const expected = sessionToken();
  if (value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
