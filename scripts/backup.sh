#!/usr/bin/env bash
# Backup diario (02:00): pg_dump + tar de UPLOAD_DIR, rotación de 14 días y copia fuera del VPS con rclone.
# Variables (en .env): DATABASE_ADMIN_URL, UPLOAD_DIR, BACKUP_DIR (def. /var/backups/cobros),
#                      RCLONE_REMOTE (ej. "b2:mis-backups/cobros"; vacío = sin copia externa), BACKUP_DIAS (def. 14)
#                      BACKUP_CLAVE_ARCHIVO (ruta a un archivo con la clave, chmod 600): si está, los backups se cifran
#                      con GPG AES-256 antes de salir del VPS. Restaurar: gpg -d archivo.gpg > archivo
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

# 3) Cifrado (recomendado): nada sale del VPS en claro
if [ -n "${BACKUP_CLAVE_ARCHIVO:-}" ] && [ -f "$BACKUP_CLAVE_ARCHIVO" ]; then
  for f in "$BACKUP_DIR"/*_"$FECHA".*; do
    case "$f" in *.gpg) continue ;; esac
    gpg --batch --yes --pinentry-mode loopback --passphrase-file "$BACKUP_CLAVE_ARCHIVO" --symmetric --cipher-algo AES256 -o "$f.gpg" "$f"
    shred -u "$f" 2>/dev/null || rm -f "$f"
  done
  echo "[$(date -Is)] cifrado con GPG (AES-256)"
else
  echo "[$(date -Is)] AVISO: BACKUP_CLAVE_ARCHIVO vacío, el backup no está cifrado (solo permisos 600)"
fi
chmod 600 "$BACKUP_DIR"/*_"$FECHA".* 2>/dev/null || true

# 4) Rotación local
find "$BACKUP_DIR" -type f \( -name 'db_*.dump*' -o -name 'uploads_*.tar.gz*' \) -mtime +"$DIAS" -delete

# 5) Copia fuera del VPS
if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*_$FECHA.*" --transfers 2
  rclone delete "$RCLONE_REMOTE" --min-age "${DIAS}d"
  echo "[$(date -Is)] copiado a $RCLONE_REMOTE"
else
  echo "[$(date -Is)] AVISO: RCLONE_REMOTE vacío, el backup quedó solo en el VPS"
fi
echo "[$(date -Is)] listo"
