# syntax=docker/dockerfile:1
#
# Build from the repository root, not this directory:
#     docker build -f apps/cms/Dockerfile -t feel-your-website/cms .
# (compose.yaml already sets `context: .`). The whole pnpm workspace has to be
# present so the ~12 `workspace:*` packages this app is built from resolve.
#
# Runtime is apps/cms/server.js (srvx) serving `pnpm build`'s host-agnostic
# output — see that file. Netlify is unaffected; it wraps the same build its
# own way via apps/cms/netlify.toml.

ARG NODE_VERSION=22.23.2

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# corepack reads `packageManager` in package.json and pins pnpm to it.
RUN corepack enable
WORKDIR /repo

# ---------------------------------------------------------------------------
# One build stage for the whole workspace. The pnpm store is a BuildKit cache
# mount, so a rebuild with an unchanged lockfile relinks rather than refetches.
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
# `...` pulls in the app's workspace dependencies (they build first).
RUN pnpm --filter @feel-your-website/cms... build
# A self-contained directory with a production-only node_modules: no vite,
# tsup, eslint, vitest. `--legacy` is the deploy resolver that handles
# `workspace:*` + `catalog:` cleanly here.
RUN pnpm --filter @feel-your-website/cms deploy --prod --legacy /prod

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
# Only what the process needs at runtime — not src/, vite.config.ts, etc.
COPY --from=build /prod/node_modules ./node_modules
COPY --from=build /prod/dist ./dist
COPY --from=build /prod/server.js ./server.js
COPY --from=build /prod/package.json ./package.json
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD wget -q --spider "http://127.0.0.1:${PORT}/" || exit 1
CMD ["node", "server.js"]
