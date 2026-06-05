"use client";

import { useCallback, useEffect, useState } from "react";
import { MagicCard } from "@/components/magic/magic-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, TextInput } from "@/components/ui/field";
import { durationMs } from "@/lib/format";

interface ManagedAccount {
  alias: string;
  expiresAt: number;
  scopes: number;
  deviceId: string;
  proxy: string;
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function AccountsManager() {
  const [accounts, setAccounts] = useState<ManagedAccount[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts/manage", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || `HTTP ${res.status}`);
        return;
      }
      setAccounts(data.accounts as ManagedAccount[]);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-[var(--color-ink-dim)]">
        <Badge tone="accent">账号管理</Badge>
        <span>{accounts?.length ?? 0} 个账号</span>
        <span className="text-[var(--color-ink-faint)]">
          · 增删 / 改代理后需重启 <code>dario proxy</code> 生效
        </span>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {err}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(accounts ?? []).map((a) => (
          <AccountRow key={a.alias} account={a} onChanged={load} />
        ))}
      </div>

      <AddAccount onAdded={load} />
    </div>
  );
}

function AccountRow({ account, onChanged }: { account: ManagedAccount; onChanged: () => void }) {
  const [proxy, setProxy] = useState(account.proxy);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = proxy.trim() !== account.proxy.trim();
  const expired = account.expiresAt > 0 && account.expiresAt - Date.now() < 0;

  async function saveProxy() {
    setBusy(true);
    setMsg(null);
    const { ok, data } = await postJson("/api/accounts/proxy", { alias: account.alias, proxy });
    setBusy(false);
    if (!ok) {
      setMsg((data.error as string) || "保存失败");
      return;
    }
    setMsg("已保存 · 重启后生效");
    onChanged();
  }

  async function remove() {
    if (!confirm(`删除账号 "${account.alias}"?`)) return;
    setBusy(true);
    const { ok, data } = await postJson("/api/accounts/remove", { alias: account.alias });
    setBusy(false);
    if (!ok) {
      setMsg((data.error as string) || "删除失败");
      return;
    }
    onChanged();
  }

  return (
    <MagicCard className="p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{account.alias}</div>
        <div className="flex items-center gap-2">
          {account.proxy ? <Badge tone="ok">已配代理</Badge> : <Badge tone="warn">直连</Badge>}
          {expired ? <Badge tone="bad">令牌过期</Badge> : null}
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-ink-faint)]">令牌剩余</span>
          <span className="text-[var(--color-ink)]">
            {account.expiresAt > 0 ? durationMs(account.expiresAt - Date.now()) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-ink-faint)]">设备 ID</span>
          <span className="font-mono text-[var(--color-ink)]">{account.deviceId || "—"}…</span>
        </div>
      </dl>

      <div className="mt-3">
        <Label hint="http / https / socks5 / socks5h（留空=直连）">出口代理</Label>
        <div className="flex gap-2">
          <TextInput
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="socks5://user:pass@host:1080"
            spellCheck={false}
          />
          <Button variant="primary" disabled={busy || !dirty} onClick={saveProxy}>
            保存
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[var(--color-ink-faint)]">{msg}</span>
        <Button variant="danger" disabled={busy} onClick={remove}>
          删除账号
        </Button>
      </div>
    </MagicCard>
  );
}

function AddAccount({ onAdded }: { onAdded: () => void }) {
  const [alias, setAlias] = useState("");
  const [proxy, setProxy] = useState("");
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function getUrl() {
    setBusy(true);
    setMsg(null);
    const { ok, data } = await postJson("/api/accounts/authorize-url", { alias, proxy });
    setBusy(false);
    if (!ok) {
      setMsg((data.error as string) || "生成失败");
      return;
    }
    setAuthorizeUrl(data.authorizeUrl as string);
  }

  async function complete() {
    setBusy(true);
    setMsg(null);
    const { ok, data } = await postJson("/api/accounts/exchange", { alias, proxy, pasted });
    setBusy(false);
    if (!ok) {
      setMsg(((data.error as string) || "添加失败") + (data.detail ? ` — ${data.detail}` : ""));
      return;
    }
    setMsg(`账号 "${alias}" 已添加 · 重启 dario proxy 生效`);
    setAlias("");
    setProxy("");
    setAuthorizeUrl(null);
    setPasted("");
    onAdded();
  }

  return (
    <MagicCard className="p-4">
      <div className="font-semibold">添加账号（OAuth）</div>
      <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
        生成授权链接 → 在浏览器登录目标 Claude 账号 → 把页面给出的{" "}
        <code>code#state</code> 粘回下方 → 完成添加。
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <Label hint="字母/数字/_-.（最长 64）">别名</Label>
          <TextInput
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="work-1"
            spellCheck={false}
            disabled={!!authorizeUrl}
          />
        </div>
        <div>
          <Label hint="可选，http/https/socks5">出口代理</Label>
          <TextInput
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="socks5://user:pass@host:1080"
            spellCheck={false}
            disabled={!!authorizeUrl}
          />
        </div>
      </div>

      {!authorizeUrl ? (
        <div className="mt-3">
          <Button variant="primary" disabled={busy || !alias.trim()} onClick={getUrl}>
            生成授权链接
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <a
            href={authorizeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block break-all text-sm text-indigo-300 underline"
          >
            点此打开授权链接（新标签页）
          </a>
          <Label hint="Anthropic 页面给出的 code#state">粘贴授权码</Label>
          <TextInput
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="code#state"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy || !pasted.trim()} onClick={complete}>
              完成添加
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setAuthorizeUrl(null);
                setPasted("");
              }}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-[var(--color-ink-dim)]">{msg}</p>}
    </MagicCard>
  );
}
