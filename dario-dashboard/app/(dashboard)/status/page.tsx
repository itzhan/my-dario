"use client";

import { ShieldCheck, ShieldAlert, KeyRound, Clock } from "lucide-react";
import { usePoll } from "@/hooks/use-poll";
import { useEventStream } from "@/hooks/use-event-stream";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OfflineNotice, Loading } from "@/components/dashboard/states";
import type { DarioStatus, OverageGuardStatus } from "@/lib/types";

export default function StatusPage() {
  const { data, loading, offline, error } = usePoll<DarioStatus>("/api/status", 6000);
  const { data: guard } = usePoll<OverageGuardStatus>("/api/resume", 6000);
  const { records, connected } = useEventStream({ limit: 20 });

  if (loading && !data) return <Loading />;
  if (offline) return <OfflineNotice error={error} />;
  if (!data) return <OfflineNotice error={error} />;

  const authed = data.authenticated;
  const tone = authed
    ? data.status === "expiring"
      ? "warn"
      : "ok"
    : "bad";
  const halted = guard?.halted;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader title="凭证" hint="OAuth 订阅令牌健康度" />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            {authed ? (
              <ShieldCheck className="h-8 w-8 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-8 w-8 text-rose-400" />
            )}
            <div>
              <div className="text-base font-semibold">{statusText(data.status)}</div>
              <div className="text-xs text-[var(--color-ink-faint)]">
                {authed ? "订阅令牌有效" : "未认证"}
              </div>
            </div>
            <Badge tone={tone} className="ml-auto">
              {authed ? "已认证" : "未认证"}
            </Badge>
          </div>

          <dl className="space-y-2 text-sm">
            <Row icon={<Clock className="h-4 w-4" />} label="剩余有效期">
              {data.expiresIn ?? "—"}
            </Row>
            <Row icon={<KeyRound className="h-4 w-4" />} label="可刷新">
              {data.canRefresh == null ? "—" : data.canRefresh ? "是" : "否"}
            </Row>
            {data.refreshFailures ? (
              <Row icon={<ShieldAlert className="h-4 w-4" />} label="刷新失败次数">
                <span className="text-amber-300">{data.refreshFailures}</span>
              </Row>
            ) : null}
            {data.lastRefreshError ? (
              <Row icon={<ShieldAlert className="h-4 w-4" />} label="最近错误">
                <span className="text-rose-300">{data.lastRefreshError}</span>
              </Row>
            ) : null}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="代理" hint="来自运行中代理的实时信号" />
        <CardBody className="space-y-3 text-sm">
          <Row label="Overage 防护">
            {halted ? (
              <Badge tone="bad">已熔断</Badge>
            ) : (
              <Badge tone="ok">已就绪</Badge>
            )}
          </Row>
          <Row label="事件流">
            {connected ? <Badge tone="ok">已连接</Badge> : <Badge tone="neutral">空闲</Badge>}
          </Row>
          <Row label="近期请求(实时流)">
            <span className="tabular-nums">{records.length}</span>
          </Row>
          <Row label="最近模型">
            {records[0]?.model ? (
              <span className="font-mono text-xs">{records[0].model}</span>
            ) : (
              "—"
            )}
          </Row>
          <p className="pt-2 text-xs text-[var(--color-ink-faint)]">
            熔断表示 dario 收到了 <code>representative-claim: overage</code> 响应并停止转发。可从上方横幅或
            <code>dario resume</code> 恢复。
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function statusText(s: DarioStatus["status"]): string {
  return (
    {
      healthy: "正常",
      expiring: "即将过期",
      expired: "已过期",
      broken: "已损坏",
      none: "未登录",
    } as Record<string, string>
  )[s] ?? s;
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-[var(--color-ink-dim)]">
        {icon}
        {label}
      </span>
      <span className="text-[var(--color-ink)]">{children}</span>
    </div>
  );
}
