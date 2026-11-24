# Manual técnico

Referencia breve para operar el sistema en producción (Easypanel): desplegar, configurar, respaldar, restaurar, restablecer contraseñas, revisar logs y resolver fallas. La guía detallada de la primera instalación está en `DEPLOY_EASYPANEL.md`.

## 1. Arquitectura en una página {#arquitectura}

**Para qué sirve:** saber qué pieza hace qué antes de tocar nada.

| Servicio (Easypanel) | Qué hace | Comando |
|---|---|---|
| **postgres** | Base de datos (Postgres 17) | imagen de Easypanel |
| **app** | Web: landing, panel, portal y ayuda. Puerto 3000, HTTPS con Traefik | `node server.js` (por defecto del `Dockerfile`) |
| **worker** | Crons: mora y recordatorios 07:00, tipo de cambio 08:00, backup 02:00 (America/La_Paz) | `npm run worker` |

- **App y worker** usan la misma imagen (`Dockerfile`) y el mismo volumen `data` montado en `/data` (`/data/uploads` archivos, `/data/backups` respaldos).
- Al arrancar, la app **migra la base** sola (con el rol dueño) y crea/ajusta el rol de la app **sin BYPASSRLS**.
- Cada negocio es una organización aislada con **RLS** de Postgres.
- Los manuales (`docs/manual`) viajan dentro de la imagen: la ayuda del panel y la guía del estudiante los leen del disco.

## 2. Desplegar y actualizar {#desplegar}

**Para qué sirve:** publicar una versión nueva sin cortar el servicio.

### Primera instalación

Sigue `DEPLOY_EASYPANEL.md` en orden: dominio → secretos → proyecto → postgres → app → worker → `seed:prod` → checklist. Resumen del primer arranque:

```sh
# Consola del servicio app
SEED_DRA_EMAIL=correo-de-la-dra@ejemplo.com npm run seed:prod
```

Imprime **una sola vez** el correo y una contraseña aleatoria de la Dra.

### Actualizar

1. `git push` a `main`.
2. Con **Auto Deploy** activo, Easypanel construye y despliega app y worker. Si no, en cada servicio: **Deploy**.
3. El contenedor nuevo reemplaza al anterior solo si el **health check** (`/api/health`) responde bien.
4. Comprueba: `https://julietaponz.com/api/health` → `{"ok":true,"bd":"ok",…}`.

> **Importante:** despliega **app y worker** con el mismo commit. Si solo actualizas uno, pueden quedar con versiones de código distintas.

### Volver a la versión anterior

Servicio → **Deployments** → elige el último que funcionaba → **Redeploy**. O `git revert <commit> && git push`.

> **Nota:** las migraciones no se deshacen solas. Si una versión nueva migró la base y necesitas volver atrás, restaura el backup previo (sección 5).

## 3. Variables de entorno {#variables}

**Para qué sirve:** saber qué configurar en **Environment** de app y worker.

Todas se validan al arrancar (`src/lib/entorno.ts`). Si falta una obligatoria, el contenedor se detiene y el log dice cuál: `✗ No se puede arrancar la app: … BETTER_AUTH_SECRET: falta`. La lista completa y comentada está en `.env.example`.

