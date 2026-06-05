import { Nav } from "@/components/dashboard/nav";
import { StatusBar } from "@/components/dashboard/status-bar";
import { DotPattern } from "@/components/magic/dot-pattern";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <DotPattern />
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight">dario</span>
            <span className="text-xs text-[var(--color-ink-faint)]">控制台</span>
          </div>
          <Nav />
        </header>

        <StatusBar />

        <main className="mt-5">{children}</main>

        <footer className="mt-10 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-ink-faint)]">
          本地 dario 代理的可视化与配置前端 · 以只读为主 · 改完配置需重启代理生效
        </footer>
      </div>
    </div>
  );
}
