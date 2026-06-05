"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ListOrdered,
  Users,
  Server,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/status", label: "状态", icon: Activity },
  { href: "/analytics", label: "分析", icon: BarChart3 },
  { href: "/hits", label: "请求流", icon: ListOrdered },
  { href: "/accounts", label: "账号", icon: Users },
  { href: "/backends", label: "后端", icon: Server },
  { href: "/config", label: "配置", icon: SlidersHorizontal },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-indigo-500/15 text-indigo-200"
                : "text-[var(--color-ink-dim)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-ink)]",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
