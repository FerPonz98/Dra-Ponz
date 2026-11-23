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

## Fase 1 — Cobros: clientes, planes, cuotas, pagos y portal ✅

**Hecho**
- Esquema de cobros (`0002_cobros`, `0003_rls_cobros`): clientes, planes_pago, cuotas, recargos, historial_plan,
  enlaces_portal, pagos, tipos_cambio, plantillas_mensaje, recordatorios_enviados. RLS en todas las que tienen organización.
- Clientes: lista con búsqueda (nombre, CI, celular, correo), alta y edición.
- Planes: moneda BOB/BRL, generador de cuotas, monto y fecha editables por cuota, agregar/quitar cuotas en curso,
  total automático, reglas de mora, historial completo.
- Organización: QR estático, logo, colores, datos bancarios, WhatsApp.
- Portal `/p/{token}`: acceso con CI o PIN, bloqueo 5×/15 min, cuotas y estado, QR + monto exacto en Bs, subida de
  comprobante (imagen o PDF, 50 MB), historial de pagos. El negocio puede anular el enlace.
- Comprobantes: aprobar (cuota pagada + recálculo de mora) o rechazar con motivo.
- Descarga de archivos solo autorizada.

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck | ✅ 0 errores |
| lint | ✅ 0 errores, 0 avisos (regla cobros ⇏ tesis activa) |
| build | ✅ sin avisos (se corrigió el trazado de todo el proyecto por `process.cwd()`) |
| test | ✅ 22/22: total del plan, generador, edición con historial (puro y en BD), cuota pagada protegida, token aleatorio, bloqueo tras 5 intentos (puro y BD, desbloqueo a los 15 min), cookie firmada, enlace anulado, validación de archivos (51 MB rechazado, magic bytes), RLS |
| e2e | ✅ 8/8, incluye **un cliente paga una cuota de punta a punta** (QR → cliente → plan con cuota editada → enlace CI → CI incorrecto → CI correcto → comprobante → aprobación → cuota pagada en el portal) |
| Revisión manual | ✅ `revisiones/fase-1/`. Se corrigió el editor de cuotas en 375 px (el monto quedaba muy angosto) y las tarjetas de totales (ahora 2×2) |
| Seguridad | ✅ archivos 404 sin sesión y 200 con sesión del panel (probado en E2E); botón WhatsApp ausente en el portal (E2E); tokens de 256 bits; entradas validadas con Zod en el servidor; `exigirPortal` fuera del archivo `"use server"` para que no sea invocable desde el navegador |
