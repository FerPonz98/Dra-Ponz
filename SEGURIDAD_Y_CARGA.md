# Auditoría de seguridad y prueba de carga

Fecha: 2026-11-23 · Alcance: landing, login, panel, portal, API, jobs, scripts del VPS.
Todas las pruebas de ataque y de carga corrieron **solo en local**, contra la base de pruebas `cobra_app_test`
(servidores en 127.0.0.1). Nunca contra producción ni sitios de terceros.
Herramientas **nativas de Windows y portables** (`scripts/auditoria/instalar-herramientas.ps1` las baja a `.herramientas/`,
ignorada por git): k6, gitleaks, OWASP ZAP (con un JDK portable), Nginx para Windows; semgrep con pip en un venv.
Sin WSL ni Docker.

## Resumen

- **Seguridad:** 1 hallazgo **alto** y 13 **medios**, todos corregidos y cubiertos por tests. Sin secretos en el historial
  de git: no hay nada que rotar. ZAP (pasivo + activo, con sesión de panel y de portal) no encontró riesgo alto.
- **Carga:** con la configuración corregida (Nginx con micro-caché de la landing + PM2 en cluster + N+1 corregidos), landing
  (500), portal (200, con subidas) y panel (50) **cumplen las metas** con 0 % de errores. El pico de 1.000 usuarios queda en
  0,94 % de errores, pero con p95 de 1–3,8 s en local, limitado por Nginx para Windows; en Linux no aplica (ver "Carga").
- **Job de mora:** 48,3 s → **5,3 s** con 50.000 cuotas, sin recargos ni recordatorios duplicados.

## Hallazgos de seguridad

