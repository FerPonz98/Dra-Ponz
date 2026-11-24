# Desplegar en Easypanel (VPS)

Guía paso a paso, pensada para quien nunca usó Easypanel. Al final quedan **3 servicios** en un proyecto:

| Servicio | Qué hace | Imagen |
|---|---|---|
| **postgres** | Base de datos | Postgres 17 de Easypanel |
| **app** | La web (landing, panel, portal) en el puerto 3000, detrás de Traefik con HTTPS | `Dockerfile` del repo |
| **worker** | Crons: mora y recordatorios 07:00, tipo de cambio 08:00 y backup 02:00 (hora de La Paz) | el mismo `Dockerfile`, otro comando |

> En Easypanel **no se usan** `scripts/nginx/*.conf` ni `ecosystem.config.js` (PM2): Traefik pone el HTTPS y la app
> hace lo demás (cabeceras de seguridad, límites de peticiones, límite de 50 MB por archivo, IP real con
> `X-Forwarded-For`). Esos archivos siguen en el repo para quien despliegue sin Easypanel.

---

## 0. Antes de empezar

1. En tu proveedor de dominio, crea dos registros **A** que apunten a la IP del VPS: `julietaponz.com` y
   `www.julietaponz.com`. Puede tardar unos minutos en propagarse.
2. Genera tres secretos (en cualquier terminal con OpenSSL, o con un generador de contraseñas de 40+ caracteres) y
   guárdalos en tu gestor de contraseñas:
   - `BETTER_AUTH_SECRET` → `openssl rand -base64 32`
   - `BACKUP_ENCRYPTION_KEY` → `openssl rand -base64 32` (**guárdala también fuera del servidor**: sin ella los
     backups no se pueden restaurar)
   - Una contraseña para el rol de la app (`CLAVE_APP`) → `openssl rand -hex 24` (solo letras y números: va dentro de
     una URL)

## 1. Crear el proyecto

Easypanel → **+ Create Project** → nombre: `dra-ponz` → Create.

## 2. Servicio Postgres

1. Dentro del proyecto: **+ Service → Postgres**.
2. Service name: `postgres` · Database name: `cobra_app` · User: `postgres` · Password: una **segura** (usa la que
   propone Easypanel o genera una de 32+ caracteres, solo letras y números) · Image/version: **17**
   (la imagen de la app trae el cliente `pg_dump` 17; no elijas una versión mayor).
3. **Create**. Cuando esté en verde, abre el servicio y copia la **Internal Connection URL**. Se ve así:
   `postgres://postgres:CLAVE_POSTGRES@dra-ponz_postgres:5432/cobra_app`
   (el host `dra-ponz_postgres` es el nombre interno: solo se ve dentro del proyecto, no desde Internet).

## 3. Servicio App

1. **+ Service → App** · nombre: `app`.
2. **Source → GitHub**: Owner `FerPonz98` · Repository `Dra-Ponz` · Branch `main` · Build path `/`.
   (Si el repo es privado, primero conecta tu cuenta de GitHub en Easypanel → Settings → GitHub.)
3. **Build → Dockerfile** (ruta `Dockerfile`). → **Save**.
4. **Environment**: pega las variables de la tabla de abajo (sección 6) en formato `NOMBRE=valor`, una por línea → Save.
5. **Mounts → Add Volume Mount**: Name `data` · Mount path `/data` → Save.
6. **Domains → Add Domain**:
   - Host `julietaponz.com` · HTTPS **activado** · Port **3000** · Path `/`.
   - Repite con `www.julietaponz.com` (mismo puerto). Easypanel saca los certificados de Let's Encrypt solo.
7. **Deploy**. La primera vez tarda varios minutos (instala dependencias y compila). En **Logs** deberías ver:
   ```
   Rol de la app "cobra_web": creado (sin BYPASSRLS)
   Migraciones aplicadas
   Permisos del rol de la app al día
   ✓ Entorno válido · archivos en /data/uploads
   ```
   El **health check** ya viene en el `Dockerfile` (`/api/health`: responde 200 si la app y la base responden). Si
   Easypanel te pide una ruta de health check, pon `/api/health`.

