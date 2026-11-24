# syntax=docker/dockerfile:1.7
# Imagen de producción para Easypanel (Traefik delante con SSL). Un mismo Dockerfile para dos servicios:
#   App    → comando por defecto (node server.js), puerto 3000, health check /api/health
#   Worker → comando "npm run worker" (crons: mora, recordatorios, tipo de cambio y backups)
# Ver DEPLOY_EASYPANEL.md.

# ── 1) Dependencias ──
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── 2) Build: Next (output standalone) + scripts de producción empaquetados (dist-prod) ──
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:prod

# ── 3) Runner: solo lo necesario, usuario sin root ──
FROM node:22-alpine AS runner
WORKDIR /app
# pg_dump/pg_restore (backups), rclone (copia fuera del servidor), zona horaria y tar
RUN apk add --no-cache postgresql17-client rclone tzdata tar \
  && addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs \
  && mkdir -p /data/uploads /data/backups && chown -R nextjs:nodejs /data
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=America/La_Paz \
    EN_CONTENEDOR=1 \
    UPLOAD_DIR=/data/uploads \
    BACKUP_DIR=/data/backups
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Migraciones de Drizzle y scripts de producción (migrar, worker, seed:prod, restaurar, salud)
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=build --chown=nextjs:nodejs /app/dist-prod ./dist-prod
COPY --chown=nextjs:nodejs package.json ./package.json
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
# App: /api/health (app + base de datos). Worker: su latido de los últimos 2 minutos.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 CMD ["node", "dist-prod/salud.mjs"]
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
