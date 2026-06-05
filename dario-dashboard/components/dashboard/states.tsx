import { PlugZap, Loader2 } from "lucide-react";

export function OfflineNotice({ error }: { error?: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] py-16 text-center">
      <PlugZap className="h-7 w-7 text-rose-400" />
      <div className="text-sm font-medium text-[var(--color-ink)]">
        无法连接到 dario 代理
      </div>
      <div className="max-w-md text-xs text-[var(--color-ink-faint)]">
        {error || "请先运行 `dario proxy` 启动代理,并检查 .env.local 里的 DARIO_BASE_URL。"}
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-ink-faint)]">
      <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] py-12 text-center text-sm text-[var(--color-ink-faint)]">
      {children}
    </div>
  );
}
