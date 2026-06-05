import { NextResponse } from "next/server";
import { darioGet } from "@/lib/dario";
import { errorResponse } from "@/lib/route-helpers";
import type { AccountsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await darioGet<AccountsResponse>("/accounts"));
  } catch (err) {
    return errorResponse(err);
  }
}
