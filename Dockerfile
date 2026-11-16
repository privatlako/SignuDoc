# SignuDoc as a container, for self-hosting on a VPS (see deploy/vps).
# Built by .github/workflows/docker-image.yml and published to GHCR.

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_DRIVER=local \
    STORAGE_LOCAL_DIR=/data/storage
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
EXPOSE 3000
VOLUME ["/data"]
# Pending migrations are applied on every start; applied ones are skipped.
CMD ["sh", "-c", "node db/migrate.mjs && exec node_modules/.bin/next start"]