| # | Sev. | Hallazgo | Cómo se reprodujo | Estado |
|---|---|---|---|---|
| 1 | **Alta** | **Referencias cruzadas entre organizaciones.** RLS controla la organización de cada fila, pero las claves foráneas de Postgres se comprueban sin RLS: con un id de B, A podía crear filas *suyas* colgadas de registros de B (p. ej. cuotas en el plan de B con `guardarCuotas`). | `tests/unit/seguridad.test.ts` → "IDOR…": antes de la corrección, `guardarCuotas(tx de A, planId de B)` insertaba cuotas. | **Corregido**: migración `0012_fk_misma_organizacion` agrega 25 FK compuestas `(col, organizacion_id) → padre(id, organizacion_id)` (función `aplicar_fk_misma_organizacion()`, regla nueva en CLAUDE.md). |
| 2 | Media | Una cookie de portal seguía bajando archivos (`/api/archivos/…`) hasta 2 h después de **vencer o anularse** el enlace o suspenderse la organización. | `seguridad.spec.ts` → "tokens… vencidos o anulados no dan acceso (ni a archivos)": devolvía 200. | **Corregido** (`planesConSesionPortal` aplica las mismas reglas que `resolverToken`). |
| 3 | Media | Login: el límite era **solo por IP** y en **memoria por proceso** (se reiniciaba con cada deploy y no servía con varios procesos). Con IPs rotativas no había límite por cuenta. | `seguridad.spec.ts` → "fuerza bruta…": 10 fallos desde 10 IPs distintas. | **Corregido**: bloqueo **por cuenta** (10 fallos → 15 min, desde cualquier IP, también para correos inexistentes para no revelar cuentas; `src/core/auth/bloqueo.ts`) + límite de Better Auth guardado **en la BD** (`limites_auth`). |
| 4 | Media | Sin **Content-Security-Policy** ni **HSTS**. | `curl -I` / ZAP. | **Corregido**: CSP estricta con **nonce por petición** y `strict-dynamic` (`src/proxy.ts`), HSTS en HTTPS (app + Nginx), `Cross-Origin-Opener-Policy`, CSP mínima en `/api`. |
| 5 | Media | Login, recuperar, restablecer y alta de cliente solo tenían `onSubmit`: si se enviaba antes de cargar el JS, el navegador hacía **GET con los campos en la URL** (la **contraseña** quedaba en el historial y en los logs de Nginx). | ZAP ("Sensitive Information in URL") en el formulario de cliente. | **Corregido** (`method="post"`). |
| 6 | Media | El portal aceptaba el comprobante de **cualquier** cuota: se podía **saltar la 1.ª**. | `seguridad.spec.ts` → "subidas…": comprobante de la cuota 2 aceptado. | **Corregido** (`registrarPago` exige pagar en orden). |
| 7 | Media | Dos subidas simultáneas de la misma cuota creaban **dos pagos pendientes**. | `seguridad.test.ts` → 3 subidas en paralelo. | **Corregido**: índice único parcial `pagos_un_pendiente_por_cuota` + CHECK de montos > 0 (`0011_integridad_dinero`). |
| 8 | Media | Los mensajes de error de la **BD** (SQL, tablas, valores) podían llegar al usuario. | `seguridad.test.ts` → "los errores de la BD no llegan al usuario". | **Corregido** (`mensajeDeError` los reemplaza por un mensaje genérico y los registra en el log). |
| 9 | Media | Job diario: enviaba los correos **dentro** de la transacción de cada organización (bloqueaba filas mientras esperaba al proveedor; si fallaba a mitad, al reintentar se duplicaban correos). | Lectura de código + prueba de carga del job. | **Corregido**: correos fuera de la transacción, con reserva idempotente confirmada antes de enviar y liberada si el envío falla. |
| 10 | Media | Backups **sin cifrar** al salir del VPS (rclone). | Revisión de `scripts/backup.sh`. | **Corregido**: cifrado GPG AES-256 con `BACKUP_CLAVE_ARCHIVO` (pendiente: crear la clave, ver abajo). |
| 11 | Media | Nginx sin `limit_req`, sin `default_server` (respondía a cualquier `Host`), sin HSTS, con versión visible y `/api/jobs` expuesto (protegido solo por `CRON_SECRET`). | Revisión de `scripts/nginx/julietaponz.com.conf`. | **Corregido**: límites por IP (login 10/min, portal 60/min, general 20/s), `default_server` → 444, `server_tokens off`, `/api/jobs/` → 404 desde fuera, `limit_conn`. Validado con `nginx -t`. |
| 12 | Media | PM2 con `max_memory_restart: 700M`: bajo carga un proceso llegó a ~1,5 GB, así que PM2 lo habría **reiniciado en pleno pico**. | Prueba de carga (pico 1.000 usuarios). | **Corregido** (1500M, cluster, `kill_timeout`). |
| 13 | Media | IP del cliente para los límites tomada de `X-Forwarded-For` sin proxies de confianza. | Lectura de Better Auth (`getIPFromHeader`). | **Corregido**: `trustedProxies` 127.0.0.1/::1 (la IP real es el último salto que agrega Nginx). |
| 20 | Media | `UPLOAD_DIR` relativo + servidor standalone: los archivos subidos quedaban dentro de `.next/standalone`, que se **borra en cada deploy** (pérdida de comprobantes). | Prueba de carga del portal: la verificación no encontraba los archivos. | **Corregido**: la app rechaza rutas dentro de `.next` (test incluido). |
| 14 | Baja | Archivos servidos `inline` (PDF/imagen). | `seguridad.spec.ts` → "descargas…". | **Corregido**: siempre `attachment`, tipo correcto, `nosniff`, `CSP: sandbox`, `no-store`. |
| 15 | Baja | Portal y subidas sin límite por IP (solo el bloqueo por enlace). | Revisión. | **Corregido**: 20 intentos/min de CI/PIN y 20–40 subidas/min por IP (app) + Nginx. |
| 16 | Baja | Rutas POST propias (subidas del portal) sin verificación de `Origin` (protegidas solo por `SameSite=Lax`). | `seguridad.spec.ts` → CSRF. | **Corregido** (`exigirMismoOrigen`, responde 403). |
| 17 | Baja | `npm audit`: 4 moderadas (esbuild viejo dentro de `drizzle-kit`, solo desarrollo). `npm audit fix` proponía bajar drizzle-kit a 0.18 (rompía migraciones). | `npm audit`. | **Corregido** con `overrides` (esbuild ^0.25): 0 vulnerabilidades; `drizzle-kit generate` sigue funcionando. |
| 18 | Baja | Regex de correo con posible ReDoS (solo en el navegador). | semgrep. | **Corregido** (regex acotada). |
| 19 | Baja | `.env` sin permisos 600 forzados; sin fail2ban ni actualizaciones automáticas. | Revisión de scripts. | **Corregido** (`deploy.sh` hace `chmod 600 .env`; `setup-vps.sh` instala fail2ban y unattended-upgrades). |
| — | Info | CSP `style-src 'unsafe-inline'` (ZAP: medio). | ZAP. | **Aceptado**: lo necesitan next/font, Radix y los `style={}`; no permite ejecutar código. |
| — | Info | ZAP "Absence of Anti-CSRF Tokens". | ZAP. | **Falso positivo**: Next compara `Origin` con `Host` en las server actions y las cookies son `SameSite=Lax` (probado: una acción repetida desde otro origen se rechaza). |
| — | Info | gitleaks: `RESEND_API_KEY` en `.env.example`. | gitleaks sobre los 10 commits. | **Falso positivo**: el valor está vacío. Ningún `.env` se subió nunca. **No hay nada que rotar.** |

