import { cn } from "@/lib/cn";

type Tone = "neutral" | "ok" | "warn" | "bad" | "accent";

const tones: Record<Tone, string> = {
  neutral: "border-[var(--color-border)] bg-[var(--color-panel-2)] text-[var(--color-ink-dim)]",
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  bad: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  accent: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
