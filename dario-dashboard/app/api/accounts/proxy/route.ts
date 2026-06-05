import { NextResponse } from "next/server";
import { safeAlias, validateProxyUrl, setAccountProxy } from "@/lib/accounts-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Set or clear an account's egress proxy (~/.dario/accounts/<alias>.json).
// Empty/null proxy clears it. Takes effect on the next `dario proxy` restart.
export async function POST(req: Request) {
  let body: { alias?: string; proxy?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const alias = safeAlias(body.alias ?? "");
  if (!alias) {
    return NextResponse.json({ error: "invalid alias" }, { status: 400 });
  }

  let proxy: string | null;
  try {
    proxy = validateProxyUrl(body.proxy);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  try {
    const acc = setAccountProxy(alias, proxy);
    return NextResponse.json({
      ok: true,
      alias,
      proxy: acc.proxy ?? "",
      restartRequired: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `failed to set proxy: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
