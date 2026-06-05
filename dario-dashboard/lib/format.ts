/** Small presentation helpers shared across dashboard components. */

export function compactNumber(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.round(n).toString();
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function usd(n: number): string {
  if (!isFinite(n)) return "—";
  return "$" + n.toFixed(n < 1 ? 4 : 2);
}

export function ms(n: number): string {
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

export function relativeTime(tsMs: number): string {
  const diff = Date.now() - tsMs;
  const s = Math.round(diff / 1000);
  if (s < 5) return "刚刚";
  if (s < 60) return `${s}秒前`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}分钟前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.round(h / 24)}天前`;
}

export function durationMs(msVal: number): string {
  if (msVal <= 0) return "0秒";
  const s = Math.floor(msVal / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}时${m}分`;
  if (m > 0) return `${m}分${sec}秒`;
  return `${sec}秒`;
}

/** Tailwind class for an HTTP status code. */
export function statusTone(status: number): string {
  if (status >= 500) return "text-rose-400";
  if (status >= 400) return "text-amber-400";
  if (status >= 200 && status < 300) return "text-emerald-400";
  return "text-zinc-400";
}

/** Color a billing claim by whether it's a subscription bucket. */
export function claimTone(claim: string): string {
  const c = claim.toLowerCase();
  if (c.includes("overage") || c.includes("extra")) return "text-rose-400";
  if (c.includes("five_hour") || c.includes("seven_day") || c.includes("subscription"))
    return "text-emerald-400";
  return "text-zinc-400";
}
