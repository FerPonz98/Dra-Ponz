# Cobros + Tesis

Aplicación web multi-organización con dos módulos:

- **Cobros** (vendible a cualquier negocio): clientes, planes de pago en cuotas (BOB/BRL) con historial, mora (gracia,
  recargo único o mensual, cola), tipo de cambio BCB, recordatorios por WhatsApp (wa.me, sin costo) y correo, pago por
  QR con comprobante y aprobación, portal del cliente con enlace único + CI/PIN.
- **Tesis** (usa Cobros): propuestas de asesoría por pasos, cronograma, vigencia del enlace y reenvío, revisiones del
  tribunal, extras, PDF, creador de formularios, subida de archivos/ZIP (50 MB), portal del estudiante, calendario y la
  landing pública **julietaponz.com** (ES/PT) editable.

Stack: Next.js 16 (App Router, `output: 'standalone'`) · React 19 · TypeScript estricto · Tailwind 4 + componentes estilo
shadcn/ui · PostgreSQL + Drizzle ORM · Better Auth · Zod + React Hook Form · FullCalendar 7 · @react-pdf/renderer ·
next-intl · Resend/SMTP · Vitest · Playwright. **Sin Docker.**

Documentos: `PROGRESO.md` (avance y revisiones por fase), `DECISIONES.md` (decisiones tomadas), `CLAUDE.md` (reglas).

---

## 1. Desarrollo local

Requisitos: Node 22+, PostgreSQL 16/17.

```bash
cp .env.example .env          # completar contraseñas y secretos
npm ci
npm run db:setup              # crea la base cobra_app y los roles cobra_owner (dueño) y cobra_web (app, con RLS)
npm run db:migrate            # migraciones versionadas de ./drizzle
npm run db:seed               # superadmin + "Dra. Ponz" (cobros+tesis) + "Demo Dentista" (solo cobros)
npm run dev                   # http://localhost:3000
```

En este equipo PostgreSQL escucha en el **puerto 5433** (el 5432 lo usa Docker Desktop/WSL).

| Usuario | Correo (seed) | Qué ve |
|---|---|---|
| Superadmin | `SUPERADMIN_EMAIL` | `/superadmin`: crea organizaciones, activa módulos, suspende, ve el uso |
| Dra. Ponz | `DRA_EMAIL` | `/panel` con Cobros y Tesis |
| Demo Dentista | `DEMO_EMAIL` | `/panel` solo con Cobros |

### Comandos

| Comando | Para qué |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (incluye la regla **cobros ⇏ tesis**) |
| `npm run build` | build de producción (standalone) |
| `npm run test` | Vitest (unitarios + base de datos) |
| `npm run e2e` | Playwright (levanta `next start` en el puerto 3100). `E2E_SERVIDOR=standalone npm run e2e` prueba el servidor de PM2 |
| `npm run lighthouse` | Lighthouse móvil de `/es` y `/pt` (servidor corriendo en 3100) |
| `npm run capturas -- N` | capturas de revisión de la fase N en `revisiones/fase-N/` |
| `npm run db:generate` | nueva migración desde los esquemas Drizzle |
| `npm run db:reset` | **solo desarrollo**: vacía la base, migra y siembra |

### Arquitectura

```
src/
  core/           auth (Better Auth), organizaciones, módulos, roles/permisos, archivos, contexto de sesión
  modules/
    cobros/       schema, dominio (plan, mora, portal, tipo de cambio, mensajes), servicios, componentes
    tesis/        schema, dominio (cronograma, estados, landing), servicios, componentes, pdf
  app/            rutas: /panel, /superadmin, /p/[token] (portal), /[locale] (landing), /api
  lib/            db (withOrg/withAdmin), fechas, dinero, correo, i18n
drizzle/          migraciones SQL
tests/            unit (Vitest) + e2e (Playwright)
scripts/          deploy, backup, nginx, crontab, setup del VPS, seed, migraciones
```

- **Multi-organización con RLS**: toda tabla con `organizacion_id` tiene la política `aislamiento_organizacion`. La app se
  conecta con `cobra_web` (sin BYPASSRLS) y cada consulta corre dentro de `withOrg(orgId, …)`, que fija
  `app.organizacion_id` con `SET LOCAL`.
- **Módulos**: `tesis` importa de `cobros`; `cobros` nunca de `tesis` (ESLint). Menú, rutas y acciones verifican que el
  módulo esté activo y el permiso del rol.

