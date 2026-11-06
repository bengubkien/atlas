# Tyche. Built from the repository's root: docker build -f apps/tyche/Dockerfile .
# (deploy/compose.yml does this for you.)

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ui/package.json packages/ui/
COPY packages/sync/package.json packages/sync/
COPY apps/tyche/package.json apps/tyche/
RUN pnpm install --frozen-lockfile --filter "@atlas/tyche..."

FROM deps AS build
COPY packages/ui packages/ui
COPY packages/sync packages/sync
COPY apps/tyche apps/tyche
RUN pnpm --filter @atlas/tyche build

FROM node:22-alpine AS production
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    # Only inside the Tailscale sidecar's network, at the address only Serve
    # reaches (deploy/compose.yml says why).
    HOSTNAME=127.0.0.2
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/tyche/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/tyche/.next/static ./apps/tyche/.next/static
COPY --from=build --chown=node:node /repo/apps/tyche/public ./apps/tyche/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO /dev/null http://127.0.0.2:3000/manifest.webmanifest || exit 1
CMD ["node", "apps/tyche/server.js"]
