import "server-only";
import { NextResponse } from "next/server";
import { DarioError } from "./dario";

/** Map a thrown error to a JSON response: 503 when the proxy is unreachable. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof DarioError) {
    return NextResponse.json(
      { error: err.message, offline: err.offline },
      { status: err.offline ? 503 : err.status || 502 },
    );
  }
  return NextResponse.json({ error: (err as Error).message }, { status: 500 });
}
