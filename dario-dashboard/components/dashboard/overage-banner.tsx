"use client";

import { useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import type { HaltState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { durationMs, relativeTime } from "@/lib/format";

/**
 * 熔断横幅 —— 当 overage 防护触发时显示,镜像 TUI 的熔断态,并提供唯一的写操作:
 * 解除熔断(dario resume)。
 */
export function OverageBanner({
  halt,
  onResumed,
}: {
  halt: HaltState;
  onResumed?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resume() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/resume", { method: "POST" });
      if (!res.ok) throw new Error(`解除失败(${res.status})`);
      onResumed?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cooldownLeft =
    halt.cooldownMs && halt.since
      ? Math.max(0, halt.cooldownMs - (Date.now() - halt.since))
      : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <div>
            <div className="font-semibold text-rose-200">
              代理已熔断 —— {relativeTime(halt.since)}检测到 overage
            </div>
            <div className="mt-1 space-y-0.5 text-sm text-rose-200/80">
              <div>原因:{halt.reason || "representative-claim = overage"}</div>
              {(halt.account || halt.model) && (
                <div>
                  请求:{halt.model ?? "?"}{" "}
                  {halt.account ? `· 账号=${halt.account}` : ""}
                </div>
              )}
              {cooldownLeft > 0 && <div>{durationMs(cooldownLeft)}后自动恢复</div>}
            </div>
            {err && <div className="mt-1 text-sm text-rose-300">{err}</div>}
          </div>
        </div>
        <Button variant="danger" onClick={resume} disabled={busy}>
          <RotateCcw className="h-4 w-4" />
          {busy ? "解除中…" : "立即恢复"}
        </Button>
      </div>
    </div>
  );
}
