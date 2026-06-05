"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { DotPattern } from "@/components/magic/dot-pattern";
import { BorderBeam } from "@/components/magic/border-beam";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("密码错误");
      router.replace("/status");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <DotPattern />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6"
      >
        <BorderBeam duration={8} size={80} />
        <h1 className="text-lg font-semibold">dario 控制台</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-faint)]">
          请输入控制台密码以继续。
        </p>
        <div className="mt-5 space-y-3">
          <TextInput
            type="password"
            autoFocus
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <p className="text-sm text-rose-400">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "验证中…" : "登录"}
          </Button>
        </div>
      </form>
    </main>
  );
}
