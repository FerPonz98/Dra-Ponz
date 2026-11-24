# Decisiones

Cuando el prompt no fue explícito se eligió la opción más simple y segura. Agrupadas por fase.

## Fase 0 — Setup y núcleo

- **PlantillaWEB**: existe en `C:\FEPZON\PlantillaWEB`, pero es Spring Boot + Thymeleaf (Java). El stack obligatorio es
  Next.js/TypeScript, así que **no se reutiliza su código**; sí su diseño: permisos `modulo:accion` por rol, módulos
  activables por el superadmin, roles creados por el admin, mensaje de login genérico y auditoría por acción.
- **PostgreSQL local**: el instalador dejó PostgreSQL 17 en el **puerto 5433** (el 5432 lo ocupan Docker Desktop y
  WSL en este equipo). `.env` apunta a 5433. En el VPS se usa el 5432 estándar.
- **Base `cobra_app`** (nombre que dio el usuario) con dos roles creados por `npm run db:setup`:
  - `cobra_owner`: dueño de las tablas; corre migraciones, Better Auth, superadmin, jobs y la resolución de tokens del
    portal. Como dueño, RLS no le aplica.
  - `cobra_web`: rol de la app (`NOSUPERUSER NOBYPASSRLS`). Toda consulta de negocio usa `withOrg(orgId, fn)`, que
    abre una transacción y hace `set_config('app.organizacion_id', id, true)` (equivale a `SET LOCAL`, no se filtra
    entre conexiones del pool).
  - Variables: `DATABASE_URL` (app), `DATABASE_ADMIN_URL` (dueño), `PG_SUPERUSER_URL` (solo setup).
- **RLS**: función SQL `aplicar_rls()` que activa RLS y crea la política `aislamiento_organizacion` en toda tabla con
  `organizacion_id`. Cada migración nueva la vuelve a llamar. `organizaciones` tiene su propia política (`id = …`).
  Las tablas de Better Auth (`usuarios`, `sesiones`, `cuentas`, `verificaciones`) no llevan RLS y el rol de la app no
  tiene permisos sobre ellas (`REVOKE` en `db:migrate`); solo las usa el rol dueño.
- **Better Auth**: tablas en español (`usuarios`, `sesiones`, `cuentas`, `verificaciones`) con columnas snake_case en
  español; las claves en TypeScript conservan los nombres que Better Auth espera (`email`, `name`…). Registro
  público desactivado (`disableSignUp`): las cuentas las crea el superadmin (organización + admin) o el admin.
  Recuperación con `requestPasswordReset` y correo. Rate limit: 10 intentos/min en `/sign-in/email`.
- **Correo**: Resend si hay `RESEND_API_KEY`, SMTP si hay `SMTP_HOST`; si no, se guarda como JSON en
  `./.data/correos` (desarrollo).
- **Next.js 16.4**: `cacheComponents` y React Compiler (que la plantilla trae activos) se **desactivan**: render
  dinámico clásico y compatibilidad con React Hook Form. `middleware` ahora se llama `proxy.ts` (solo chequeo
  optimista de la cookie; la verificación real está en cada página y acción). `forbidden()` con `authInterrupts`.
- **shadcn/ui**: el CLI es interactivo; los componentes (Button, Input, Card, Badge, Table) se escribieron a mano
  con la misma API y dependencias (cva, tailwind-merge, Radix Slot).
- **Permisos**: catálogo fijo en `src/core/permisos.ts` (`cobros:ver/editar/aprobar`, `tesis:ver/editar`,
  `organizacion:configurar`, `usuarios:gestionar`). El rol "Administrador" (`es_admin`) tiene todos. Un permiso de
  un módulo apagado no cuenta. Se crean "Administrador" y "Asistente" con cada organización.
- **Regla de módulos**: ESLint `no-restricted-imports` impide `cobros → tesis` y `core/lib → modules`. La capa
  `src/app` (rutas) sí puede combinar ambos módulos.
- **Organización suspendida**: sus usuarios no pasan `requerirOrganizacion` (se los manda al login).
- **Pruebas sobre la misma base**: Vitest y Playwright usan `cobra_app`; los tests crean organizaciones temporales con
  slug `test-*` y las borran al final. Los E2E crean datos con sufijos aleatorios.

## Fase 1 — Cobros: clientes, planes, pagos y portal

