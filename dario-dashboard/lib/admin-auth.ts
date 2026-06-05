/**
 * Auth gate for the /admin/* machine API (account registration tooling).
 *
 * Unlike the browser UI — which uses the password + signed cookie — these
 * endpoints are called server-to-server, so they authenticate with the same
 * DARIO_API_KEY the proxy uses, sent as `x-api-key` or `Authorization: Bearer`.
 * If DARIO_API_KEY is unset the admin API is closed (returns false).
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";

export function adminKeyOk(req: Request): boolean {
  const expected = process.env.DARIO_API_KEY || "";
  if (!expected) return false;
  const presented =
    req.headers.get("x-api-key") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
