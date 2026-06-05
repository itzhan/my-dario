"use client";

import { usePoll } from "@/hooks/use-poll";
import { MagicCard } from "@/components/magic/magic-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/dashboard/states";
import { AccountsManager } from "@/components/dashboard/accounts-manager";
import { durationMs } from "@/lib/format";
import type { AccountsResponse, PoolAccountView } from "@/lib/types";

const STATUS_TEXT: Record<string, string> = {
  ok: "正常",
  "auth-cooldown": "认证冷却中",
  exhausted: "额度耗尽",
  expiring: "即将过期",
};

export default function AccountsPage() {
  return (
    <div className="space-y-10">
      <AccountsManager />
      <PoolView />
    </div>
  );
}

function PoolView() {
  const { data, offline } = usePoll<AccountsResponse>("/api/accounts", 5000);

  if (offline || !data) {
    return (
      <EmptyState>
        实时余量视图不可用 —— dario proxy 未运行或不可达。账号管理(上方)仍可用,改动会在 proxy 启动后生效。
      </EmptyState>
    );
  }

  if (data.mode === "single-account") {
    return (
      <EmptyState>
        单账号模式 —— 未启用账号池。添加 2 个及以上账号即可启用轮换与按账号余量管理(实时余量视图)。
      </EmptyState>
    );
  }

  const accounts = (data.accounts as PoolAccountView[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-[var(--color-ink-dim)]">
        <Badge tone="accent">账号池</Badge>
        <span>{accounts.length} 个账号</span>
        {typeof data.stickyBindings === "number" && (
          <span className="text-[var(--color-ink-faint)]">
            · {data.stickyBindings} 个粘连绑定
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => {
          const cooling = a.status === "auth-cooldown";
          const tone =
            a.util5h >= 90 || cooling ? "bad" : a.util5h >= 70 ? "warn" : "ok";
          return (
            <MagicCard key={a.alias} className="p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{a.alias}</div>
                <Badge tone={tone}>{STATUS_TEXT[a.status] ?? a.status}</Badge>
              </div>

              <div className="mt-4 space-y-3">
                <Progress value={a.util5h * 100} label="5 小时窗口" sublabel={`${Math.round(a.util5h * 100)}%`} />
                <Progress value={a.util7d * 100} label="7 天窗口" sublabel={`${Math.round(a.util7d * 100)}%`} />
              </div>

              <dl className="mt-4 space-y-1.5 text-xs">
                <Row label="Claim">
                  <span className="font-mono">{a.claim || "—"}</span>
                </Row>
                <Row label="请求数">
                  <span className="tabular-nums">{a.requestCount}</span>
                </Row>
                <Row label="令牌剩余">{durationMs(a.expiresInMs)}</Row>
                {cooling && a.cooldownMs != null && (
                  <Row label="冷却剩余">
                    <span className="text-rose-300">{durationMs(a.cooldownMs)}</span>
                  </Row>
                )}
                {a.consecutiveAuthFailures ? (
                  <Row label="连续认证失败">
                    <span className="text-amber-300">{a.consecutiveAuthFailures}</span>
                  </Row>
                ) : null}
              </dl>
            </MagicCard>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-ink-faint)]">{label}</span>
      <span className="text-[var(--color-ink)]">{children}</span>
    </div>
  );
}