- **Dinero en centavos** (`integer`) y fechas de negocio como `date` (`YYYY-MM-DD`) calculadas en la zona de la
  organización (`America/La_Paz`). Formato en pantalla `Bs 1.250,00` / `R$ 1.250,00`.
- **Cuotas editables siempre**: montos y fechas (pasadas o futuras) de cuotas pendientes; las fechas también de las
  pagadas. Una cuota **pagada** no cambia de monto ni se puede quitar; una con comprobante en revisión no se puede
  quitar. Cada cambio queda en `historial_plan` (quién, cuándo, campo, antes → después).
- **Plan aceptado**: un plan creado en Cobros nace aceptado (el negocio lo crea cuando el cliente ya aceptó). Los
  planes creados desde Tesis nacen sin aceptar hasta que el estudiante acepta en su enlace.
- **Enlace del portal**: token de 32 bytes aleatorios (base64url, 43 caracteres). Se guarda en claro con índice único
  porque el negocio debe poder reenviarlo por WhatsApp; el acceso exige además CI o PIN. Anular = el token pasa a
  `NULL` (deja de existir). Generar un enlace nuevo anula los anteriores del plan.
- **CI o PIN**: el negocio elige. CI se compara normalizado (sin espacios/puntos/guiones, mayúsculas). El PIN (6
  dígitos) se guarda como HMAC-SHA256 con `BETTER_AUTH_SECRET` y se muestra **una sola vez** al generarlo.
- **Bloqueo**: 5 intentos fallidos seguidos → 15 min bloqueado, por enlace, guardado en la BD (sobrevive reinicios).
- **Sesión del portal**: cookie httpOnly firmada (HMAC) por enlace, válida 2 h.
- **Pago**: una cuota completa por comprobante (monto + recargos). Se guarda el monto en Bs, el tipo de cambio y su
  fecha **el día que el cliente sube el comprobante**. Mientras el comprobante está en revisión la cuota no escala
  en mora ni acumula recargos (se evalúa como "en revisión").
- **Archivos**: `UPLOAD_DIR/{organizacion_id}/{categoria}/{uuid}.{ext}`; nunca se sirven como estáticos. La ruta
  `/api/archivos/[id]` exige sesión del panel de la misma organización (consulta con RLS) o sesión de portal del plan
  dueño del archivo; responde 404 en cualquier otro caso. El QR se sirve por `/p/[token]/qr` solo con sesión de portal.
  Validación por extensión **y** magic bytes (PDF, PNG/JPG/WEBP, DOC/XLS OLE, DOCX/XLSX/ZIP).
- **Límite de subida**: Next acepta hasta 52 MB por petición (`serverActions.bodySizeLimit` y
  `proxyClientMaxBodySize`) para dejar margen al multipart; el servidor aplica el límite exacto de 50 MB por archivo.
- **Plantillas de WhatsApp y botón**: se adelantaron a esta fase porque la ficha del plan las usa (ver Fase 2).

## Fase 2 — Mora, tipo de cambio, recordatorios y panel

- **Motor de mora puro** (`dominio/mora.ts`, con `hoy` inyectable):
  - `al_dia` → `vencida` (atraso ≤ gracia) → `en_cola` (atraso > gracia; se aplica el recargo) → al pagar, `al_dia`.
  - Una "mora" empieza cuando el plan pasa de `al_dia` a vencida/cola (`numero_moras` +1). La 1.ª usa `dias_gracia`;
    las siguientes, `dias_gracia_nueva_mora` (si está vacío, la normal).
  - **Plazo de la 1.ª cuota**: si el plan lo define, la cuota 1 vence `aceptado_en + X días` y al vencer pasa directo a
    cola con recargo (el plazo ya es su gracia).
  - **Recargo** sobre el monto de la cuota (no compuesto). Único: una vez al pasar la gracia. Mensual: uno más cada 30
    días de atraso pasada la gracia (`floor((atraso − gracia − 1)/30) + 1`). Se eligieron 30 días y no meses de
    calendario porque es predecible y fácil de explicar al cliente.
  - Idempotencia: índice único `(cuota_id, numero)` en `recargos` + `ON CONFLICT DO NOTHING`; `numero_moras` solo sube
    en la transición desde `al_dia`.
- **Jobs**: endpoints `POST /api/jobs/diario` (mora + recargos + correos + estados de Tesis) y
  `POST /api/jobs/tipo-cambio`, protegidos con `Authorization: Bearer CRON_SECRET`. Los crons del VPS los llaman con
  `curl`, así producción no necesita `tsx`.
