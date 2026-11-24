# Cobros + Tesis

Especificación: `PROMPT_cobros_tesis.md`. Avance: `PROGRESO.md`. Decisiones: `DECISIONES.md`.

@AGENTS.md

## Comandos
- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run test` · `npm run e2e`
- BD: `npm run db:setup` (una vez) · `npm run db:generate` · `npm run db:migrate` · `npm run db:seed` · `npm run db:reset` (solo dev)
- Postgres local en el puerto 5433.
- Manual de usuario (`docs/manual/*.md`, también se ve en Panel → Ayuda): `npm run manual:capturas` (base `cobra_app_demo` + build + Playwright → `docs/manual/img`) · `npm run manual:pdf`. Si cambias una pantalla, regenera capturas y revisa el texto del manual.
- Producción (Easypanel, ver `DEPLOY_EASYPANEL.md`): `npm run build:prod` (empaqueta `scripts/prod` en `dist-prod/`) · `npm run worker` · `npm run seed:prod` · `npm run backup:restaurar`. Variables nuevas: validarlas en `src/lib/entorno.ts` y documentarlas en `.env.example`.

## Reglas
- Consultas de negocio SIEMPRE con `withOrg(orgId, tx => …)` (RLS). `withAdmin`/`dbAdmin` solo para auth, superadmin, jobs y tokens del portal.
- `src/modules/cobros` nunca importa de `src/modules/tesis` (ESLint lo impide). `core`/`lib` no importan módulos.
- Tablas/columnas en español snake_case. Dinero en centavos (`integer`). Fechas de negocio como `date` (texto YYYY-MM-DD) en America/La_Paz.
- Nueva tabla con `organizacion_id` → nueva migración custom con `SELECT aplicar_rls();` y, si tiene FK a otra tabla de negocio, `SELECT aplicar_fk_misma_organizacion();` (las FK no pasan por RLS).
- Seguridad: CSP con nonce en `src/proxy.ts`; límites en `src/lib/seguridad.ts` y Nginx; pruebas en `tests/unit/seguridad.test.ts` y `tests/e2e/seguridad.spec.ts` (ver `SEGURIDAD_Y_CARGA.md`).
- Entradas validadas con Zod en el servidor.