## 4. Servicio Worker

1. **+ Service → App** · nombre: `worker`.
2. **Source**: lo mismo que la app (GitHub `FerPonz98/Dra-Ponz`, rama `main`, Build **Dockerfile**).
3. **Deploy → Command** (sobrescribe el comando del contenedor): `npm run worker`
4. **Environment**: las **mismas** variables que la app (copia y pega), **más** `BACKUP_ENCRYPTION_KEY` y, si ya lo
   configuraste, `RCLONE_REMOTE` y `RCLONE_CONFIG_*` (sección 7).
5. **Mounts → Add Volume Mount**: Name `data` · Mount path `/data` (el **mismo nombre** que en la app, para que el
   worker vea los archivos subidos y pueda respaldarlos).
6. **Sin dominio** (no atiende tráfico web). → **Deploy**.
7. En Logs: `Worker listo (America/La_Paz): mora y recordatorios 07:00 · tipo de cambio 08:00 · backup 02:00`.

> **Comprobá que app y worker comparten el volumen**: en el worker → **Console** → `ls /data/uploads`. Después de
> subir un comprobante desde el portal, ese archivo tiene que aparecer acá. Si la carpeta está vacía, cambia el mount
> de **ambos** servicios a un **Bind Mount** con el mismo Host path (p. ej. `/etc/easypanel/projects/dra-ponz/data`),
> y desde la terminal del VPS dale el dueño al usuario de la app: `sudo chown -R 1001:1001 /etc/easypanel/projects/dra-ponz/data`.

## 5. Primer arranque: crear la cuenta de la Dra.

1. En el servicio **app** → **Console** (terminal dentro del contenedor):
   ```sh
   SEED_DRA_EMAIL=correo-de-la-dra@ejemplo.com npm run seed:prod
   ```
2. Aparece un recuadro con el **correo y una contraseña aleatoria**: **cópiala ahora** (no se vuelve a mostrar).
3. Entra a `https://julietaponz.com/login` con esos datos. Para agregar más administradores (por ejemplo tu propia
   cuenta): **Panel → Usuarios y roles → Nuevo usuario**, rol **Administrador**.
4. Si alguna vez se pierde la contraseña: «¿Olvidaste tu contraseña?» en el login (necesita el correo configurado:
   `RESEND_API_KEY` o `SMTP_*`).

## 6. Variables de entorno (App y Worker)

| Variable | Qué poner | App | Worker |
|---|---|---|---|
| `NODE_ENV` | `production` | ✔ | ✔ |
| `TZ` | `America/La_Paz` | ✔ | ✔ |
| `DATABASE_URL` | `postgres://cobra_web:CLAVE_APP@dra-ponz_postgres:5432/cobra_app` (rol de la **app**, con RLS; se crea solo al arrancar) | ✔ | ✔ |
| `DATABASE_URL_OWNER` | La Internal Connection URL de Postgres (paso 2): `postgres://postgres:CLAVE_POSTGRES@dra-ponz_postgres:5432/cobra_app` | ✔ | ✔ |
| `BETTER_AUTH_SECRET` | El secreto del paso 0 (≥ 32 caracteres) | ✔ | ✔ |
| `BETTER_AUTH_URL` | `https://julietaponz.com` | ✔ | ✔ |
| `APP_URL` | `https://julietaponz.com` | ✔ | ✔ |
| `UPLOAD_DIR` | `/data/uploads` | ✔ | ✔ |
| `RESEND_API_KEY` | Tu clave de Resend (o deja vacío y usa `SMTP_*`) | ✔ | ✔ |
| `CORREO_REMITENTE` | `Dra. Julieta Ponz <no-responder@julietaponz.com>` (dominio verificado en Resend) | ✔ | ✔ |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Solo si no usas Resend | ✔ | ✔ |
| `WHATSAPP_LANDING` | WhatsApp de la landing, con código de país, solo números (ej. `591XXXXXXXX`) | ✔ | ✔ |
| `LOGIN_MAX_POR_MINUTO` | `10` | ✔ | — |
| `DB_POOL_MAX` | `10` | ✔ | ✔ |
| `BACKUP_ENCRYPTION_KEY` | La clave del paso 0 (≥ 32 caracteres) | (opcional) | ✔ **obligatoria** |
| `BACKUP_DIR` | `/data/backups` | — | ✔ |
| `BACKUP_DIAS` | `14` | — | ✔ |
| `RCLONE_REMOTE` | Ej. `b2:mi-bucket/dra-ponz` (vacío = backups solo en el servidor; queda una advertencia en el log) | — | ✔ |
| `RCLONE_CONFIG_*` | Configuración del remoto (sección 7) | — | ✔ |
| `SEED_DRA_EMAIL` | Correo de la Dra. (solo para `npm run seed:prod`; también se puede pasar en el comando) | (opcional) | — |
| `CRON_SECRET` | Vacío (el worker ya corre los jobs). Solo si quieres llamar `/api/jobs/*` a mano | (opcional) | — |

