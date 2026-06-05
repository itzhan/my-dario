"use client";

import { useEffect, useRef, useState } from "react";
import type { RequestRecord, HaltState } from "@/lib/types";

export interface StreamState {
  records: RequestRecord[];
  halt: HaltState | null;
  warn: HaltState | null;
  connected: boolean;
}

interface Options {
  /** Max records to retain in memory (ring buffer). */
  limit?: number;
  /** When false, the EventSource is torn down (used for the pause button). */
  active?: boolean;
}

/**
 * Subscribe to /api/stream — our same-origin SSE proxy in front of dario's
 * /analytics/stream. The backend replays the recent backlog on connect, so
 * a fresh mount is populated immediately. Named events (overage_halt /
 * _warn / _resume) drive the halt banner.
 */
export function useEventStream({ limit = 200, active = true }: Options = {}): StreamState {
  const [records, setRecords] = useState<RequestRecord[]>([]);
  const [halt, setHalt] = useState<HaltState | null>(null);
  const [warn, setWarn] = useState<HaltState | null>(null);
  const [connected, setConnected] = useState(false);
  const limitRef = useRef(limit);
  limitRef.current = limit;

  useEffect(() => {
    if (!active) {
      setConnected(false);
      return;
    }
    const es = new EventSource("/api/stream");

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const rec = JSON.parse(e.data) as RequestRecord;
        setRecords((prev) => {
          const next = [rec, ...prev];
          return next.length > limitRef.current ? next.slice(0, limitRef.current) : next;
        });
      } catch {
        /* ignore malformed frame */
      }
    };

    es.addEventListener("overage_halt", (e) => {
      try {
        setHalt(JSON.parse((e as MessageEvent).data));
        setWarn(null);
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("overage_warn", (e) => {
      try {
        setWarn(JSON.parse((e as MessageEvent).data));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("overage_resume", () => {
      setHalt(null);
      setWarn(null);
    });

    return () => es.close();
  }, [active]);

  return { records, halt, warn, connected };
}
