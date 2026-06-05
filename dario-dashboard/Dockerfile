# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Same uid/gid as the dario image (10001). The dashboard reads/writes dario's
# accounts/ (0o700) and config.json (0o600) on the shared volume directly, so
# both containers must run as the same owner or every read EACCESes.
RUN addgroup -g 10001 -S dario \
 && adduser -u 10001 -S -G dario -h /home/dario dario \
 && mkdir -p /home/dario/.dario \
 && chown -R dario:dario /home/dario

# Next.js standalone output: the traced server + only the node_modules it
# actually imports, plus the static assets it can't trace.
COPY --from=build --chown=dario:dario /app/.next/standalone ./
COPY --from=build --chown=dario:dario /app/.next/static ./.next/static

USER dario

# Talk to the proxy by its compose service name; read its files off the shared
# volume. API key / password / auth secret are injected at runtime by compose.
ENV HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DARIO_BASE_URL=http://dario:3456 \
    DARIO_CONFIG_PATH=/home/dario/.dario/config.json \
    DARIO_ACCOUNTS_DIR=/home/dario/.dario/accounts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/login" >/dev/null || exit 1

CMD ["node", "server.js"]
