import { darioStream } from "@/lib/dario";

export const dynamic = "force-dynamic";
// Node runtime: we proxy a long-lived upstream stream and inject x-api-key.
export const runtime = "nodejs";

/**
 * Same-origin SSE bridge. The browser's EventSource cannot set an x-api-key
 * header, so it connects here; we open dario's /analytics/stream server-side
 * (key injected by darioStream) and pipe the bytes straight through. If the
 * proxy is down we emit one synthetic offline event and close, so the client
 * shows a clean disconnected state instead of a hard error.
 */
export async function GET(req: Request) {
  let upstream: Response;
  try {
    upstream = await darioStream("/analytics/stream");
  } catch {
    return offlineStream();
  }

  if (!upstream.ok || !upstream.body) {
    return offlineStream();
  }

  // Abort the upstream fetch when the browser disconnects.
  const stream = new ReadableStream({
    start(controller) {
      const reader = upstream.body!.getReader();
      const pump = (): Promise<void> =>
        reader.read().then(({ done, value }) => {
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
          return pump();
        });
      pump().catch(() => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
      req.signal.addEventListener("abort", () => {
        reader.cancel().catch(() => {});
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function offlineStream(): Response {
  const body = `event: offline\ndata: {"offline":true}\n\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