### Herramientas automáticas

| Herramienta | Resultado |
|---|---|
| `npm audit` | 4 moderadas (solo desarrollo) → **0** |
| gitleaks (historial completo, 10 commits) | 1 falso positivo, 0 secretos reales |
| gitleaks (carpeta) | 40 coincidencias, **todas en archivos ignorados por git** (`.env`, `.env.test`, `.next/…`) |
| semgrep (`p/javascript`, `typescript`, `react`, `nextjs`, `owasp-top-ten`, `secrets`, `nodejsscan`) | 8 avisos, ninguno explotable (JSON-LD escapado, regex de largo fijo, `Math.random` en nombres de archivos de correo de desarrollo, `Host` en Nginx cubierto por `default_server`) |
| OWASP ZAP pasivo + activo (landing, login, portal con sesión, panel con sesión; 241 URLs) | **0 altos**, 2 medios (aceptado y falso positivo, ver arriba), el resto informativo |

### Pruebas escritas (quedan en el repo)

- `tests/unit/seguridad.test.ts` (18 pruebas, BD):
  - RLS en **todas** las tablas con `organizacion_id`: leer, editar, borrar y crear (copiando filas reales de B con otro id).
  - FK compuestas, IDOR en los servicios, rol de la app sin acceso a tablas de auth.
  - Dinero: orden de cuotas, monto que sale de la cuota, subidas concurrentes, montos negativos con Zod y CHECK.
  - Inyección SQL; archivos (ejecutable renombrado, SVG/HTML, 51 MB, `../`, ZIP bomba que nunca se descomprime).
  - Errores internos, bloqueo por cuenta, límite por IP, IP no falsificable.
- `tests/e2e/seguridad.spec.ts` (18 pruebas, HTTP):
  - Cabeceras, CSP con nonce distinto por respuesta, HSTS, errores sin stack.
  - Autenticación: fuerza bruta con cambio de IP, cookies HttpOnly/SameSite, logout que invalida la sesión, sesión vencida, recuperación de contraseña que no revela el correo, CSRF.
  - Portal: bloqueo tras 5 intentos (otro navegador y otra IP), tokens de 256 bits, enlace vencido o anulado, estudiante A vs B (token, archivos, ids en el body).
  - Subidas maliciosas; descargas con autorización.
  - IDOR y permisos en el panel (sin módulo Tesis, solo el superadmin entra a /superadmin); nada sin sesión.
  - XSS en nombres, notas, textos de la landing editados desde el panel y enlaces de WhatsApp.
  - Inyección SQL en búsquedas; aprobar un pago repitiendo la server action desde el portal o desde otro origen.

### Configuración revisada

- Cabeceras: CSP (nonce + `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`), HSTS (2 años), `X-Frame-Options: DENY`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- Límites: login (Better Auth en la BD + bloqueo por cuenta + Nginx), portal (por enlace en la BD + por IP), subidas, API.
- Errores: Next en producción no muestra stack traces; los errores de la BD se reemplazan por un mensaje genérico.
- VPS: Postgres solo en localhost ✓, ufw 22/80/443 ✓, usuario sin root para la app ✓, `UPLOAD_DIR` 750 ✓, backups 600 ✓
  (+ cifrado GPG), `.env` 600, fail2ban, actualizaciones automáticas, app escuchando en 127.0.0.1 ✓.

## Carga

### Cómo se probó

- **Datos** (`tests/carga/sembrar.ts`, en `cobra_app_test`): 50 organizaciones con su asesor/a, 2.000 clientes/estudiantes,
  2.000 planes, 2.000 enlaces de portal, 300 propuestas con cronograma y actividades, 600 pagos con comprobante PDF real.
  Para el job, `tests/carga/sembrar-jobs.ts` lleva el total a **50.000 cuotas**. Esas cuotas extra también estaban durante las
  pruebas HTTP, así que el escenario es más exigente que el pedido.
