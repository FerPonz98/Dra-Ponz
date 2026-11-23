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
