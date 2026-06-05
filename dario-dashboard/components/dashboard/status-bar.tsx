"use client";

import { useEventStream } from "@/hooks/use-event-stream";
import { usePoll } from "@/hooks/use-poll";
import { BorderBeam } from "@/components/magic/border-beam";
import { OverageBanner } from "@/components/dashboard/overage-banner";
import { cn } from "@/lib/cn";
import type { DarioStatus } from "@/lib/types";

/**
 * 贯穿所有页面的顶部状态条:实时连接指示灯、凭证健康度,以及触发熔断时的横幅。
 * 熔断态来自共享的 SSE 流,dario 一旦上报就立即显示。
 */
export function StatusBar() {
  const { connected, halt } = useEventStream({ limit: 1 });
  const { data: status, offline, refresh } = usePoll<DarioStatus>("/api/status", 8000);

  const online = connected && !offline;
  const credTone =
    status?.status === "healthy"
      ? "text-emerald-300"
      : status?.status === "expiring"
        ? "text-amber-300"
        : status?.authenticated
          ? "text-[var(--color-ink-dim)]"
          : "text-rose-300";

  return (
    <div className="space-y-3">
      <div className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
        {online && <BorderBeam duration={7} size={70} />}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-full",
              online ? "animate-pulse-dot bg-emerald-400" : "bg-rose-500",
            )}
          />
          <span className="text-sm font-semibold">
            dario{" "}
            <span className={online ? "text-emerald-300" : "text-rose-300"}>
              {online ? "在线" : "离线"}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--color-ink-dim)]">
          <span>
            凭证:{" "}
            <span className={credTone}>
              {status?.authenticated
                ? `正常${status.expiresIn ? ` · ${status.expiresIn}` : ""}`
                : (status?.status ?? "—")}
            </span>
          </span>
          <span className={cn("inline-flex items-center gap-1.5")}>
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                connected ? "bg-emerald-400" : "bg-zinc-600",
              )}
            />
            实时流 {connected ? "已连接" : "空闲"}
          </span>
        </div>
      </div>

      {halt && <OverageBanner halt={halt} onResumed={refresh} />}
    </div>
  );
}