- **Escenarios k6** (`tests/carga/*.js`, k6.exe nativo):
  1. Landing: 0 → 500 visitantes en 2 min y 5 min sostenido (/es y /pt).
  2. Portal: 200 estudiantes que entran con enlace + CI por el formulario real, ven sus cuotas y suben un comprobante de 2–5 MB.
  3. Panel: 50 asesores navegando por inicio con KPIs, calendario, proyectos, ficha y clientes.
  4. Pico: 1.000 usuarios mezclados (70 % landing, 20 % portal, 10 % panel), 2 min.
  5. Job de mora y recordatorios con 50.000 cuotas.
- **Orquestador:** `tests/carga/correr.mjs` mide CPU/RAM de la app y de Postgres. `tests/carga/subidas.ts` verifica que cada
  comprobante subido sea el de su estudiante, completo y sin duplicados.
- **Antes:** un proceso (`next start`), como estaba en producción (PM2 `instances: 1`).
- **Después:** la topología de producción corregida. Nginx (la **misma** configuración de `scripts/nginx`, generada por
  `tests/carga/nginx-local.mjs`) delante de **4 procesos** en cluster (`tests/carga/cluster.mjs`, round-robin como PM2 en
  Linux). Simula un VPS de 4 vCPU.
- **Hardware local:** 16 núcleos, 16 GB, Postgres 17 local con la configuración por defecto. k6, Nginx, la app y Postgres
  corrían en la **misma** máquina.
- Los límites por IP se desactivaron solo en el servidor de carga: k6 sale de una única IP y en la realidad cada visitante
  tiene la suya. Se prueban aparte en los tests de seguridad.

### Resultados antes / después

Tiempos en milisegundos. "CPU app" son núcleos usados por la app en el momento más alto.

| Escenario | Usuarios | | p50 | p95 | p99 | Errores | Pet./s | CPU app | RAM app | Meta |
|---|---|---|---|---|---|---|---|---|---|---|
| Landing | 500 | antes | 3.348 | 3.736 | 3.873 | 0 % | 85 | 1,4 núcleos | 837 MB | ✗ p95 < 500 |
| | | **después** | **5** | **277** | **620** | **0 %** | **206** | 0,2 núcleos | 906 MB | **✓** |
| Portal (vistas) | 200 | antes | 14 | 51 | 83 | 0 % | 58 | 1,3 núcleos | 874 MB | ✓ |
| | | **después** | **12** | **27** | **42** | **0,01 %** | 57 | 2,1 núcleos | 801 MB | **✓** |
| Portal (entrar con CI) | | antes / después | 28 / **24** | 89 / **105** | 139 / **166** | | | | | ✓ / ✓ |
| Portal (subir 2–5 MB) | | antes / después | 50 / **47** | 138 / **85** | 167 / **137** | | | | | ✓ / ✓ |
| Panel | 50 | antes | 99 | 2.088 | 3.042 | 0 % | 18 | 1,2 núcleos | 634 MB | ✗ p95 < 800 |
| | | **después** | **39** | **121** | **197** | **0 %** | **22** | 2,0 núcleos | 1.494 MB | **✓** |
| Pico (landing) | 1.000 | antes | 13.415 | 15.564 | 15.799 | 0 % (todo el pico) | 53 | 2,0 núcleos | 1.498 MB | ✗ |
| | | **después** | **332** | **1.068** | **1.455** | **0,94 %** (todo el pico) | **308** | 3,5 núcleos | 1.509 MB | errores ✓, tiempos ✗ |
| Pico (portal) | | antes / después | 118 / 733 | 15.322 / **2.837** | 15.735 / 20.126 | | | | | ✗ / ✗ |
| Pico (panel) | | antes / después | 14.306 / **940** | 18.725 / **3.788** | 20.690 / 28.128 | | | | | ✗ / ✗ |

- **Postgres** nunca fue el cuello de botella: CPU promedio entre 1,5 % y 4 % y RAM < 360 MB, con picos breves de 1–1,6 núcleos.
- **Integridad:** en las dos corridas, las **200 subidas concurrentes llegaron íntegras**: cada archivo es el de su estudiante y
  su cuota, del tamaño exacto, y ninguna cuota tiene dos pagos. La app nunca se cayó en ninguna prueba.
