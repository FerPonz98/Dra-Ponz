# syntax=docker/dockerfile:1.7
# Imagen de producción para Easypanel (Traefik delante con SSL). Un mismo Dockerfile para dos servicios:
#   App    → comando por defecto (node server.js), puerto 3000, health check /api/health
#   Worker → comando "npm run worker" (crons: mora, recordatorios, tipo de cambio y backups)
# Ver DEPLOY_EASYPANEL.md.
#
# Base Debian (glibc) y no Alpine (musl): el package-lock.json trae los binarios nativos *-linux-*-gnu
# (Tailwind/oxide, lightningcss, SWC de Next y sharp) y npm no instala bien los de otra plataforma (npm/cli#4828).
#
# SECRETOS: este Dockerfile NO declara ARG ni ENV con secretos (DATABASE_URL, BETTER_AUTH_SECRET,
# BACKUP_ENCRYPTION_KEY…). Easypanel los manda también como build-args, pero sin un ARG que los reciba Docker los
# ignora y no quedan en ninguna capa. El build de Next no necesita ninguno: todo se lee al ARRANCAR el contenedor.

# ── 1) Dependencias ──
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/docker/nativos-linux.mjs ./scripts/docker/nativos-linux.mjs
# npm ci + red de seguridad: instala los binarios nativos de Linux que falten, con la versión exacta del lockfile
RUN npm ci --no-audit --no-fund && node scripts/docker/nativos-linux.mjs

# ── 2) Build: Next (output standalone) + scripts de producción empaquetados (dist-prod) ──
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:prod

# ── 3) Runner: solo lo necesario, usuario sin root ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app
# pg_dump/pg_restore 17 (repo oficial de PostgreSQL, igual que el servidor), rclone (copia fuera del servidor),
# zona horaria y tar. curl solo para bajar la clave del repo y se quita después.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl; \
    install -d /usr/share/postgresql-common/pgdg; \
    curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc; \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends postgresql-client-17 rclone tzdata tar; \
    apt-get purge -y --auto-remove curl; \
    rm -rf /var/lib/apt/lists/*; \
    groupadd --system --gid 1001 nodejs; \
    useradd --system --uid 1001 --gid nodejs --no-create-home --shell /usr/sbin/nologin nextjs; \
    mkdir -p /data/uploads /data/backups; \
    chown -R nextjs:nodejs /data
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=America/La_Paz \
    EN_CONTENEDOR=1 \
    UPLOAD_DIR=/data/uploads \
    BACKUP_DIR=/data/backups \
    PG_DUMP_BIN=/usr/lib/postgresql/17/bin/pg_dump \
    PG_RESTORE_BIN=/usr/lib/postgresql/17/bin/pg_restore
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