| Variable | Valor | App | Worker |
|---|---|---|---|
| `DATABASE_URL` | `postgres://cobra_web:CLAVE@dra-ponz_postgres:5432/cobra_app` (rol de la app, con RLS) | ✔ | ✔ |
| `DATABASE_URL_OWNER` | `postgres://postgres:CLAVE@dra-ponz_postgres:5432/cobra_app` (rol dueño; **distinto** del anterior) | ✔ | ✔ |
| `BETTER_AUTH_SECRET` | ≥ 32 caracteres (`openssl rand -base64 32`) | ✔ | ✔ |
| `BETTER_AUTH_URL`, `APP_URL` | `https://julietaponz.com` | ✔ | ✔ |
| `UPLOAD_DIR` | `/data/uploads` | ✔ | ✔ |
| `RESEND_API_KEY` o `SMTP_*`, `CORREO_REMITENTE` | Correo (recuperar contraseña, recordatorios). Sin ellos, los correos **no se envían** | ✔ | ✔ |
| `WHATSAPP_LANDING` | WhatsApp de la landing si la organización no tiene uno | ✔ | ✔ |
| `BACKUP_ENCRYPTION_KEY` | ≥ 32 caracteres. **Guárdala fuera del servidor** | opcional | **obligatoria** |
| `BACKUP_DIR`, `BACKUP_DIAS` | `/data/backups`, `14` | — | ✔ |
| `RCLONE_REMOTE`, `RCLONE_CONFIG_*` | Copia de backups fuera del VPS | — | ✔ |
| `LOGIN_MAX_POR_MINUTO`, `DB_POOL_MAX` | `10`, `10` | ✔ | ✔ |
| `CRON_SECRET` | Vacío (el worker ya corre los jobs) | opcional | — |

> **Importante:** al cambiar una variable, guarda y haz **Deploy** (o **Restart**) del servicio para que la tome.

## 4. Backups {#backups}

**Para qué sirve:** no perder datos si el servidor falla.

- Cada noche a las **02:00** el worker guarda en `/data/backups`:
  - `db_FECHA.dump.enc`: la base (pg_dump, formato custom).
  - `archivos_FECHA.tar.gz.enc`: comprobantes y archivos subidos.
- Ambos van **cifrados** (AES-256-GCM) con `BACKUP_ENCRYPTION_KEY`. Se guardan **14 días**.
- Si configuraste `RCLONE_REMOTE`, se copian también **fuera del VPS** (Backblaze B2, Google Drive…). Ver `DEPLOY_EASYPANEL.md`, sección 7.

Para hacer un backup ahora mismo (por ejemplo, antes de una actualización grande):

```sh
# Consola del worker
npm run worker -- --una-vez backup
ls -la /data/backups
```

> **Importante:** sin `BACKUP_ENCRYPTION_KEY` **no hay forma** de restaurar. Guárdala en tu gestor de contraseñas y en un segundo lugar.

> **Consejo:** una vez al mes, revisa que en el remoto de rclone haya archivos de los últimos días.

## 5. Restaurar un backup {#restaurar}

**Para qué sirve:** volver a un punto anterior (base, archivos o ambos).

1. **Detén la app** (servicio app → **Stop**) para que nadie escriba mientras restauras.
2. En la **consola del worker**, lista los backups:

   ```sh
   ls -la /data/backups
   ```

   Si el que necesitas solo está en el remoto:

   ```sh
   rclone copy "$RCLONE_REMOTE" /data/backups --include "*_2026-11-24_*"
   ```

3. Restaura (reemplaza **todos** los datos actuales; por eso pide `--si`):

   ```sh
   npm run backup:restaurar -- --db /data/backups/db_2026-11-24_0200.dump.enc --archivos /data/backups/archivos_2026-11-24_0200.tar.gz.enc --si
   ```

   Puedes restaurar solo la base (`--db`) o solo los archivos (`--archivos`).
4. **Inicia la app** y revisa `/api/health` y el login.

> **Nota:** en un VPS nuevo, crea primero los 3 servicios con el **mismo** `BACKUP_ENCRYPTION_KEY` y **no** corras `seed:prod`: los usuarios vienen en el backup.

## 6. Restablecer contraseñas {#contrasenas}

**Para qué sirve:** devolverle el acceso a la Dra. (o a otro usuario) cuando no puede entrar.

### Opción 1: que lo haga ella misma

- **Si sabe la actual**: menú con su nombre → **Mi cuenta y contraseña**. No necesita correo.
- **Si la olvidó**: en `/login` → **¿Olvidaste tu contraseña?** Le llega un enlace que vence en 1 hora. **Requiere el correo configurado** (sección 6.1). Si no lo está, la pantalla lo avisa («El envío de correos no está activado») y hay que usar la opción 2.

