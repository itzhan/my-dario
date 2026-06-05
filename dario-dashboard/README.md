# dario-dashboard

A Web dashboard + config editor for a running [dario](https://github.com/askalf/dario)
proxy. dario ships a terminal TUI; this is the browser counterpart — same data,
same tabs, plus an in-page editor for `~/.dario/config.json`.

It is a **separate app**: dario stays zero-dependency. The dashboard talks to the
proxy over HTTP and never touches its source.

## Architecture (BFF)

```
browser (cult-ui / magic-ui pages, no key)
   │  fetch / EventSource  — same-origin
   ▼
Next.js route handlers (app/api/*)  — inject DARIO_API_KEY, proxy SSE, read/write config
   │  http://localhost:3456  (x-api-key: ***)
   ▼
dario proxy
```

- `DARIO_API_KEY` lives only on the Next.js server; the browser never sees it.
- The browser's `EventSource` can't send headers, so `/api/stream` bridges dario's
  `/analytics/stream` same-origin.
- The config editor reads/writes `~/.dario/config.json` directly (same-machine
  deployment). Cross-machine? Add a write endpoint to dario instead.

## Setup

```bash
cp .env.local.example .env.local   # set DARIO_BASE_URL, DARIO_API_KEY, DASHBOARD_PASSWORD
npm install
npm run dev                         # http://localhost:3000
```

Point it at a running proxy (`dario proxy`). For production: `npm run build && npm start`.

## What's where

| Tab | Source | Backed by |
|---|---|---|
| Status | `app/(dashboard)/status` | `/status` + SSE halt events |
| Analytics | `app/(dashboard)/analytics` | `/analytics` |
| Hits | `app/(dashboard)/hits` | `/analytics/stream` (SSE) |
| Accounts | `app/(dashboard)/accounts` | `/accounts` |
| Backends | `app/(dashboard)/backends` | `/v1/models` |
| Config | `app/(dashboard)/config` | `~/.dario/config.json` (direct) |

## Notes

- **Config changes need a `dario proxy` restart.** The proxy reads config once at
  startup; the editor says so on save. Nothing here hot-reloads the proxy.
- **Don't run it open.** Set `DASHBOARD_PASSWORD` + `AUTH_SECRET`; put TLS in front
  for anything beyond loopback. It exposes a subscription's full observability surface.
- dario's HTTP shapes are internal, not a stable API; `lib/types.ts` is pinned to
  dario v4.8.x and every consumer parses defensively.
- UI components under `components/magic` and `components/ui` are vendored in the
  copy-paste spirit of magic-ui / cult-ui — no registry fetch, no black-box deps.
