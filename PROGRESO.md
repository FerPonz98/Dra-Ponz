# Progreso

## Pendientes que dependen del usuario

- [ ] Foto de la Dra. (reemplazar el placeholder de la landing).
- [ ] Testimonios reales (la sección está vacía y es editable).
- [ ] Imagen del QR real de cobro (Panel → Organización).
- [ ] Número de WhatsApp real de la Dra. (`WHATSAPP_LANDING` y Panel → Organización); hoy es `59100000000`.
- [ ] Dominio `julietaponz.com` apuntando al VPS (DNS A/AAAA).
- [ ] Clave de Resend (`RESEND_API_KEY`) o datos SMTP; sin ellos los correos quedan en `./.data/correos`.
- [ ] Acceso al VPS (IP, usuario SSH) para el despliegue.
- [ ] Cambiar las contraseñas del seed (`SUPERADMIN_PASSWORD`, `DRA_PASSWORD`, `DEMO_PASSWORD`) en producción.

## Fase 0 — Setup y núcleo ✅

**Hecho**
- Next.js 16.4 (App Router, `output: 'standalone'`), TypeScript estricto, Tailwind 4, componentes estilo shadcn/ui.
- PostgreSQL 17 local (puerto 5433, contraseña dada por el usuario): `npm run db:setup` creó la base `cobra_app` y
  los roles `cobra_owner` / `cobra_web`.
- Drizzle ORM + drizzle-kit: migraciones `0000_nucleo`, `0001_rls_nucleo`; `npm run db:migrate` (con GRANT/REVOKE).
- Better Auth (sesiones en Postgres), login, salir, recuperar/restablecer contraseña por correo.
- Núcleo: organizaciones, módulos activables, roles con permisos, superadmin (crear organización, activar módulos,
  suspender, ver uso), contexto por petición, `proxy.ts`.
- RLS con `withOrg`. Regla ESLint cobros ⇏ tesis.
- Seed: superadmin, "Dra. Elizabeth Julieta Ponz Sejas" (cobros + tesis), "Demo Dentista" (solo cobros).

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck | ✅ 0 errores |
| lint | ✅ 0 errores, 0 avisos |
| build | ✅ |
| test (Vitest) | ✅ 5/5, RLS: A no lee ni escribe B; sin org no ve nada; el setting no se filtra en el pool |
| e2e (Playwright) | ✅ 7/7: redirección sin sesión, error genérico, superadmin, panel Dra. (también en 375 px), Demo sin tesis (403), usuario de org sin superadmin |
| Revisión manual | ✅ capturas en `revisiones/fase-0/` (escritorio y 375 px) |
| Seguridad | ✅ `.env` ignorado por git, `.env.example` incluido; rol de la app sin BYPASSRLS; tablas de auth revocadas al rol de la app; registro público desactivado |
