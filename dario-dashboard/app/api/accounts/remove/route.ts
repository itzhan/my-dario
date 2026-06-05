import { NextResponse } from "next/server";
import { safeAlias, removeAccountFile } from "@/lib/accounts-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Delete an account file (~/.dario/accounts/<alias>.json). Takes effect on
// the next `dario proxy` restart.
export async function POST(req: Request) {
  let body: { alias?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const alias = safeAlias(body.alias ?? "");
  if (!alias) {
    return NextResponse.json({ error: "invalid alias" }, { status: 400 });
  }

  const ok = removeAccountFile(alias);
  if (!ok) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, alias, restartRequired: true });
}