- **Tipo de cambio**: se lee la fila `BRL` de la tabla del BCB (primer valor = Bs por 1 real) y se guarda con la fecha del
  día del job. Si falla: alerta en `alertas_sistema` (visible en el resumen del panel) y los pagos usan la última
  cotización guardada. La alerta se resuelve sola con la siguiente lectura correcta.
- **Correos**: 3 días antes y el día del vencimiento, solo si el cliente tiene correo. `recordatorios_enviados` con
  índice único `(cuota_id, tipo)` garantiza un solo envío aunque el job corra varias veces.
- **"Para recordar hoy"**: vencen en los próximos 3 días (no solo exactamente a 3), vencen hoy, vencidas en gracia y en
  cola. Las cuotas con comprobante en revisión no aparecen.
- **Plantillas**: las 7 plantillas base se siembran por organización; si falta una, se usa la base. Vista previa con
  datos de ejemplo al editar.
- **Rate limit del login** configurable con `LOGIN_MAX_POR_MINUTO` (10 por defecto). Los E2E levantan su propio servidor
  con un valor alto porque hacen muchos logins seguidos.
- **E2E**: `tests/e2e/preparar.ts` borra al inicio los datos E2E de corridas anteriores (los de la última corrida quedan
  para las capturas de revisión).
- **Commits**: se usa la identidad git global del equipo (no se pasa el correo por línea de comandos).

## Fase 3 — Tesis: propuestas, cronograma, vigencia, estados, revisiones, extras y PDF

- **Tesis reutiliza Cobros**: cada propuesta crea un plan con `crearPlan` (origen `tesis`, **sin aceptar**) y al editarla
  usa `guardarCuotas`, `guardarReglas` y `cambiarMonedaYTitulo` de Cobros (historial incluido). El enlace del portal es
  el de Cobros con `referencia_tipo = 'propuesta'`. Cobros no conoce a Tesis; la capa `src/app` une ambos
  (`app/panel/sincronizar.ts` y el portal `/p/[token]`).
- **Un plan no aceptado no entra en mora** (si no, una propuesta enviada con fechas pasadas acumularía recargos).
- **Estudiante** = cliente de Cobros. En el paso 1 se elige uno existente o se crea uno nuevo en el mismo formulario.
- **Asistente de 10 pasos** en una sola página (los pasos se pueden recorrer libremente). Al guardar se va a la ficha,
  donde están la vista previa (PDF), "Generar enlace y enviar" y el botón de WhatsApp (paso 10 del prompt).
- **Vigencia**: `expira_en = enviada_en + vigencia_dias`; el enlace se crea con ese mismo `expira_en`, así deja de abrir
  exactamente al vencer aunque el job todavía no haya corrido. El job diario pasa la propuesta a `vencida` y pone el
  token en `NULL` (enlace destruido). La propuesta queda guardada, se edita entera y se reenvía con un token nuevo.
- **Al aceptar** se guarda fecha y hora (`aceptada_en`), el plan queda aceptado (corre el plazo de la 1.ª cuota) y el
  enlace deja de vencer. La propuesta sigue `enviada` hasta que se aprueba la 1.ª cuota → `aceptada`; cuando llega la
  fecha de inicio del cronograma → `en_curso`.
- **Estados**: `en_gracia` y `en_cola` se derivan de la mora del plan. Al entrar en cola se marca
  `requiere_nuevo_cronograma`: aunque pague, sigue `en_cola` hasta que acepte el cronograma nuevo (fechas corridas, que
  la Dra. edita). `tribunal` y `finalizado` se marcan a mano.
- **Revisiones**: se crean la 1.ª y la 2.ª como incluidas; la 3.ª se crea cuando el estudiante la pide, con el precio de
  la propuesta, y al aprobarla se agrega una cuota al plan (vence a 7 días). Los extras funcionan igual.
- **Defensa**: no es un extra; aparece en el cronograma como actividad "a cargo del estudiante".
- **PDF** con `@react-pdf/renderer`, generado al vuelo (no se guarda): panel `/api/tesis/propuestas/{id}/pdf` y portal
  `/p/{token}/propuesta.pdf` (solo con sesión de portal).
- **Extras por defecto**: catálogo por organización con "Diapositivas para la sustentación" (Bs 300, editable en cada propuesta).

