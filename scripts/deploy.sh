#!/usr/bin/env bash
# Despliegue en el VPS (sin Docker). Ejecutar desde la carpeta de la app como el usuario que corre PM2:
#   ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ git pull"
git pull --ff-only

echo "▶ npm ci"
npm ci

echo "▶ migraciones"
npm run db:migrate

echo "▶ build"
npm run build

# El servidor standalone no incluye los estáticos: se copian junto a server.js.
echo "▶ estáticos para standalone"
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static

echo "▶ pm2 reload"
pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js
pm2 save

echo "✓ Desplegado: $(git rev-parse --short HEAD)"
