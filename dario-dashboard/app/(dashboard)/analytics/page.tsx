"use client";

import { usePoll } from "@/hooks/use-poll";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Sparkline } from "@/components/dashboard/sparkline";
import { OfflineNotice, Loading, EmptyState } from "@/components/dashboard/states";
import { compactNumber } from "@/lib/format";
import type { AnalyticsSummary, BillingBucket } from "@/lib/types";

const BUCKET_LABEL: Record<BillingBucket, string> = {
  subscription: "订阅",
  subscription_fallback: "订阅(回退)",
  extra_usage: "额外用量",
  api: "API",
  unknown: "未知",
};
const BUCKET_TONE: Record<BillingBucket, string> = {
  subscription: "bg-emerald-400",
  subscription_fallback: "bg-emerald-300",
  extra_usage: "bg-rose-500",
  api: "bg-amber-400",
  unknown: "bg-zinc-500",
};

export default function AnalyticsPage() {
  const { data, loading, offline, error } = usePoll<AnalyticsSummary>("/api/analytics", 5000);

  if (loading && !data) return <Loading />;
  if (offline) return <OfflineNotice error={error} />;
  if (!data) return <OfflineNotice error={error} />;

  const w = data.window;
  const subTone = w.subscriptionPercent >= 95 ? "ok" : w.subscriptionPercent >= 80 ? "warn" : "bad";
  const models = Object.entries(data.perModel).sort((a, b) => b[1].requests - a[1].requests);
  const maxModelReq = Math.max(1, ...models.map(([, m]) => m.requests));
  const trend = data.utilization.map((u) => u.avgUtil5h);
  const buckets = Object.entries(w.billingBucketBreakdown) as [BillingBucket, number][];
  const bucketTotal = buckets.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label={`近 ${w.minutes} 分钟请求`} value={w.requests} />
        <StatTile label="输入 token" value={w.totalInputTokens} />
        <StatTile label="输出 token" value={w.totalOutputTokens} />
        <StatTile
          label="订阅占比"
          value={w.subscriptionPercent}
          decimals={0}
          suffix="%"
          tone={subTone}
        />
        <StatTile label="预估成本" value={w.estimatedCost} decimals={2} prefix="$" />
        <StatTile label="平均延迟" value={w.avgLatencyMs} suffix="ms" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="按模型" hint={`${w.minutes} 分钟窗口`} />
          <CardBody className="space-y-3">
            {models.length === 0 ? (
              <EmptyState>该窗口内暂无请求。</EmptyState>
            ) : (
              models.map(([model, m]) => (
                <div key={model}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{model}</span>
                    <span className="tabular-nums text-[var(--color-ink-faint)]">
                      {m.requests} 次 · 入 {compactNumber(m.avgInputTokens)} · 出{" "}
                      {compactNumber(m.avgOutputTokens)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-panel-2)]">
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-[width] duration-500"
                      style={{ width: `${(m.requests / maxModelReq) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="计费桶" hint="请求计入了哪个账单桶" />
          <CardBody className="space-y-4">
            {bucketTotal === 0 ? (
              <EmptyState>暂无已计费请求。</EmptyState>
            ) : (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-panel-2)]">
                  {buckets.map(([k, n]) =>
                    n > 0 ? (
                      <div
                        key={k}
                        className={BUCKET_TONE[k]}
                        style={{ width: `${(n / bucketTotal) * 100}%` }}
                        title={`${BUCKET_LABEL[k]}: ${n}`}
                      />
                    ) : null,
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {buckets.map(([k, n]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${BUCKET_TONE[k]}`} />
                      <span className="text-[var(--color-ink-dim)]">{BUCKET_LABEL[k]}</span>
                      <span className="ml-auto tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="利用率(5 小时)趋势" hint="每 5 分钟一个桶" />
          <CardBody>
            <Sparkline values={trend} width={520} height={70} className="w-full" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="燃烧率" hint="基于当前窗口推算" />
          <CardBody className="grid grid-cols-2 gap-3">
            <Mini label="token / 分钟" value={compactNumber(data.predictions.tokenBurnRate)} />
            <Mini
              label="成本 / 小时"
              value={"$" + data.predictions.costBurnRate.toFixed(2)}
            />
            <Mini
              label="预计耗尽"
              value={
                data.predictions.estimatedExhaustionMinutes == null
                  ? "—"
                  : `${Math.round(data.predictions.estimatedExhaustionMinutes)} 分钟`
              }
            />
            <Mini label="错误率" value={`${(w.errorRate * 100).toFixed(1)}%`} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-2)] p-3">
      <div className="text-xs uppercase tracking-wider text-[var(--color-ink-faint)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
