"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  offline: boolean;
  refresh: () => void;
}

/**
 * Poll a same-origin JSON endpoint on an interval. Keeps the last good data
 * visible while a refetch is in flight, and surfaces an `offline` flag when
 * the BFF reports the proxy is unreachable (HTTP 503 from our routes).
 */
export function usePoll<T>(url: string, intervalMs = 4000): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const tick = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!alive.current) return;
      if (!res.ok) {
        setError(body?.error || `HTTP ${res.status}`);
        setOffline(res.status === 503);
      } else {
        setData(body as T);
        setError(null);
        setOffline(false);
      }
    } catch (e) {
      if (!alive.current) return;
      setError((e as Error).message);
      setOffline(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [tick, intervalMs]);

  return { data, error, loading, offline, refresh: tick };
}
