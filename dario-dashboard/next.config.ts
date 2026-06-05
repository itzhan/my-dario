import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dashboard is a thin BFF in front of a local dario proxy; nothing
  // here is statically exportable (route handlers stream SSE, read config
  // files). Keep it a normal server build.
  reactStrictMode: true,
  // Bundle a self-contained server (.next/standalone) so the Docker runtime
  // image ships only the traced node_modules, not the full install.
  output: "standalone",
};

export default nextConfig;
