# my-dario

One-click Docker stack bundling the [dario](./dario) proxy and its
[web dashboard](./dario-dashboard). Both run as the same uid and share a
single `.dario` volume, so credentials added in either place are visible to
both.

## Run

```bash
cp .env.example .env        # set DARIO_API_KEY, DASHBOARD_PASSWORD, AUTH_SECRET
docker compose up -d --build
```

Open `http://<host>:3088`, log in with `DASHBOARD_PASSWORD`, then add an
account from the **Accounts** tab (browser OAuth — talks to Anthropic
directly, no proxy needed). The proxy restart-loops on a fresh volume until
that first account lands, then goes healthy.

## Layout

| Path | What |
|---|---|
| `dario/` | the proxy (its own Dockerfile) |
| `dario-dashboard/` | Next.js dashboard / config editor (its own Dockerfile) |
| `docker-compose.yml` | wires both + the shared `dario-data` volume |
| `.env` | secrets (gitignored) |

## Exposing the proxy

By default only the dashboard is published (port 3088). The proxy is reachable
only by the dashboard over the internal network. To route external tools
(Cursor, Cline, the Agent SDK) through it, uncomment the `ports:` block under
the `dario` service in `docker-compose.yml` and send `x-api-key: $DARIO_API_KEY`.
