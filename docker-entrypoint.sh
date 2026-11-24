#!/bin/sh
# Arranque del contenedor (App y Worker):
#  1) crea las carpetas del volumen /data si faltan
#  2) espera a Postgres, aplica migraciones con el rol DUEÑO y crea/actualiza el rol de la APP (sujeto a RLS)
#  3) arranca el comando del servicio con el rol de la app (DATABASE_URL): node server.js o npm run worker
set -e
mkdir -p "${UPLOAD_DIR:-/data/uploads}" "${BACKUP_DIR:-/data/backups}" 2>/dev/null || true
node dist-prod/migrar.mjs
exec "$@"
