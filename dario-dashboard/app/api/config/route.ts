import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { readConfig, writeConfig } from "@/lib/config-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Read dario's config.json (plan A: same-machine direct file access).
export async function GET() {
  try {
    const { path, exists, config } = readConfig();
    return NextResponse.json({ path, exists, config });
  } catch (err) {
    return NextResponse.json(
      { error: `failed to read config: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

// Validate + atomically write. Config changes need a `dario proxy` restart to
// take effect — the client surfaces that; nothing here hot-reloads the proxy.
export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  try {
    const config = writeConfig(body);
    return NextResponse.json({ ok: true, config, restartRequired: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "config failed validation", issues: err.issues },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: `failed to write config: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
