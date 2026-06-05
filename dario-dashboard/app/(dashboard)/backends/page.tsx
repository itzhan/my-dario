"use client";

import { useMemo } from "react";
import { usePoll } from "@/hooks/use-poll";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OfflineNotice, Loading, EmptyState } from "@/components/dashboard/states";
import type { ModelsResponse } from "@/lib/types";

/** 从模型 id 尽量推断所属 provider。 */
function provider(id: string): string {
  if (id.includes(":")) return id.split(":")[0];
  if (/^(claude|opus|sonnet|haiku)/.test(id)) return "claude";
  if (/^(gpt|o1|o3|chatgpt)/.test(id)) return "openai";
  if (/^llama/.test(id)) return "meta";
  return "其它";
}

export default function BackendsPage() {
  const { data, loading, offline, error } = usePoll<ModelsResponse>("/api/models", 15000);

  const grouped = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const m of data?.data ?? []) {
      (out[provider(m.id)] ??= []).push(m.id);
    }
    return out;
  }, [data]);

  if (loading && !data) return <Loading />;
  if (offline) return <OfflineNotice error={error} />;
  if (!data) return <OfflineNotice error={error} />;

  const providers = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-ink-dim)]">
        代理对外公布的可路由模型。后端通过 <code>dario backend</code> 命令增删,此页面仅供查看。
      </p>

      {providers.length === 0 ? (
        <EmptyState>未上报任何模型。</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map(([prov, models]) => (
            <Card key={prov}>
              <CardHeader
                title={prov}
                right={<Badge tone="accent">{models.length}</Badge>}
              />
              <CardBody className="flex flex-wrap gap-2">
                {models.map((id) => (
                  <span
                    key={id}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel-2)] px-2 py-1 font-mono text-xs text-[var(--color-ink-dim)]"
                  >
                    {id}
                  </span>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
