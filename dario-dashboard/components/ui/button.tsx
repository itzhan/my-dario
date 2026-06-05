import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-indigo-500/90 text-white hover:bg-indigo-500 disabled:opacity-40",
  ghost:
    "border border-[var(--color-border)] bg-transparent text-[var(--color-ink-dim)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-ink)]",
  danger:
    "bg-rose-500/90 text-white hover:bg-rose-500 disabled:opacity-40",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
