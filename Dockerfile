# Production image for App Runner: Next.js standalone output on Node 24.
#
#   docker build -t fenro-dashboard .
#   docker run --rm -p 3000:3000 --env-file .env.production fenro-dashboard
#
# Nothing secret is baked in. DATABASE_URL, BETTER_AUTH_SECRET and the rest of
# .env.example are read when the server starts, so one image runs anywhere.
#
# The release build also uploads source maps to Sentry (release.yml):
#   docker build --build-arg SENTRY_RELEASE=<sha> \
#     --build-arg SENTRY_ORG=<org> --build-arg SENTRY_PROJECT=<project> \
#     --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN .
# Without the secret nothing is uploaded and the image is otherwise the same.

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Corepack installs the pnpm pinned in package.json's packageManager.
RUN corepack enable
WORKDIR /app

FROM base AS deps
# pnpm-workspace.yaml carries allowBuilds; without it pnpm 12 refuses to install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
ARG SENTRY_ORG \
    SENTRY_PROJECT \
    SENTRY_RELEASE
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The token is a BuildKit secret, so it stays out of the image and its layers.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# RDS presents certificates from Amazon's own CA. Node trusts it through
# NODE_EXTRA_CA_CERTS, so a DATABASE_URL with sslmode=verify-full verifies
# the server instead of skipping the check.
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/rds-global-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/rds-global-bundle.pem

# Events carry the commit this image was built from, the release its source
# maps were uploaded under. Declared here so a new commit leaves the layers
# above cached.
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=${SENTRY_RELEASE}

# server.js serves public/ and .next/static itself when they sit beside it.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# App Runner runs its own health check against /api/health; this one is for
# `docker run` and any other host that reads it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
