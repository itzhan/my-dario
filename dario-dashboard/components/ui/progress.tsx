import { cn } from "@/lib/cn";

/**
 * Horizontal utilization bar. Color escalates with fill so a near-exhausted
 * rate-limit window reads red at a glance — mirrors the TUI's gauge intent.
 */
export function Progress({
  value,
  label,
  sublabel,
  className,
}: {
  value: number; // 0..100
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 90 ? "bg-rose-500" : v >= 70 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className={cn("w-full", className)}>
      {(label || sublabel) && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[var(--color-ink-dim)]">{label}</span>
          <span className="tabular-nums text-[var(--color-ink-faint)]">{sublabel}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-panel-2)]">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", tone)}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