## Fase 4 — Formularios, archivos, portal del estudiante y calendario

- **Formularios**: al editar, los campos existentes conservan su id (las respuestas ya enviadas siguen asociadas). Las
  respuestas se guardan en `respuestas_formulario.valores` (JSON por etiqueta) y el estudiante puede reenviar para
  corregir (se reemplazan).
- **Tipos de archivo**: campo "archivo" → PDF, Word (.doc/.docx), Excel (.xls/.xlsx); campo "ZIP" → .zip. El paso 4
  ("subir archivos") acepta PDF, Word, Excel o ZIP, hasta 10 por envío. 50 MB por archivo, validado en el servidor por
  tamaño, extensión **y** magic bytes. Antes de escribir nada en disco se prevalidan **todos** los archivos del envío,
  para no dejar archivos huérfanos si uno falla.
- **Acceso a archivos desde el portal**: un estudiante descarga archivos de su propio plan (aunque se hayan subido con un
  enlace anterior); sin sesión, 404.
- **FullCalendar v7**: los plugins vienen dentro de `@fullcalendar/react` (`/daygrid`, `/timegrid`, tema `classic`); se
  quitaron los paquetes v6 (`@fullcalendar/core`, etc.) y se agregó `temporal-polyfill`. Vistas mes y semana, en
  español y en `America/La_Paz`.
- **Colores del calendario**: actividad (vino), actividad hecha (lila), cobro al día (verde), por vencer en ≤ 3 días
  (ámbar), en gracia (naranja), en cola (rojo), pagada (gris). Solo se muestran proyectos activos (enviados en adelante).
- **Avance %** = actividades marcadas como hechas / total del cronograma vigente. "Actividad del mes" según la fecha de
  inicio del cronograma aceptado.
- **Aceptada → en curso**: si la fecha de inicio del cronograma ya llegó, el proyecto pasa a "en curso" en la siguiente
  sincronización (al abrir la ficha o el portal, o con el job diario).

## Fase 5 — Landing ES/PT editable + SEO

- **Rutas** `/es` y `/pt` (`app/[locale]`, solo esos dos valores; el resto da 404). `/` redirige a `/pt` si el
  navegador prefiere portugués y a `/es` en cualquier otro caso.
- **Organización de la landing**: la que tenga `dominio` igual al host (con o sin `www.`); si no coincide, la de
  `LANDING_ORG_SLUG` (`dra-ponz`). Así otro cliente con Tesis podría tener su propia landing en su dominio.
- **Contenido** en `landing_contenido` (organización, idioma, clave, valor). Cada sección tiene claves de texto, listas
  (una línea por ítem) o pares (`a | b` por línea). Si una clave no está guardada se usa el texto inicial. El seed carga
  ES y PT sin pisar lo editado. **Testimonios vacíos**: la sección no se muestra hasta que la Dra. cargue alguno.
- **next-intl** solo para los textos fijos de la interfaz (botones de WhatsApp, selector, alt de la foto); los textos de
  las secciones vienen de la base.
- **`<html lang>`**: el layout raíz es único (`lang="es"`); la versión PT envuelve todo el contenido en `lang="pt"`. Se
  evitó reestructurar todas las rutas en dos layouts raíz. Lighthouse SEO y accesibilidad = 100 en ambos idiomas.
- **Foto**: si existe `public/landing/foto-dra.webp` se usa; si no, un placeholder SVG con texto alternativo.
- **WhatsApp**: número de la organización (Panel → Organización) o `WHATSAPP_LANDING`. Botón arriba, en la sección
  "¿Te pasa esto?", en "Pago en cuotas" (mitad), al final y fijo abajo en el celular.
- **Rendimiento**: la landing es 100 % server components (sin JS propio), fuentes del sistema, sin imágenes pesadas.
  `htmlLimitedBots: /.*/` para que los metadatos vayan siempre en el `<head>` (sin streaming): Lighthouse marcaba
  "sin meta description" en una corrida y lo mismo les pasa a algunas redes sociales.
- **SEO**: título y descripción editables, canonical, `hreflang` es/pt/x-default, Open Graph y Twitter, imagen OG
  generada, `sitemap.xml` con alternos, `robots.txt` (bloquea panel, portal, api y login), JSON-LD `ProfessionalService`.
- **Lighthouse**: `npm run lighthouse` usa el CLI (el API dentro de `tsx` falla por `__name`) con el Chromium de Playwright.

