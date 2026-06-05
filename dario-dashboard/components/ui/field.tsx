"use client";

import { cn } from "@/lib/cn";

export function Label({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1">
      <label className="text-sm text-[var(--color-ink)]">{children}</label>
      {hint && <p className="text-xs text-[var(--color-ink-faint)]">{hint}</p>}
    </div>
  );
}

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-2)] px-3 py-1.5 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-indigo-500/60",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-2)] px-3 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-indigo-500/60",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-2)] px-3 py-2 text-left transition-colors hover:border-indigo-500/40"
    >
      <span>
        <span className="block text-sm text-[var(--color-ink)]">{label}</span>
        {hint && <span className="block text-xs text-[var(--color-ink-faint)]">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-indigo-500" : "bg-[var(--color-border)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left]",
            checked ? "left-4" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
