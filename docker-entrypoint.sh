#!/bin/sh
# BioSample LIMS container entrypoint.
#
#   start   — run the Next.js standalone server (default)
#   init    — push schema + run prisma seed (one-shot, for fresh DB only)
#   shell   — drop into /bin/sh for debugging
#   *       — exec arbitrary command
#
# DATABASE_URL / DIRECT_URL / NEXTAUTH_SECRET / NEXTAUTH_URL must be in env.
set -e

cmd="${1:-start}"
shift || true

INIT_BIN="/app/.init-tools/node_modules/.bin"

case "$cmd" in
  start)
    echo "[entrypoint] starting standalone server on :${PORT:-3000}"
    exec node server.js
    ;;
  init)
    echo "[entrypoint] prisma db push (no --accept-data-loss; will refuse on data conflict)"
    "$INIT_BIN/prisma" db push --skip-generate
    echo "[entrypoint] running seed (tsx prisma/seed.ts)"
    "$INIT_BIN/tsx" prisma/seed.ts
    echo "[entrypoint] init complete"
    ;;
  shell)
    exec /bin/sh
    ;;
  *)
    exec "$cmd" "$@"
    ;;
esac