- **Pico de 1.000 usuarios en local:** el ~1 % de errores viene de **Nginx para Windows**, que usa `select()` y no puede manejar
  más de **1.024 conexiones** (en el log: "maximum number of descriptors supported by select() is 1024"). En el VPS (Linux,
  `epoll`) ese límite no existe, así que la cifra local es **pesimista**. Por la misma razón, una corrida con 8 procesos no fue
  una medición válida (22 % de errores, todos de Nginx).
- **Job de mora** (50.000 cuotas, 17.019 planes, 52 organizaciones):

| | Primera corrida | Segunda corrida (mismo día) | Recargos | Recordatorios | Duplicados |
|---|---|---|---|---|---|
| antes | 48,3 s | 32,3 s | 17.200 | 300 | 0 |
| **después** | **5,3 s** | **1,6 s** | 17.200 (idénticos) | 300 | **0** (y la 2.ª corrida no agregó nada) |

### Cuellos de botella encontrados y corregidos

1. **Render de la landing en cada visita.** La CSP con nonce obliga a renderizar en cada petición: ~16 ms de CPU por visita y un
   solo núcleo. → **Micro-caché de 10 s en Nginx con sustitución del nonce** (`sub_filter` + `$request_id`): la CSP estricta
   queda intacta, la app renderiza la landing una vez cada 10 s por idioma, y Nginx comprime con gzip.
   Costo: un cambio de textos o colores tarda **hasta 10 s** en verse en la landing (el portal y el panel, al instante).
2. **Un solo proceso de Node** (PM2 `instances: 1`, por el límite del login en memoria). → **PM2 en cluster** (`PM2_INSTANCIAS`,
   uno por vCPU). Es seguro porque los límites del login y los bloqueos ahora viven en la BD.
3. **N+1 en "Para recordar hoy"** (inicio y página de recordatorios): una consulta a la plantilla de mensaje **por cada cuota**
   (~600 por visita) y búsquedas lineales. → Plantillas en una consulta y mapas. `/panel`: **266 ms → 56 ms** sin carga.
4. **N+1 en el job de mora:** ~4 consultas por plan (~70.000 en total). → **Por lotes**: lectura en bloque por organización, mismas
   reglas (`evaluarMora`) y escritura por lotes. **48 s → 5 s**.
5. **Cachés por proceso** del tema y de los textos (`unstable_cache`): con varios procesos, al guardar solo se invalidaba uno.
   → Lectura directa en **una transacción** por visita (una o dos filas, < 1 ms), deduplicada con `cache()` de React.
   Siempre fresco en cualquier proceso.
6. **Riesgo de pérdida de datos:** con `UPLOAD_DIR` relativo, el servidor standalone guardaba los archivos dentro de
   `.next/standalone`, que `npm run build` borra en cada deploy. → La app ahora se niega a usar una ruta que caiga dentro de
   `.next` (test incluido).
7. **PM2 `max_memory_restart: 700M`** reiniciaba procesos bajo carga (llegan a 1–1,5 GB). → 1500M.
8. **Índices:** revisados con `EXPLAIN ANALYZE` con el rol de la app (RLS activo). Las consultas del inicio usan índices
   (`cuotas_org_fecha_idx`, `planes_org_cliente_idx`, `recargos_cuota_numero_uq`) y tardan ~5 ms con 1.000 cuotas por
   organización. No faltaba ningún índice.
9. **Pool de conexiones:** `DB_POOL_MAX` configurable (por defecto 10) y `connectionTimeoutMillis`. Regla: procesos × 2 pools ×
   `DB_POOL_MAX` < `max_connections` (100). Con 4 procesos: 80.
10. **Paginación:** las listas cargan a lo sumo 500 filas (`listarClientes`) y el inicio muestra 6 recordatorios. Con el volumen
    probado (40 clientes por asesor) no fue un problema. Queda como mejora si una organización pasa de ~1.000 clientes.

### ¿Cuántos usuarios aguanta un VPS?

Para afinarlo necesito los datos de tu VPS: **vCPU, RAM, tipo de disco (SSD/NVMe), ancho de banda, si Postgres corre en el
mismo servidor y qué proveedor/plan es**. Mientras tanto, la estimación desde lo medido (la landing la sirve Nginx desde la
caché; el portal y el panel usan ~1 núcleo cada ~25–30 peticiones/s):