---

## 2. Producción en el VPS (Ubuntu, sin Docker)

### 2.1 Preparación única

```bash
sudo APP_USER=deploy ./scripts/setup-vps.sh
```

Instala Node 22, PostgreSQL, Nginx, Certbot, rclone y PM2; deja **PostgreSQL escuchando solo en localhost**, el firewall
**ufw con 22/80/443**, la zona horaria `America/La_Paz` y crea `/var/www/cobros`, `/var/data/uploads` y
`/var/backups/cobros`.

### 2.2 Primera instalación

```bash
sudo -iu deploy
git clone <repo> /var/www/cobros && cd /var/www/cobros
cp .env.example .env && nano .env      # ver tabla de variables
npm ci
npm run db:setup && npm run db:migrate && npm run db:seed
./scripts/deploy.sh
```

Nginx + SSL:

```bash
sudo cp scripts/nginx/julietaponz.com.conf /etc/nginx/sites-available/julietaponz.com
sudo ln -s /etc/nginx/sites-available/julietaponz.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d julietaponz.com -d www.julietaponz.com
```

Crons y backups:

```bash
crontab scripts/crontab.txt            # 07:00 mora/recordatorios · 08:00 tipo de cambio · 02:00 backup
rclone config                          # crear el remoto externo y ponerlo en RCLONE_REMOTE
```

### 2.3 Cada despliegue

```bash
./scripts/deploy.sh     # git pull && npm ci && npm run db:migrate && npm run build && pm2 reload ecosystem.config.js
```

### 2.4 Variables de entorno (`.env.example`)

| Variable | Descripción |
|---|---|
| `PG_SUPERUSER_URL` | superusuario de Postgres, solo para `db:setup` |
| `DATABASE_ADMIN_URL` | rol dueño `cobra_owner` (migraciones, auth, jobs, superadmin) |
| `DATABASE_URL` | rol de la app `cobra_web` (RLS) |
| `BETTER_AUTH_SECRET` | secreto de sesiones (`openssl rand -base64 32`); también firma PIN y cookies del portal |
| `BETTER_AUTH_URL`, `APP_URL` | `https://julietaponz.com` |
| `CRON_SECRET` | protege `/api/jobs/*` |
| `UPLOAD_DIR` | **ruta absoluta**, ej. `/var/data/uploads` (los archivos nunca se sirven como estáticos) |
| `RESEND_API_KEY` o `SMTP_*`, `CORREO_REMITENTE` | envío de correos (recuperar contraseña, recordatorios) |
| `SUPERADMIN_*`, `DRA_*`, `DEMO_*` | usuarios del seed (cambiar contraseñas) |
| `LANDING_ORG_SLUG`, `WHATSAPP_LANDING` | organización y WhatsApp de la landing |
| `BACKUP_DIR`, `BACKUP_DIAS`, `RCLONE_REMOTE` | backups |
| `LOGIN_MAX_POR_MINUTO` | límite de intentos de login por IP |

### 2.5 Jobs

| Hora (La Paz) | Endpoint | Qué hace |
|---|---|---|
| 07:00 | `POST /api/jobs/diario` | recalcula mora y recargos (idempotente), correos 3 días antes y el día del vencimiento, vence propuestas y actualiza estados de Tesis |
| 08:00 | `POST /api/jobs/tipo-cambio` | cotización oficial BRL→BOB del BCB; si falla, alerta en el panel y se usa la última |
| 02:00 | `scripts/backup.sh` | `pg_dump` + tar de `UPLOAD_DIR`, rotación de 14 días, copia externa con rclone |

Ambos endpoints exigen `Authorization: Bearer $CRON_SECRET`.

### 2.6 Restaurar un backup

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_ADMIN_URL" /var/backups/cobros/db_FECHA.dump
tar -xzf /var/backups/cobros/uploads_FECHA.tar.gz -C /var/data
```

---

## 3. Contenido que carga la Dra.

- **Foto**: subir `public/landing/foto-dra.webp` (240×300 aprox.) y volver a desplegar; mientras no exista se ve un placeholder.
- **Textos de la landing** (ES y PT), incluidos **testimonios**: Panel → Tesis → Landing pública.
- **QR de cobro, datos bancarios, colores, WhatsApp**: Panel → Administración → Organización.
- **Plantillas de WhatsApp**: Panel → Cobros → Plantillas de mensaje.
