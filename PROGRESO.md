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

## Fase 2 — Mora, tipo de cambio, recordatorios, plantillas, correos y panel ✅

**Hecho**
- Motor de mora: gracia, recargo único/mensual, gracia de nueva mora, plazo de la 1.ª cuota, cola y salida de la cola.
- Job diario idempotente (`/api/jobs/diario`) y job de tipo de cambio BCB (`/api/jobs/tipo-cambio`) con alerta y respaldo.
  Probado contra el BCB real: 1 BRL = Bs 1,97798 (22/11/2026).
- "Para recordar hoy" con botón de WhatsApp (wa.me) y mensaje listo; botón también en la ficha del plan.
- Plantillas editables con variables `{nombre} {monto} {moneda} {fecha} {enlace} {proyecto}` y vista previa.
- Correos automáticos 3 días antes y el día del vencimiento (Resend/SMTP/archivo).
- Resumen del panel: cobrado este mes, por cobrar, vencido, planes en cola, comprobantes por aprobar, recordatorios, tipo de cambio.

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck | ✅ 0 errores |
| lint | ✅ 0 errores, 0 avisos |
| build | ✅ |
| test | ✅ 45/45. Mora con fechas simuladas: gracia, paso a cola, recargo único vs mensual, recargo desactivado, plazo de 1.ª cuota, salida de la cola, nueva mora con más días, idempotencia (pura y en BD). Tipo de cambio: parseo real del BCB, conversión, respaldo a la última, alerta, idempotencia. Recordatorios: clasificación y correos una sola vez |
| e2e | ✅ 12/12: jobs exigen CRON_SECRET, cuota vencida → en cola con recargo → recordatorio con WhatsApp (también 375 px), plantillas editables, sin sesión no hay botón de WhatsApp |
| Revisión manual | ✅ `revisiones/fase-2/`. Se corrigió una carrera: el aviso "Pago aprobado" desaparecía con la tarjeta; ahora se muestra arriba de la página |
| Seguridad | ✅ jobs con secreto en tiempo constante; botón WhatsApp solo en páginas del panel (con sesión); validación Zod de plantillas |

## Fase 3 — Tesis: propuestas, cronograma, vigencia, estados, revisiones, extras, PDF ✅

**Hecho**
- Esquema de tesis (`0004_tesis`, `0005_rls_tesis`) con RLS.
- Asistente de 10 pasos: datos (estudiante nuevo o existente), moneda, plan de pagos (en Cobros), cronograma
  actividades × meses con "Cargar plantilla", mora, revisiones (2 incluidas + precio de la 3.ª), extras, formulario,
  vigencia, vista previa.
- Ficha del proyecto: PDF, generar/reenviar enlace (CI o PIN) con botón de WhatsApp, cuotas, avance %, actividades,
  revisiones y extras con aprobación (agrega cuota), nuevo cronograma tras la cola, tribunal/finalizado, notas, historial.
- Vigencia: enlace destruido al vencer, propuesta `vencida`, editable y reenviable.
- Portal del estudiante: revisar (cuotas, cronograma, PDF) y aceptar; pagar la 1.ª cuota; aceptar cronograma nuevo; avance.

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck | ✅ 0 errores |
| lint | ✅ 0 errores, 0 avisos |
| build | ✅ |
| test | ✅ 51/51 (+6): plantilla de cronograma, avance y mes actual, máquina de estados, **vigencia: enlace invalidado, `vencida`, edición completa (moneda, cuotas, extras) y reenvío con token nuevo**, aceptación con fecha y hora, cola → nuevo cronograma → en curso |
| e2e | ✅ 13/13, incluye **crear → enviar → vencer → editar → reenviar → aceptar** (con PDF, WhatsApp, job diario y enlace viejo inutilizable) |
| Revisión manual | ✅ `revisiones/fase-3/`. Se corrigió el historial, que mostraba fechas ISO |
| Seguridad | ✅ PDF del panel exige sesión + módulo + permiso; PDF del portal exige sesión de portal del enlace; acciones del portal verifican que el enlace sea de esa propuesta |
