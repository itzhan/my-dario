"use client";

import { useMemo, useState } from "react";
import { Pause, Play, Search } from "lucide-react";
import { useEventStream } from "@/hooks/use-event-stream";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { EmptyState } from "@/components/dashboard/states";
import { compactNumber, ms, relativeTime, statusTone, claimTone } from "@/lib/format";

export default function HitsPage() {
  const [paused, setPaused] = useState(false);
  const [q, setQ] = useState("");
  const { records, connected } = useEventStream({ limit: 300, active: !paused });

  const filtered = useMemo(() => {
    if (!q.trim()) return records;
    const needle = q.toLowerCase();
    return records.filter(
      (r) =>
        r.model.toLowerCase().includes(needle) ||
        r.account.toLowerCase().includes(needle) ||
        r.claim.toLowerCase().includes(needle) ||
        String(r.status).includes(needle),
    );
  }, [records, q]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">实时请求流</h3>
          {connected ? (
            <Badge tone="ok">实时</Badge>
          ) : paused ? (
            <Badge tone="warn">已暂停</Badge>
          ) : (
            <Badge tone="neutral">空闲</Badge>
          )}
          <span className="text-xs text-[var(--color-ink-faint)]">
            显示 {filtered.length} 条
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]" />
            <TextInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="筛选 模型 / 账号 / claim / 状态码"
              className="w-72 pl-8"
            />
          </div>
          <Button variant="ghost" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "继续" : "暂停"}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState>
          {paused
            ? "实时流已暂停。"
            : "等待请求中…通过代理发起一次调用即可在此看到它。"}
        </EmptyState>
      ) : (
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--color-panel)] text-left text-xs uppercase tracking-wider text-[var(--color-ink-faint)]">
              <tr>
                <Th>时间</Th>
                <Th>模型</Th>
                <Th>账号</Th>
                <Th className="text-right">输入</Th>
                <Th className="text-right">输出</Th>
                <Th className="text-right">延迟</Th>
                <Th>Claim</Th>
                <Th className="text-right">状态</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={`${r.timestamp}-${i}`}
                  className="animate-row-in border-t border-[var(--color-border)]/60 hover:bg-[var(--color-panel-2)]"
                >
                  <Td className="whitespace-nowrap text-[var(--color-ink-faint)]">
                    {relativeTime(r.timestamp)}
                  </Td>
                  <Td className="font-medium">
                    {r.model}
                    {r.isOpenAI && (
                      <span className="ml-1 text-[10px] text-[var(--color-ink-faint)]">
                        oai
                      </span>
                    )}
                  </Td>
                  <Td className="text-[var(--color-ink-dim)]">{r.account}</Td>
                  <Td className="text-right tabular-nums">{compactNumber(r.inputTokens)}</Td>
                  <Td className="text-right tabular-nums">{compactNumber(r.outputTokens)}</Td>
                  <Td className="text-right tabular-nums text-[var(--color-ink-dim)]">
                    {ms(r.latencyMs)}
                  </Td>
                  <Td>
                    <span className={`text-xs ${claimTone(r.claim)}`}>{r.claim || "—"}</span>
                  </Td>
                  <Td className={`text-right tabular-nums ${statusTone(r.status)}`}>
                    {r.status}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
