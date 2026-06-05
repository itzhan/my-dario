/**
 * Server-only client for the running dario proxy.
 *
 * Everything in this file runs on the Next.js server (route handlers,
 * server components). The DARIO_API_KEY lives here and is injected as
 * `x-api-key` — it never reaches the browser. The browser only ever talks
 * to our own /api/* routes (same-origin, no key), which call through here.
 */
import "server-only";

export const DARIO_BASE_URL =
  process.env.DARIO_BASE_URL?.replace(/\/$/, "") || "http://localhost:3456";

const DARIO_API_KEY = process.env.DARIO_API_KEY || "";

function darioHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  // dario accepts the key as x-api-key or Bearer; it ignores it entirely on
  // a loopback no-key proxy, so sending it unconditionally is harmless.
  if (DARIO_API_KEY) h["x-api-key"] = DARIO_API_KEY;
  return h;
}

export class DarioError extends Error {
  constructor(
    message: string,
    public status: number,
    public offline = false,
  ) {
    super(message);
    this.name = "DarioError";
  }
}

/** GET a JSON endpoint on the proxy. Throws DarioError on failure. */
export async function darioGet<T>(path: string, timeoutMs = 5000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(DARIO_BASE_URL + path, {
      headers: darioHeaders(),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new DarioError(`dario ${path} → ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DarioError) throw err;
    // Network-level failure → the proxy is almost certainly not running.
    throw new DarioError(
      `cannot reach dario at ${DARIO_BASE_URL} (${(err as Error).message})`,
      0,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** POST to the proxy, optionally with a JSON body. */
export async function darioPost<T>(path: string, body?: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(DARIO_BASE_URL + path, {
      method: "POST",
      headers: darioHeaders(body ? { "content-type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new DarioError(`dario ${path} → ${res.status}`, res.status);
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch (err) {
    if (err instanceof DarioError) throw err;
    throw new DarioError(
      `cannot reach dario at ${DARIO_BASE_URL} (${(err as Error).message})`,
      0,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Open a raw streaming connection to the proxy's SSE endpoint. The caller
 * (our /api/stream route) pipes the body straight back to the browser.
 */
export async function darioStream(path: string): Promise<Response> {
  return fetch(DARIO_BASE_URL + path, {
    headers: darioHeaders({ Accept: "text/event-stream" }),
    cache: "no-store",
  });
}
