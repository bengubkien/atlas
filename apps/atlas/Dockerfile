# The Atlas launcher. Built from the repository's root, so the design kit is in
# reach: docker build -f apps/atlas/Dockerfile .
# (deploy/compose.yml does this for you.)

FROM node:22-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Dependencies first, so they're cached until a package.json or the lockfile changes.
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ui/package.json packages/ui/
COPY apps/atlas/package.json apps/atlas/
RUN pnpm install --frozen-lockfile --filter "@atlas/launcher..."

FROM deps AS build
COPY packages/ui packages/ui
COPY apps/atlas apps/atlas
RUN pnpm --filter @atlas/launcher build

# Only the self-contained server and its files.
FROM node:22-alpine AS production
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    # Only inside the Tailscale sidecar's network, at the address only Serve
    # reaches (deploy/compose.yml says why).
    HOSTNAME=127.0.0.2
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/atlas/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/atlas/.next/static ./apps/atlas/.next/static
COPY --from=build --chown=node:node /repo/apps/atlas/public ./apps/atlas/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO /dev/null http://127.0.0.2:3000/manifest.webmanifest || exit 1
CMD ["node", "apps/atlas/server.js"]
