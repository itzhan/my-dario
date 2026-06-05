import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/accounts-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// List accounts from ~/.dario/accounts/*.json (same-machine direct read).
// Secrets are never returned — only alias, expiry, scope count, and proxy.
export async function GET() {
  try {
    const accounts = listAccounts().map((a) => ({
      alias: a.alias,
      expiresAt: a.expiresAt,
      scopes: a.scopes?.length ?? 0,
      deviceId: a.deviceId ? a.deviceId.slice(0, 8) : "",
      proxy: a.proxy ?? "",
    }));
    accounts.sort((x, y) => x.alias.localeCompare(y.alias));
    return NextResponse.json({ accounts });
  } catch (err) {
    return NextResponse.json(
      { error: `failed to list accounts: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
