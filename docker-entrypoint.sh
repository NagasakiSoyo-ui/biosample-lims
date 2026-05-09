#!/bin/sh
# BioSample LIMS container entrypoint.
#
#   start   — run the Next.js production server (default)
#   init    — push schema + run prisma seed (one-shot, for fresh DB only)
#   shell   — drop into /bin/sh for debugging
#   *       — exec arbitrary command
#
# DATABASE_URL / DIRECT_URL / NEXTAUTH_SECRET / NEXTAUTH_URL must be in env.
set -e

cmd="${1:-start}"
shift || true

case "$cmd" in
  start)
    echo "[entrypoint] starting next server on :${PORT:-3000}"
    exec npm start
    ;;
  init)
    echo "[entrypoint] prisma db push (no --accept-data-loss; will refuse on data conflict)"
    npx --no prisma db push --skip-generate
    echo "[entrypoint] prisma db seed"
    npx --no prisma db seed
    echo "[entrypoint] init complete"
    ;;
  shell)
    exec /bin/sh
    ;;
  *)
    exec "$cmd" "$@"
    ;;
esac
