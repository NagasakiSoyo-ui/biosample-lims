# syntax=docker/dockerfile:1.7
# BioSample LIMS — multi-stage build with Next.js standalone output.
# Runner image carries only the traced runtime deps + a tiny separate
# .init-tools/ install containing the Prisma CLI and tsx for the one-shot
# init/seed sidecar.

ARG NODE_IMAGE=node:20.18.0-alpine

# ---------------------------------------------------------------------------
# deps — install all dependencies (prod + dev) once, cached layer
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# builder — prisma generate + next build (produces .next/standalone)
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# runner — minimal runtime image
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

# Create non-root user first so we can use --chown on the heavy COPYs.
RUN addgroup -S app && adduser -S app -G app

# Next standalone output (traced runtime deps + server.js + package.json)
COPY --chown=app:app --from=builder /app/.next/standalone ./
COPY --chown=app:app --from=builder /app/.next/static ./.next/static
COPY --chown=app:app --from=builder /app/public ./public

# Prisma schema + seed source (read by init sidecar)
COPY --chown=app:app --from=builder /app/prisma ./prisma

# bcryptjs is used only by prisma/seed.ts, so the Next standalone tracer
# does not include it. Pull it into the standalone node_modules so the
# init sidecar's seed step can resolve it via standard Node lookup.
COPY --chown=app:app --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Install Prisma CLI + tsx in a separate prefix used only by the init sidecar.
# Combined chown lives inside the same RUN so it doesn't create a duplicate layer.
RUN mkdir -p /app/.init-tools \
 && printf '{"name":"init-tools","version":"1.0.0","private":true}' > /app/.init-tools/package.json \
 && cd /app/.init-tools \
 && npm config set registry https://registry.npmmirror.com \
 && npm install --no-audit --no-fund prisma@6.19.3 tsx@4.21.0 \
 && npm cache clean --force \
 && chown -R app:app /app/.init-tools

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER app

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["start"]