## Fase 6 — Producción

- **PM2 corre el servidor standalone** (`.next/standalone/server.js`), una sola instancia (el rate limit del login es en
  memoria). `ecosystem.config.js` lee `.env` sin dependencias. `deploy.sh` hace lo que pide el prompt y además copia
  `public/` y `.next/static` junto a `server.js` (el standalone no los incluye) y hace `pm2 save`.
- **Se probó el standalone**: toda la suite E2E corre también contra él (`E2E_SERVIDOR=standalone npm run e2e`).
  Como standalone hace `chdir` a su carpeta, **`UPLOAD_DIR` debe ser absoluta** en producción. Un archivo que falte en
  disco responde 404 (no 500).
- **Nginx `client_max_body_size 55M`** (el prompt pedía 50M): con 50M exactos, un archivo de 50 MB justos se rechaza
  porque la petición multipart pesa un poco más. El límite real de 50 MB por archivo lo valida la app (y Next acepta
  hasta 52 MB por petición). Si se prefiere 50M literal, cambiar esa línea: solo afecta a archivos al borde del límite.
- **Crons** con `curl` a los endpoints protegidos por `CRON_SECRET` (no hace falta `tsx` en producción). El servidor
  queda en `America/La_Paz` (`setup-vps.sh`) para que las horas del crontab sean las locales.
- **Backups**: `pg_dump` formato custom con el rol dueño + tar de `UPLOAD_DIR`, rotación local y remota de 14 días,
  copia fuera del VPS con `rclone` (`RCLONE_REMOTE`); si está vacío, avisa en el log.
- **Usuarios y roles** (núcleo, se completó en esta fase): el admin de la organización crea roles con permisos por
  módulo y usuarios con contraseña inicial; puede cambiar el rol o desactivar (cierra sus sesiones). No puede
  desactivarse a sí mismo. Los roles se validan con RLS (solo los de su organización).

## Rediseño de la interfaz (sin cambios de lógica)

- **Sistema de diseño** documentado en `DISENO.md`: tokens CSS + Tailwind 4, dos identidades (plataforma índigo/grises
  cálidos con modo oscuro; landing petróleo/dorado/crema con Fraunces + Inter). Fraunces se carga solo en la landing.
- **Modo oscuro** por cookie `tema` (la lee el layout raíz, sin parpadeo). La landing ignora el tema y queda clara.
- **Nuevas dependencias de UI**: Radix (dialog, alert-dialog, dropdown-menu, tabs) y `sonner` para toasts. Se
  descartó framer-motion: las animaciones de la landing son CSS + `IntersectionObserver` (menos JS, Lighthouse 96–100).
- **FullCalendar v7** se mantiene (stack obligatorio) con barra propia (mes/semana/lista), chips propios vía
  `eventContent` (sus clases CSS son atómicas y no se pueden estilizar) y panel lateral al hacer clic.
- **Subidas del portal** (comprobante y archivos del estudiante) pasaron de server actions a rutas `POST
  /p/{token}/comprobante` y `/p/{token}/archivos` con XHR para mostrar progreso; un archivo por petición. La validación
  del servidor no cambió; el cliente además avisa antes de subir si pasa de 50 MB.
- **Ficha del proyecto con pestañas** (Resumen, Cuotas, Cronograma, Archivos, Historial; `?tab=` para enlazar una).
- **Confirmaciones** con diálogos propios (Radix AlertDialog) en lugar de `window.confirm`.
- **Búsqueda global** `/panel/buscar` (clientes, planes y proyectos, según módulos y permisos).
- **Accesibilidad**: nueva auditoría `npm run accesibilidad` (axe WCAG 2.1 AA) en claro, oscuro, landing y portal.
- Los E2E se adaptaron a los cambios de interfaz (panel lateral de cliente, "Ya pagué, subir comprobante", diálogos,
  pestañas); los flujos probados son los mismos.

## Temas por organización y landing con movimiento

- **Tema en `core`** (`src/core/tema`), no en un módulo: lo usan la landing (tesis), el portal (cobros y tesis) y el panel.
  Tabla `organizacion_tema` con `organizacion_id` como clave primaria (una fila por organización) y RLS.
- **Sin fila = sin cambios** en panel y portal (diseño de la plataforma); la landing usa el tema por defecto. El seed crea
  la fila de la Dra. con sus colores actuales. Al guardar se sincronizan `organizaciones.color_primario/secundario`.