### 6.1 Activar el envío de correos (Resend)

Sin `RESEND_API_KEY` ni `SMTP_HOST`, el sistema **no envía correos**: los guarda como archivos (`.data/correos`) y en el log aparece `⚠ Sin RESEND_API_KEY ni SMTP_HOST`. Por eso «¿Olvidaste tu contraseña?» y los recordatorios por correo no llegan. Para activarlo:

1. Crea una cuenta en **resend.com** (el plan gratis alcanza: 3.000 correos al mes).
2. **Domains → Add domain** → `julietaponz.com`. Resend te da 3–4 registros DNS (TXT/MX/CNAME): agrégalos en tu proveedor de dominio y espera a que diga **Verified**.
3. **API Keys → Create API key** (permiso *Sending access*). Cópiala.
4. En Easypanel, **app y worker → Environment**:
   ```
   RESEND_API_KEY=re_xxxxxxxx
   CORREO_REMITENTE=Dra. Julieta Ponz <no-responder@julietaponz.com>
   ```
   El dominio del remitente debe ser el que verificaste. → **Deploy** de ambos servicios.
5. Prueba: `/recuperar` ya no muestra el aviso amarillo; pide el enlace con el correo de la Dra. y revisa la bandeja (y *spam*). Si falla, el log de la app muestra el error de Resend (por ejemplo, dominio no verificado).

