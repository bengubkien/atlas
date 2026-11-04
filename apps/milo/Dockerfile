# Milo. Built from the repository's root: docker build -f apps/milo/Dockerfile .
# (deploy/compose.yml does this for you.)

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ui/package.json packages/ui/
COPY apps/milo/package.json apps/milo/
RUN pnpm install --frozen-lockfile --filter "@atlas/milo..."

FROM deps AS build
COPY packages/ui packages/ui
COPY apps/milo apps/milo
RUN pnpm --filter @atlas/milo build

FROM node:22-alpine AS production
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    # Only inside the Tailscale sidecar's network: Serve is the one way in.
    HOSTNAME=127.0.0.1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/milo/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/milo/.next/static ./apps/milo/.next/static
# public/ holds sw.js, the offline copy's worker, and the icons.
COPY --from=build --chown=node:node /repo/apps/milo/public ./apps/milo/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO /dev/null http://127.0.0.1:3000/manifest.webmanifest || exit 1
CMD ["node", "apps/milo/server.js"]
