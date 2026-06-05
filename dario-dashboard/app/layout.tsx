import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dario 控制台",
  description: "运行中 dario 代理的可视化控制台与配置编辑器",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
