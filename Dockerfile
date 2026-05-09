# syntax=docker/dockerfile:1.7
# BioSample LIMS — single-image multi-stage build.
# Bundles full node_modules (incl. prisma CLI + tsx) so the same image
# serves both the runtime app and the one-shot init/seed sidecar.

ARG NODE_IMAGE=node:20.18.0-alpine

# ---------------------------------------------------------------------------
# deps — install all dependencies (prod + dev) once, cached layer
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# builder — prisma generate + next build
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# runner — minimal runtime image, copies build output + node_modules
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["start"]
