import { cn } from "@/lib/cn";

/** Subtle dotted background grid (magic-ui style), fixed behind the app. */
export function DotPattern({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 opacity-[0.35]",
        "[background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:22px_22px]",
        "[mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]",
        className,
      )}
    />
  );
}