> **Nota:** también sirve un SMTP propio (Gmail con contraseña de aplicación, Zoho…) con `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

### Opción 2: desde el servidor

```sh
# Consola del servicio app
npm run usuario:clave -- correo-de-la-dra@ejemplo.com
```

- Genera una **contraseña aleatoria** y la muestra **una sola vez**.
- Cierra todas las sesiones abiertas de ese usuario.
- Quita el bloqueo por intentos fallidos (10 fallos → 15 min).
- Si el usuario estaba **desactivado**, lo avisa: actívalo en **Panel → Usuarios y roles**.

Pásale la contraseña por un canal seguro y pídele que la cambie con «¿Olvidaste tu contraseña?».

### Usuarios del portal (estudiantes)

No tienen contraseña: entran con su **CI o PIN**. Si un estudiante perdió el PIN o su enlace no abre, la Dra. genera un **enlace nuevo** desde la ficha del plan o de la propuesta. Un bloqueo del portal (5 fallos) se levanta solo a los 15 minutos.

## 7. Ver logs {#logs}

**Para qué sirve:** entender qué pasó antes de tocar nada.

- **Easypanel → servicio → Logs**: salida en vivo de app o worker.
- Los errores de arranque empiezan con `✗` y dicen qué variable o carpeta falta.
- El **worker** escribe una línea por job: `✓ mora`, `✓ tipo-cambio`, `✓ backup` (o `⚠` / `✗` con el motivo).
- **Base de datos**: servicio postgres → **Console** → `psql -U postgres cobra_app`.

Mensajes típicos:

| Mensaje | Causa | Qué hacer |
|---|---|---|
| `Postgres no responde…` | Servicio postgres detenido o host/clave de `DATABASE_URL_OWNER` mal | Inicia postgres; revisa la URL interna |
| `DATABASE_URL y DATABASE_URL_OWNER deben usar usuarios DISTINTOS` | La app usa el usuario `postgres` | Usa `cobra_web` en `DATABASE_URL` |
| `UPLOAD_DIR "/data/uploads" no existe / no se puede escribir` | Falta el volumen | Agrega el Volume Mount `data` en `/data` |
| `Sin RESEND_API_KEY ni SMTP_HOST` | Correo sin configurar | Carga `RESEND_API_KEY` o `SMTP_*` |
| Aviso «Tipo de cambio» en el panel | El BCB no respondió | Nada: se usa la última cotización; se corrige solo |
| `"backup" ya está corriendo en otra réplica` | Dos workers | Normal: solo uno lo corre (lock) |

Para correr un job a mano sin esperar el horario:

```sh
# Consola del worker
npm run worker -- --una-vez todos      # o: mora · tipo-cambio · backup
```

## 8. Qué hacer si algo falla {#fallas}

**Para qué sirve:** una receta corta para cada problema frecuente.

| Síntoma | Primero revisa | Solución |
|---|---|---|
| La web no abre | `/api/health`, Logs de app | **Restart**; si sigue, vuelve al deploy anterior |
| Abre sin candado o error de certificado | Dominios del servicio app, DNS | Que `julietaponz.com` y `www` apunten al VPS; HTTPS activado, puerto 3000 |
| La Dra. no puede entrar | ¿Está bloqueada? ¿Llega el correo? | `npm run usuario:clave -- correo` |
| No llegan correos / «El envío de correos no está activado» | Logs (`Sin RESEND_API_KEY…`), panel de Resend | Sección 6.1: clave de Resend y dominio verificado |
| Un comprobante «no sube» | Tamaño (> 50 MB se rechaza), tipo de archivo | Pedir foto o PDF de menos de 50 MB |
| Archivos subidos no aparecen tras un deploy | Volumen `data` montado en app **y** worker | Mismo volumen en ambos (ver `DEPLOY_EASYPANEL.md`) |
| No corre la mora / no cambia el tipo de cambio | Logs del worker | Worker detenido → Start; correr `--una-vez todos` |
| Se borró algo por error | Fecha del último backup bueno | Restaurar (sección 5) |
| Disco lleno | Easypanel → Monitor; `du -sh /data/*` | Bajar `BACKUP_DIAS`, limpiar backups viejos, ampliar disco |

> **Importante:** antes de restaurar o de tocar la base a mano, haz un backup (`npm run worker -- --una-vez backup`).

## 9. Manual de usuario: capturas y PDF {#manual}

**Para qué sirve:** mantener el manual al día cuando cambie la interfaz. Se hace **en tu computadora**, no en el servidor.

```sh
npm run manual:capturas   # base demo cobra_app_demo + build + Playwright → docs/manual/img
npm run manual:pdf        # docs/manual/*.md → 4 PDF con portada e índice
```

- `manual:capturas` recrea la base **cobra_app_demo** (local, con datos ficticios), compila, levanta la app en `http://localhost:3200` y recorre cada paso del manual: panel a 1440 px y portal a 390 px. Nunca toca `cobra_app` ni envía correos.
  - `--sin-build` usa el build actual · `--sin-base` no recrea la base · `--solo=propuesta` corre solo esa parte.
  - Usuaria de la demo: `dra.demo@ejemplo.com` / `Demo-Manual-2026` (solo existe en la base local de demostración).
- Los textos están en `docs/manual/*.md`. Al cambiarlos, la **Ayuda** del panel y la guía del estudiante (`/ayuda/estudiante`) se actualizan en el siguiente deploy.
- `manual:pdf` genera `Manual-Dra-Ponz.pdf`, `Guia-Estudiante-ES.pdf`, `Guia-Estudiante-PT.pdf` y `Manual-Tecnico.pdf`. Los tres primeros se descargan desde la ayuda.

## 10. Comandos útiles {#comandos}

| Dónde | Comando | Para qué |
|---|---|---|
| Consola app | `SEED_DRA_EMAIL=… npm run seed:prod` | Primer arranque |
| Consola app | `npm run usuario:clave -- correo` | Restablecer una contraseña |
| Consola app | `npm run migrar:prod` | Aplicar migraciones a mano (normalmente no hace falta) |
| Consola worker | `npm run worker -- --una-vez todos` | Correr los jobs ahora |
| Consola worker | `npm run backup:restaurar -- --db … --archivos … --si` | Restaurar |
| Local | `npm run dev` · `npm run test` · `npm run e2e` | Desarrollo y pruebas |
| Local | `npm run manual:capturas` · `npm run manual:pdf` | Manual de usuario |
