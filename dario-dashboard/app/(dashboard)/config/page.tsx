"use client";

import { useEffect, useState } from "react";
import { Save, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, TextInput, Select, Toggle } from "@/components/ui/field";
import { Loading } from "@/components/dashboard/states";
import type { DarioConfig } from "@/lib/config-schema";

type Saved = { ok: boolean; msg: string; restart?: boolean } | null;

export default function ConfigPage() {
  const [cfg, setCfg] = useState<DarioConfig | null>(null);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved>(null);
  const [dirty, setDirty] = useState(false);

  async function load() {
    setLoading(true);
    setSaved(null);
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const body = await res.json();
      if (res.ok) {
        setCfg(body.config);
        setPath(body.path);
        setDirty(false);
      } else {
        setSaved({ ok: false, msg: body.error || "读取配置失败" });
      }
    } catch (e) {
      setSaved({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function set<K extends keyof DarioConfig>(key: K, value: DarioConfig[K]) {
    setCfg((c) => (c ? { ...c, [key]: value } : c));
    setDirty(true);
    setSaved(null);
  }
  // 更新某个嵌套对象字段(pacing、session、queue 等)里的某个键。
  function setNested(group: keyof DarioConfig, key: string, value: unknown) {
    setCfg((c) => {
      if (!c) return c;
      const cur = (c[group] as Record<string, unknown>) ?? {};
      return { ...c, [group]: { ...cur, [key]: value } };
    });
    setDirty(true);
    setSaved(null);
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const body = await res.json();
      if (!res.ok) {
        setSaved({
          ok: false,
          msg: body.error + (body.issues ? `:${JSON.stringify(body.issues[0]?.path)}` : ""),
        });
      } else {
        setCfg(body.config);
        setDirty(false);
        setSaved({ ok: true, msg: "已保存到磁盘。", restart: body.restartRequired });
      }
    } catch (e) {
      setSaved({ ok: false, msg: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (loading && !cfg) return <Loading />;
  if (!cfg)
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-rose-300">{saved?.msg || "无法读取配置。"}</p>
          <Button variant="ghost" className="mt-3" onClick={load}>
            <RefreshCw className="h-4 w-4" /> 重试
          </Button>
        </CardBody>
      </Card>
    );

  const g = (k: keyof DarioConfig) => (cfg[k] as Record<string, unknown>) ?? {};
  const numOrUndef = (v: string) => (v === "" ? undefined : Number(v));

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[var(--color-ink-faint)]">
          正在编辑 <code className="text-[var(--color-ink-dim)]">{path}</code> · 配置版本 v
          {cfg.version}
        </div>
        <Button variant="ghost" onClick={load} disabled={saving}>
          <RefreshCw className="h-4 w-4" /> 重新加载
        </Button>
      </div>

      <Section title="服务端" hint="监听地址 —— 修改后需重启代理">
        <Field label="端口">
          <TextInput
            type="number"
            value={cfg.port ?? ""}
            onChange={(e) => set("port", numOrUndef(e.target.value))}
          />
        </Field>
        <Field label="监听地址" hint="127.0.0.1(回环)或 0.0.0.0(局域网 —— 需设置 DARIO_API_KEY)">
          <TextInput
            value={cfg.host ?? ""}
            placeholder="127.0.0.1"
            onChange={(e) => set("host", e.target.value || undefined)}
          />
        </Field>
      </Section>

      <Section title="路由与转换">
        <Field label="默认模型" hint="null = 透传客户端请求的模型">
          <TextInput
            value={cfg.model ?? ""}
            placeholder="(由客户端决定)"
            onChange={(e) => set("model", e.target.value || null)}
          />
        </Field>
        <ToggleField
          label="透传模式"
          hint="原样转发请求体(关闭 CC 模板重建)"
          checked={!!cfg.passthrough}
          onChange={(v) => set("passthrough", v)}
        />
        <ToggleField
          label="保留工具"
          checked={!!cfg.preserveTools}
          onChange={(v) => set("preserveTools", v)}
        />
        <ToggleField
          label="混合工具"
          checked={!!cfg.hybridTools}
          onChange={(v) => set("hybridTools", v)}
        />
        <ToggleField
          label="合并工具"
          checked={!!cfg.mergeTools}
          onChange={(v) => set("mergeTools", v)}
        />
        <ToggleField
          label="关闭客户端自动识别"
          checked={!!cfg.noAutoDetect}
          onChange={(v) => set("noAutoDetect", v)}
        />
      </Section>

      <Section title="线形态保真">
        <ToggleField
          label="严格 TLS"
          hint="若无法复刻 CC 的 TLS 指纹则直接失败"
          checked={!!cfg.strictTls}
          onChange={(v) => set("strictTls", v)}
        />
        <ToggleField
          label="严格模板"
          checked={!!cfg.strictTemplate}
          onChange={(v) => set("strictTemplate", v)}
        />
        <ToggleField
          label="关闭实时捕获"
          hint="使用内置模板,而非从你的 CC 二进制实时捕获"
          checked={!!cfg.noLiveCapture}
          onChange={(v) => set("noLiveCapture", v)}
        />
        <ToggleField
          label="关闭时排空"
          checked={!!cfg.drainOnClose}
          onChange={(v) => set("drainOnClose", v)}
        />
      </Section>

      <Section title="隐身与节流" hint="--stealth 时序整形">
        <ToggleField
          label="隐身模式"
          checked={!!cfg.stealth}
          onChange={(v) => set("stealth", v)}
        />
        <Field label="节流最小间隔(ms)">
          <TextInput
            type="number"
            value={(g("pacing").minMs as number) ?? ""}
            onChange={(e) => setNested("pacing", "minMs", numOrUndef(e.target.value))}
          />
        </Field>
        <Field label="节流抖动(ms)">
          <TextInput
            type="number"
            value={(g("pacing").jitterMs as number) ?? ""}
            onChange={(e) => setNested("pacing", "jitterMs", numOrUndef(e.target.value))}
          />
        </Field>
        <Field label="思考时延基准(ms)">
          <TextInput
            type="number"
            value={(g("thinkTime").baseMs as number) ?? ""}
            onChange={(e) => setNested("thinkTime", "baseMs", numOrUndef(e.target.value))}
          />
        </Field>
        <Field label="每 token 思考时延(ms)">
          <TextInput
            type="number"
            value={(g("thinkTime").perTokenMs as number) ?? ""}
            onChange={(e) => setNested("thinkTime", "perTokenMs", numOrUndef(e.target.value))}
          />
        </Field>
        <Field label="思考时延上限(ms)">
          <TextInput
            type="number"
            value={(g("thinkTime").maxMs as number) ?? ""}
            onChange={(e) => setNested("thinkTime", "maxMs", numOrUndef(e.target.value))}
          />
        </Field>
      </Section>

      <Section title="会话">
        <Field label="空闲轮换(ms)">
          <TextInput
            type="number"
            value={(g("session").idleRotateMs as number) ?? ""}
            onChange={(e) => setNested("session", "idleRotateMs", numOrUndef(e.target.value))}
          />
        </Field>
        <Field label="轮换抖动(ms)">
          <TextInput
            type="number"
            value={(g("session").rotateJitterMs as number) ?? ""}
            onChange={(e) => setNested("session", "rotateJitterMs", numOrUndef(e.target.value))}
          />
        </Field>
        <ToggleField
          label="按客户端区分会话"
          checked={!!(g("session").perClient as boolean)}
          onChange={(v) => setNested("session", "perClient", v)}
        />
      </Section>

      <Section title="请求队列">
        <Field label="最大并发" hint="留空 = 不限">
          <TextInput
            type="number"
            value={(g("queue").maxConcurrent as number) ?? ""}
            onChange={(e) =>
              setNested("queue", "maxConcurrent", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
        <Field label="最大排队数">
          <TextInput
            type="number"
            value={(g("queue").maxQueued as number) ?? ""}
            onChange={(e) =>
              setNested("queue", "maxQueued", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
        <Field label="排队超时(ms)">
          <TextInput
            type="number"
            value={(g("queue").timeoutMs as number) ?? ""}
            onChange={(e) =>
              setNested("queue", "timeoutMs", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
      </Section>

      <Section title="Token 与提示词">
        <Field label="Effort 等级" hint="如 max、xhigh">
          <TextInput
            value={cfg.effort ?? ""}
            onChange={(e) => set("effort", e.target.value || null)}
          />
        </Field>
        <Field label="最大 token" hint='数字、"client" 或留空'>
          <TextInput
            value={cfg.maxTokens == null ? "" : String(cfg.maxTokens)}
            onChange={(e) => {
              const v = e.target.value.trim();
              set("maxTokens", v === "" ? null : v === "client" ? "client" : Number(v));
            }}
          />
        </Field>
        <ToggleField
          label="保留编排标签"
          checked={!!cfg.preserveOrchestrationTags}
          onChange={(v) => set("preserveOrchestrationTags", v)}
        />
        <Field label="日志文件" hint="路径,留空则关闭">
          <TextInput
            value={cfg.logFile ?? ""}
            onChange={(e) => set("logFile", e.target.value || null)}
          />
        </Field>
        <Field label="系统提示词覆盖" full>
          <textarea
            value={cfg.systemPrompt ?? ""}
            onChange={(e) => set("systemPrompt", e.target.value || null)}
            rows={3}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-2)] px-3 py-1.5 text-sm outline-none focus:border-indigo-500/60"
            placeholder="(无)"
          />
        </Field>
      </Section>

      <Section title="Overage 防护">
        <ToggleField
          label="启用"
          checked={g("overageGuard").enabled !== false}
          onChange={(v) => setNested("overageGuard", "enabled", v)}
        />
        <Field label="触发行为">
          <Select
            value={(g("overageGuard").behavior as string) ?? "halt"}
            onChange={(e) => setNested("overageGuard", "behavior", e.target.value)}
          >
            <option value="halt">熔断(halt)</option>
            <option value="warn">仅告警(warn)</option>
          </Select>
        </Field>
        <Field label="冷却时长(ms)">
          <TextInput
            type="number"
            value={(g("overageGuard").cooldownMs as number) ?? ""}
            onChange={(e) => setNested("overageGuard", "cooldownMs", numOrUndef(e.target.value))}
          />
        </Field>
        <ToggleField
          label="系统通知"
          checked={!!(g("overageGuard").notifyOs as boolean)}
          onChange={(v) => setNested("overageGuard", "notifyOs", v)}
        />
      </Section>

      {/* 固定底部的保存栏 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="text-sm">
            {saved ? (
              saved.ok ? (
                <span className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  {saved.msg}
                  {saved.restart && (
                    <span className="text-amber-300">
                      —— 重启 <code>dario proxy</code> 后生效。
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                  {saved.msg}
                </span>
              )
            ) : dirty ? (
              <span className="text-amber-300">有未保存的更改</span>
            ) : (
              <span className="text-[var(--color-ink-faint)]">无更改</span>
            )}
          </div>
          <Button onClick={save} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? "保存中…" : "保存配置"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} hint={hint} />
      <CardBody className="grid gap-4 md:grid-cols-2">{children}</CardBody>
    </Card>
  );
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="self-end">
      <Toggle label={label} hint={hint} checked={checked} onChange={onChange} />
    </div>
  );
}
