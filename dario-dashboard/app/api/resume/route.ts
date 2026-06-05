import { NextResponse } from "next/server";
import { darioGet, darioPost } from "@/lib/dario";
import { errorResponse } from "@/lib/route-helpers";
import type { OverageGuardStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// Current overage-guard state.
export async function GET() {
  try {
    return NextResponse.json(await darioGet<OverageGuardStatus>("/admin/resume"));
  } catch (err) {
    return errorResponse(err);
  }
}

// Clear the halt — the dashboard's single mutating proxy action.
export async function POST() {
  try {
    return NextResponse.json(await darioPost<OverageGuardStatus>("/admin/resume"));
  } catch (err) {
    return errorResponse(err);
  }
}