| VPS | PM2 | Landing (visitantes a la vez) | Portal (estudiantes a la vez) | Panel (asesores a la vez) | Mezcla realista con p95 < 1 s |
|---|---|---|---|---|---|
| 2 vCPU / 4 GB | 2 procesos | ~1.500 | ~150 | ~30 | **~400 usuarios a la vez** |
| 4 vCPU / 8 GB | 4 procesos | ~3.000 | ~300 | ~60 | **~800 usuarios a la vez** |

"A la vez" significa navegando en el mismo momento, con pausas de lectura de 1–8 s como en las pruebas. Para la Dra. (una
asesora, decenas de estudiantes) incluso el VPS de 2 vCPU sobra por mucho: el riesgo real era un pico en la landing (por
ejemplo, un anuncio compartido por WhatsApp), y eso ahora lo absorbe Nginx. Con 1 GB de RAM por proceso, en un VPS de 2 GB
conviene `PM2_INSTANCIAS=1`.

## Pendientes que dependen de ti

1. **Datos del VPS** (ver arriba) para afinar la capacidad y `PM2_INSTANCIAS` (= vCPU, ≈1–1,5 GB de RAM por proceso).
2. **Desplegar la configuración nueva:** copiar `scripts/nginx/julietaponz.com.conf` (crea `/var/cache/nginx/cobros_landing`),
   `sudo nginx -t && sudo systemctl reload nginx`, y luego `./scripts/deploy.sh`. Las migraciones 0010–0012 corren solas.
3. **Clave de los backups:** `openssl rand -base64 32 > ~/.backup-clave && chmod 600 ~/.backup-clave`, poner
   `BACKUP_CLAVE_ARCHIVO` en `.env` y **guardar una copia de la clave fuera del VPS** (sin ella no se pueden restaurar).
4. **SSH solo con llave:** `PasswordAuthentication no` y `PermitRootLogin no` en `/etc/ssh/sshd_config` (no lo automaticé para
   no dejarte afuera del servidor).
5. `UPLOAD_DIR` en el `.env` del VPS debe ser **absoluto** (`/var/data/uploads`). La app ahora rechaza rutas dentro de `.next`.
6. Si el VPS tiene 4 GB o más, subir `shared_buffers` de Postgres a ~25 % de la RAM y `effective_cache_size` a ~50 %.
7. **No hay nada que rotar:** ningún secreto se subió al repositorio.

## Cómo repetirlo

```powershell
powershell -ExecutionPolicy Bypass -File scripts\auditoria\instalar-herramientas.ps1   # k6, gitleaks, JDK+ZAP, nginx (portables)
node scripts/con-entorno.mjs .env.test -- npm run db:setup          # y luego db:migrate y db:seed (base cobra_app_test)
node scripts/con-entorno.mjs .env.test -- npx tsx tests/carga/sembrar.ts           # + tests/carga/sembrar-jobs.ts
node scripts/con-entorno.mjs .env.test -- npx tsx tests/carga/medir-jobs.ts despues
node scripts/con-entorno.mjs .env.carga -- node tests/carga/cluster.mjs 4          # servidor de carga (cluster de 4)
node tests/carga/nginx-local.mjs iniciar                                             # nginx local con la config de producción
node tests/carga/correr.mjs landing despues BASE_URL=http://127.0.0.1:8088 PUERTO_APP=3500   # y portal, panel, pico
node scripts/con-entorno.mjs .env.test -- npx tsx tests/carga/subidas.ts verificar
node scripts/auditoria/zap.mjs                                                       # ZAP pasivo + activo (solo localhost)
```

`.env.test` y `.env.carga` son copias locales de `.env` (ignoradas por git) que apuntan a `cobra_app_test`. El envoltorio
`scripts/con-entorno.mjs` se niega a correr si el archivo apunta a la base de desarrollo o a producción.

## Revisión final

| Paso | Resultado |
|---|---|
| typecheck | ✅ 0 errores |
| lint | ✅ 0 errores, 0 avisos |
| build | ✅ |
| test (Vitest) | ✅ 82/82 (19 nuevas de seguridad) |
| e2e (Playwright) | ✅ 44/44 (18 nuevas de seguridad; 2 omitidas por proyecto a propósito) |
| npm audit | ✅ 0 vulnerabilidades |