- **Los colores se eligen solo en Apariencia**: se quitaron los dos selectores de color del formulario de Organización
  (quedó un enlace) para no tener dos fuentes de verdad.
- **El usuario elige 5 colores; las variantes se calculan** y las de texto se corrigen solas hasta 4.5:1. Las reglas que
  dependen de su elección (texto/fondo, botón, títulos, franjas) bloquean el guardado en el cliente y en el servidor (Zod).
- **Botones de la landing con el primario del tema** (antes verde WhatsApp fijo), con el ícono de WhatsApp: así el tema
  cambia de verdad el botón principal, como pide la prueba E2E.
- **Variables en el `<head>` con `<style precedence>` de React 19** desde el servidor; cache por organización con
  `unstable_cache` + `updateTag` al guardar (Next 16 recomienda `use cache`, pero exige activar Cache Components en todo
  el proyecto).
- **Tailwind 4 no tiene `tailwind.config`**: el equivalente a `theme.extend.colors` es `@theme inline` en `globals.css`
  (`--color-tema-*: var(--color-*)`).
- **Motion se adopta ahora** (antes se había descartado) porque se pidió explícitamente; se usa solo donde aporta
  (scroll, inclinación, línea de proceso) con `LazyMotion` diferido. Lo demás es CSS para no retrasar el LCP.
- **Manchas con `radial-gradient`** en vez de `filter: blur`: con blur Lighthouse móvil bajó a 75 (≈0,5 s de render).
- **Botón flotante de WhatsApp tras la portada** en todos los tamaños (antes fijo desde el inicio solo en el celular);
  se ajustó el E2E de la fase 5.

## Auditoría de seguridad y carga

- **FK compuestas con `organizacion_id`** (además de RLS): las claves foráneas de Postgres no pasan por RLS. Regla nueva:
  `SELECT aplicar_fk_misma_organizacion();` en la migración de cada tabla con FK a otra tabla de negocio.
- **Límites de login en la BD** (`limites_auth`) + **bloqueo por cuenta** (`intentos_login`): permite PM2 en cluster.
- **CSP con nonce por petición** en `src/proxy.ts`. La landing se cachea 10 s en Nginx reemplazando el nonce marcador por
  `$request_id` (`sub_filter`): CSP estricta y la landing aguanta picos. Costo aceptado: los cambios de la landing tardan ≤ 10 s.
- **Sin `unstable_cache` para el tema ni los textos**: con varios procesos solo se invalidaba en uno. Se leen frescos en una
  transacción por visita (es poco y es rápido).
- **Descargas siempre `attachment`**, con `CSP: sandbox`.
- **Cuotas en orden** en el portal y un solo pago pendiente por cuota (índice parcial).
- **Herramientas de auditoría portables y nativas de Windows** (`.herramientas/`, sin WSL ni Docker).

## Despliegue en Easypanel

- **Imagen única (`Dockerfile`) para app y worker**: el worker es el mismo contenedor con `npm run worker`. Las
  migraciones corren en el arranque (`docker-entrypoint.sh`) con el rol dueño y un `pg_advisory_lock`; el rol de la app
  se crea/ajusta solo y siempre sin `BYPASSRLS`.
- **Sin Nginx**: Traefik pone el HTTPS; la app aplica cabeceras, límites por IP (`src/proxy.ts`) y el límite de 50 MB.
- **La landing NO se cachea en Easypanel**: cachearla obligaría a reusar el nonce de la CSP. Se prioriza la seguridad
  (~15 ms por visita). El micro-caché con reemplazo del nonce queda solo para el Nginx del repo (`LANDING_CACHE_NGINX=1`).
- **Crons en un worker con node-cron (America/La_Paz)** en vez de llamadas HTTP: cada job con `pg_try_advisory_lock`
  para que dos réplicas no lo corran a la vez. `/api/jobs/*` siguen disponibles con `CRON_SECRET`.
- **Backups cifrados AES-256-GCM** (clave derivada con scrypt de `BACKUP_ENCRYPTION_KEY`), 14 días en `/data/backups`
  y copia externa con rclone configurado por variables. Restauración probada en local.
- **Validación del entorno con Zod al arrancar** (`src/lib/entorno.ts`): si falta algo, el proceso termina con código 1
  y el log dice qué variable o carpeta falta.
