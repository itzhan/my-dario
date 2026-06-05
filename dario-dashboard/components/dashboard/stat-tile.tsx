import { NumberTicker } from "@/components/magic/number-ticker";
import { cn } from "@/lib/cn";

export function StatTile({
  label,
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "bad";
  className?: string;
}) {
  const toneClass = {
    default: "text-[var(--color-ink)]",
    ok: "text-emerald-300",
    warn: "text-amber-300",
    bad: "text-rose-300",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wider text-[var(--color-ink-faint)]">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold", toneClass)}>
        <NumberTicker value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--color-ink-faint)]">{hint}</div>}
    </div>
  );
}
