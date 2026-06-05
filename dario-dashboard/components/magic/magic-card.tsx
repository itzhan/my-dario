"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Card with a cursor-following radial spotlight (cult-ui / magic-ui style).
 * Used for the account-pool cards so the pool reads as tactile, not a table.
 */
export function MagicCard({
  className,
  children,
  glow = "rgba(124,131,255,0.18)",
}: {
  className?: string;
  children: React.ReactNode;
  glow?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -200, y: -200, on: false });

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top, on: true });
      }}
      onMouseLeave={() => setPos((p) => ({ ...p, on: false }))}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] transition-colors",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          opacity: pos.on ? 1 : 0,
          background: `radial-gradient(380px circle at ${pos.x}px ${pos.y}px, ${glow}, transparent 60%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
