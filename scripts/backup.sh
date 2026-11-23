#!/usr/bin/env bash
# Backup diario (02:00): pg_dump + tar de UPLOAD_DIR, rotación de 14 días y copia fuera del VPS con rclone.
# Variables (en .env): DATABASE_ADMIN_URL, UPLOAD_DIR, BACKUP_DIR (def. /var/backups/cobros),
#                      RCLONE_REMOTE (ej. "b2:mis-backups/cobros"; vacío = sin copia externa), BACKUP_DIAS (def. 14)
set -euo pipefail
cd "$(dirname "$0")/.."

# Carga .env sin ejecutar nada más
set -a
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/cobros}"
DIAS="${BACKUP_DIAS:-14}"
FECHA="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$BACKUP_DIR"
umask 077

echo "[$(date -Is)] backup $FECHA"

# 1) Base de datos (formato custom, se restaura con pg_restore)
pg_dump --format=custom --no-owner --dbname="$DATABASE_ADMIN_URL" --file="$BACKUP_DIR/db_$FECHA.dump"

# 2) Archivos subidos
if [ -d "${UPLOAD_DIR:-}" ]; then
  tar -czf "$BACKUP_DIR/uploads_$FECHA.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
fi

# 3) Rotación local
find "$BACKUP_DIR" -type f \( -name 'db_*.dump' -o -name 'uploads_*.tar.gz' \) -mtime +"$DIAS" -delete

# 4) Copia fuera del VPS
if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*_$FECHA.*" --transfers 2
  rclone delete "$RCLONE_REMOTE" --min-age "${DIAS}d"
  echo "[$(date -Is)] copiado a $RCLONE_REMOTE"
else
  echo "[$(date -Is)] AVISO: RCLONE_REMOTE vacío, el backup quedó solo en el VPS"
fi
echo "[$(date -Is)] listo"
