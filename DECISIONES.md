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