Todo está explicado también en `.env.example`. La app y el worker **validan las variables al arrancar**: si falta una
obligatoria, el contenedor se detiene y el log dice cuál (`✗ No se puede arrancar la app: … BETTER_AUTH_SECRET: falta`).

## 7. Copia de los backups fuera del servidor (rclone)

El worker guarda cada noche, a las 02:00, `db_FECHA.dump.enc` (base) y `archivos_FECHA.tar.gz.enc` (archivos
subidos) en `/data/backups`, **cifrados** con `BACKUP_ENCRYPTION_KEY`, y borra los de más de 14 días. Para tener una
copia **fuera** del VPS (recomendado), configura un remoto de rclone solo con variables. Ejemplo con **Backblaze B2**
(barato y sencillo):

```
RCLONE_REMOTE=b2:NOMBRE-DEL-BUCKET/dra-ponz
RCLONE_CONFIG_B2_TYPE=b2
RCLONE_CONFIG_B2_ACCOUNT=<keyID de la Application Key>
RCLONE_CONFIG_B2_KEY=<applicationKey>
```

Otros proveedores (S3, Google Drive, Dropbox…): mismo esquema `RCLONE_CONFIG_<NOMBRE>_<OPCIÓN>`
(ver https://rclone.org/docs/#config-file). Para probar sin esperar a las 02:00, en el **worker → Console**:

```sh
npm run worker -- --una-vez backup
```

## 8. Auto Deploy al hacer push a `main`

En cada servicio (app y worker) → **Source** (o **Deployments**) → activa **Auto Deploy**. Si Easypanel te muestra
una **Deploy Webhook URL**, agrégala en GitHub → repo `Dra-Ponz` → Settings → Webhooks → Add webhook (Payload URL =
esa URL, evento *Just the push event*). Desde entonces, cada `git push` a `main` construye y despliega solo.
El deploy nuevo solo reemplaza al anterior si el health check da bien.

## 9. Checklist después de desplegar

- [ ] `https://julietaponz.com` abre con candado (HTTPS) y `http://` redirige a `https://`.
- [ ] `https://julietaponz.com/api/health` responde `{"ok":true,"bd":"ok",…}`.
- [ ] Login de la Dra. funciona (`/login`) y entra al panel.
- [ ] Crear una propuesta de tesis de prueba y abrir su enlace del portal desde otro navegador (o en incógnito).
- [ ] En el portal, entrar con el CI y **subir un comprobante de ~40 MB**: tiene que llegar (más de 50 MB se rechaza
      con un mensaje).
- [ ] El calendario del panel muestra las actividades.
- [ ] **Worker → Logs**: aparece `Worker listo …`; al día siguiente, `✓ mora`, `✓ tipo-cambio` y `✓ backup`.
      (Para no esperar: worker → Console → `npm run worker -- --una-vez todos`.)
- [ ] **Worker → Console** → `ls -la /data/backups`: hay archivos `.enc` de hoy (y, si configuraste rclone,
      también en tu remoto).
- [ ] Borra la propuesta de prueba.

## 10. Si algo falla

- **Ver qué pasa**: servicio → **Logs**. Los errores de arranque empiezan con `✗` y dicen qué variable o carpeta
  falta. Errores típicos:
  - `Postgres no responde…` → el servicio postgres está detenido, o el host/clave de `DATABASE_URL_OWNER` está mal.
  - `DATABASE_URL y DATABASE_URL_OWNER deben usar usuarios DISTINTOS` → la app no puede usar el usuario `postgres`.
  - `UPLOAD_DIR "/data/uploads" no existe / no se puede escribir` → falta el Volume Mount en `/data`.
- **Reiniciar**: servicio → **Restart** (o **Stop** y **Start**).
- **Volver a un deploy anterior**: servicio → **Deployments** → elige el último que funcionaba → **Redeploy** /
  **Rollback**. O en GitHub revierte el commit (`git revert <commit> && git push`) y deja que Auto Deploy lo vuelva a
  desplegar.
- **La base de datos**: postgres → Logs / Console (`psql -U postgres cobra_app`).

## 11. Restaurar un backup (paso a paso)

> Probado en local: se borraron pagos y archivos, se restauró y todo volvió; con una clave incorrecta, la
> restauración se niega.

1. **Detén la app** (servicio app → **Stop**) para que nadie escriba durante la restauración.
2. En el **worker → Console**, mira los backups disponibles:
   ```sh
   ls -la /data/backups
   ```
   Si necesitas uno que solo está en el remoto: `rclone copy "$RCLONE_REMOTE" /data/backups --include "*_2026-11-24_*"`.
3. Restaura (reemplaza **todos** los datos actuales: por eso pide `--si`):
   ```sh
   npm run backup:restaurar -- --db /data/backups/db_2026-11-24_0200.dump.enc --archivos /data/backups/archivos_2026-11-24_0200.tar.gz.enc --si
   ```
   Descifra con `BACKUP_ENCRYPTION_KEY`, restaura la base (`pg_restore --clean`), vuelve a aplicar migraciones y
   permisos del rol de la app, y extrae los archivos en `/data`. Puedes restaurar solo la base (`--db`) o solo los
   archivos (`--archivos`).
4. **Inicia la app** (Start) y revisa `/api/health` y el login.
5. Si restauraste en un VPS **nuevo**: crea primero los 3 servicios como arriba, con el mismo
   `BACKUP_ENCRYPTION_KEY`, y **no** corras `seed:prod` (los usuarios vienen en el backup).

---

### Decisiones de esta configuración

- **La landing no se cachea.** Cada visita lleva una CSP con un *nonce* aleatorio. Sin el Nginx del repo, que podía
  reemplazar el nonce en una copia cacheada, cachear la página obligaría a reusar el nonce, y eso debilitaría la
  CSP. Se priorizó la seguridad: la landing se genera en cada visita (~15 ms; un proceso aguanta unas 85 visitas
  por segundo, de sobra para este sitio). Los estáticos (`/_next/static`, fuentes, `/brand`) sí se cachean.
- **Límites de peticiones en la app** (antes los ponía Nginx): login (en la base y por cuenta), portal, subidas,
  `/marca` y `/api/jobs`, más un límite general por IP. Con varias réplicas, el del login es compartido (en la base) y
  los demás son por proceso.
- **IP real y HTTPS**: Traefik reemplaza `X-Forwarded-For` y `X-Forwarded-Proto`; la app usa el último salto que no
  es un proxy local y activa HSTS cuando la petición llegó por HTTPS.
- **Jobs con lock**: cada job toma un `pg_try_advisory_lock`; si hay dos workers, solo uno lo corre. Además los jobs
  son idempotentes.
- **Contenedor sin root** (usuario `nextjs`, uid 1001). El arranque migra con el rol dueño y la app consulta con el
  rol de la app (sin `BYPASSRLS`): el aislamiento entre organizaciones lo hace Postgres (RLS).
