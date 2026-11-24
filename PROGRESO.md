# Progreso

## Pendientes que dependen del usuario

- [ ] Foto de la Dra. (reemplazar el placeholder de la landing).
- [ ] Testimonios reales (la sección está vacía y es editable).
- [ ] Imagen del QR real de cobro (Panel → Organización).
- [ ] Número de WhatsApp real de la Dra. (`WHATSAPP_LANDING` y Panel → Organización); hoy es `59100000000`.
- [ ] Dominio `julietaponz.com` apuntando al VPS (DNS A/AAAA).
- [ ] Clave de Resend (`RESEND_API_KEY`) o datos SMTP; sin ellos los correos quedan en `./.data/correos`.
- [ ] Acceso al VPS (IP, usuario SSH) para el despliegue, y un remoto de rclone (Backblaze B2, Google Drive, etc.)
      para la copia de backups fuera del VPS (`RCLONE_REMOTE`).
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

## Fase 4 — Formularios, archivos/ZIP, portal del estudiante, calendario y avance ✅

**Hecho**
- Creador de formularios (texto corto/largo, fecha, selección, archivo PDF/Word/Excel, ZIP; obligatorio/opcional, ayuda, orden).
- Portal del estudiante completo: 1) revisar y aceptar (fecha y hora) → 2) pagar 1.ª cuota con QR + comprobante →
  3) formulario → 4) subir archivos → 5) avance (barra %, actividad del mes, próxima cuota, revisiones). Pide la 3.ª
  revisión y extras (diapositivas).
- Ficha de la Dra.: archivos, respuestas del formulario, aprobación de solicitudes (agrega la cuota), avance.
- Calendario FullCalendar (mes/semana) con actividades y cobros por color, con leyenda.

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck | ✅ 0 errores |
| lint | ✅ 0 errores, 0 avisos |
| build | ✅ |
| test | ✅ 54/54 (+3): validación de respuestas (obligatorios, fecha, selección, 51 MB), ids estables al editar, respuestas con PDF y ZIP, 51 MB y ZIP falso rechazados, subida libre con `.exe` rechazado |
| e2e | ✅ 15/15, incluye **E2E del estudiante completo** (formulario creado → propuesta → aceptar → pagar → aprobación → formulario con archivos → 51 MB rechazado → ZIP subido → descarga solo con sesión → pide 3.ª revisión y diapositivas → Dra. marca actividades (22 %) y aprueba → estudiante ve avance → calendario mes/semana) |
| Revisión manual | ✅ `revisiones/fase-4/` incluye el portal con sesión a 375 px (`portal-estudiante-con-sesion-movil.png`), sin desborde horizontal |
| Seguridad | ✅ archivos del portal 200 con sesión / 404 sin ella (E2E); magic bytes; prevalidación antes de escribir; acciones del portal atadas a la propuesta del enlace |

## Fase 5 — Landing ES/PT editable + SEO ✅

**Hecho**
- Landing pública `/es` y `/pt` con las 11 secciones y los textos iniciales del prompt (sin testimonios inventados).
- Botón de WhatsApp "Quiero un diagnóstico de mi tesis" / "Quero um diagnóstico da minha tese" arriba, a la mitad, al
  final y fijo en el celular.
- Editor en el panel (Tesis → Landing pública) por idioma, para todas las secciones y el SEO.
- SEO: metadatos, OG/Twitter, imagen OG, sitemap, robots, hreflang, JSON-LD.

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck / lint / build | ✅ 0 errores / 0 avisos / ok |
| test | ✅ 54/54 |
| e2e | ✅ 20/20 (+5): secciones y 4 CTA, PT y selector, CTA fijo en 375 px, sitemap/robots/OG, raíz según idioma, edición desde el panel reflejada en la landing, testimonios solo si existen |
| **Lighthouse (móvil)** | ✅ `/es`: rendimiento **99**, accesibilidad **100**, buenas prácticas **100**, SEO **100** · `/pt`: **96 / 100 / 100 / 100** (informes en `lighthouse/`) |
| Revisión manual | ✅ `revisiones/fase-5/` (el CTA fijo aparece en medio de la captura de página completa por cómo se toman; en pantalla queda abajo) |
| Seguridad | ✅ la landing no expone datos privados; el botón de WhatsApp de la landing es el contacto público de la Dra. (los botones de recordatorio siguen solo en el panel) |

## Fase 6 — Producción ✅

**Hecho**
- `scripts/deploy.sh`, `ecosystem.config.js` (PM2), `scripts/nginx/julietaponz.com.conf` (julietaponz.com + www, proxy a
  Next, Certbot), `scripts/backup.sh` (pg_dump + tar, 14 días, rclone), `scripts/crontab.txt`, `scripts/setup-vps.sh`
  (Postgres solo en localhost, ufw 22/80/443, zona horaria, PM2 al arranque), `.env.example` completo, `README.md`.
- Núcleo completado: página **Usuarios y roles** (roles con permisos por módulo, alta de usuarios, cambiar rol, activar/desactivar).

**Checklist de la sección 9**
| Ítem | Estado |
|---|---|
| `deploy.sh`: git pull, npm ci, db:migrate, build, pm2 reload | ✅ (+ copia de estáticos del standalone y `pm2 save`) |
| `ecosystem.config.js` (PM2) | ✅ verificado que carga y apunta a `server.js` |
| Nginx julietaponz.com + www, `client_max_body_size`, proxy a Next, Certbot | ✅ (55M, ver DECISIONES) |
| `backup.sh`: pg_dump + tar de UPLOAD_DIR, rotación 14 días, rclone configurable | ✅ (sintaxis verificada con `bash -n`) |
| Crons: mora/recordatorios 07:00, tipo de cambio 08:00, backup 02:00 (America/La_Paz) | ✅ `scripts/crontab.txt` |
| Postgres solo en localhost, ufw 22/80/443 | ✅ `scripts/setup-vps.sh` |
| `.env.example` con todas las variables | ✅ |
| Sin Docker | ✅ |

**Revisión final (sección 8)**
| Paso | Resultado |
|---|---|
| typecheck | ✅ 0 errores |
| lint | ✅ 0 errores, 0 avisos (se comprobó que la regla cobros ⇏ tesis falla con una importación prohibida) |
| build | ✅ sin avisos |
| test (Vitest) | ✅ 9 archivos, **54/54** |
| e2e (Playwright) | ✅ **21/21** con `next start` y **21/21** con el servidor standalone de PM2 (2 omitidos por proyecto a propósito) |
| Lighthouse móvil | ✅ `/es` 98/100/100/100 · `/pt` 98/100/100/100 (rendimiento/accesibilidad/buenas prácticas/SEO) |
| Revisión manual | ✅ `revisiones/fase-0` … `fase-6` (escritorio y 375 px) |
| Seguridad | ✅ archivos solo con sesión (panel con RLS o portal del mismo plan), tokens de 256 bits, WhatsApp de recordatorios solo con sesión, Zod en todas las acciones, `.env` fuera del repo (verificado también en el historial), `CRON_SECRET` en tiempo constante, rol de la app sin BYPASSRLS |

## Rediseño de la interfaz ✅

**Hecho**
- Sistema de diseño (`DISENO.md`) y componentes unificados en `src/components/ui` (botón, campos, tarjeta, badge,
  tabla de datos, diálogos, menú, pestañas, toasts, estados vacíos, skeletons, KPI, línea de tiempo, zona de archivos).
- Panel: barra lateral colapsable con íconos y grupos, barra superior con buscador, organización y menú de usuario,
  modo oscuro, menú inferior + drawer en el celular. Inicio con KPI (ícono, variación, mini gráfico), "Para recordar
  hoy" con WhatsApp y comprobantes con vista previa. Tablas con búsqueda/filtro/orden/paginación y tarjetas en el celular.
  Asistente de propuesta con stepper, validación en línea y resumen lateral. Calendario propio. Ficha de proyecto con
  anillo de avance, pestañas e historial en línea de tiempo.
- Portal: encabezado con la marca, pasos con progreso, próxima cuota destacada, QR grande con monto en Bs,
  "Ya pagué, subir comprobante", arrastrar y soltar con barra de progreso.
- Landing ES/PT: portada serif con foto en arco y credenciales, cifras animadas, servicios con íconos, línea de tiempo
  horizontal/vertical, trayectoria, acordeón, cierre en bloque de color, botón flotante de WhatsApp.
- Capturas antes/después de 28–30 pantallas en 1440 y 375 px: `revisiones/diseno-antes/`, `revisiones/diseno-despues/`
  (+ `oscuro/`).

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck | ✅ 0 errores |
| lint | ✅ 0 errores, 0 avisos |
| build | ✅ |
| test | ✅ 54/54 |
| e2e | ✅ 21/21 con `next start` y 21/21 con el servidor standalone (2 omitidos por proyecto a propósito) |
| Lighthouse móvil | ✅ `/es` 96/100/100/100 · `/pt` 99/100/100/100 |
| Accesibilidad (axe WCAG 2.1 AA) | ✅ 0 violaciones serias o críticas en panel (claro y oscuro), landing y portal |

## Temas por organización + landing con movimiento ✅

**Hecho**
- Tabla `organizacion_tema` (migraciones `0008_tema`, `0009_rls_tema` con RLS y CHECK), seed con los colores actuales de la Dra.
- Configuración → Apariencia: 7 presets, selectores de color (color + HEX), 4 fuentes serif + 4 sans (`next/font`),
  bordes recto/suave/redondeado, vista previa en vivo (landing + tarjeta del portal), contraste AA con sugerencias,
  Guardar / Descartar cambios / Restaurar valores por defecto.
- Variables CSS generadas en el servidor e inyectadas en el `<head>` de la landing y el portal (y el primario en el panel),
  cache por organización invalidada al guardar. La landing y la imagen OG ya no tienen colores fijos.
- Landing con movimiento (Motion + CSS): ver la guía en `DISENO.md`. Videos y capturas en `revisiones/animaciones/`.

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck | ✅ 0 errores |
| lint | ✅ 0 errores, 0 avisos |
| build | ✅ |
| test | ✅ 63/63 (9 nuevas de temas: presets AA, variantes, rechazo de contraste, CSS, guardado y RLS A/B) |
| e2e | ✅ 26/26 (2 omitidos por proyecto a propósito); 4 nuevas en `fase7-tema.spec.ts` |
| Lighthouse móvil | ✅ `/es` 99/100/100/100 · `/pt` 98/100/100/100 |
| Accesibilidad (axe WCAG 2.1 AA) | ✅ 0 violaciones serias o críticas (incluye Apariencia en claro y oscuro) |

## Auditoría de seguridad y carga ✅

Ver `SEGURIDAD_Y_CARGA.md`: 1 hallazgo alto y 13 medios corregidos y con tests; landing, portal y panel cumplen las metas
de carga (Nginx + PM2 en cluster); job de mora de 48 s a 5 s con 50.000 cuotas. Revisión: typecheck, lint, build, 82/82
tests, 44/44 e2e, npm audit 0.

## Despliegue en Easypanel ✅

Ver `DEPLOY_EASYPANEL.md`. Dockerfile multi-etapa (standalone, sin root, HEALTHCHECK `/api/health`), entrypoint con
migraciones y rol de la app, worker de crons y backups cifrados, `seed:prod`, validación del entorno. Prueba local en
modo producción (sin Docker) con `cobra_app_test` temporal: migraciones idempotentes, seed, login, subida de 40 MB y
rechazo de 51 MB, jobs, lock entre réplicas, backup, restauración y fallos claros de configuración. Revisión:
typecheck, lint, build, 88/88 tests, 51/51 e2e.

## Manual de usuario ✅

**Hecho**
- Tres manuales en `docs/manual/` (Markdown + PDF con portada de marca, índice con números de página y capturas):
  `Manual-Dra-Ponz` (15 secciones, 60 págs.), `Guia-Estudiante-ES` y `Guia-Estudiante-PT` (6 págs. de contenido, celular)
  y `Manual-Tecnico` (Easypanel, variables, backups, restaurar, contraseñas, logs, fallas).
- Capturas reproducibles: `npm run manual:capturas` recrea la base **cobra_app_demo** con datos ficticios, compila, levanta
  la app en el puerto 3200 y recorre cada paso del manual con Playwright (panel 1440 px, portal 390 px) con recuadros
  numerados y flechas → `docs/manual/img/` (~95 capturas). `npm run manual:pdf` genera los 4 PDF.
- Ayuda dentro del sistema: **Ayuda** en el menú del panel (manual navegable con índice y buscador sin tildes), ícono
  **?** junto al título de cada pantalla principal que lleva a su sección, y botón **¿Necesitas ayuda?** en el portal
  (abre `/ayuda/estudiante`, ES/PT, también desde «Enlace no disponible»). PDF descargables desde ambas.
- Nuevo comando de producción `npm run usuario:clave -- correo` (restablece una contraseña desde la consola: el manual
  técnico lo necesitaba y no existía otra vía si el correo no está configurado).

**Revisión del manual contra el sistema** (recorrido automatizado de cada paso; el manual se corrigió donde no coincidía)
- No existe «cambiar contraseña» dentro del panel: el manual explica cómo hacerlo con «¿Olvidaste tu contraseña?».
- Corregir el CI de un cliente no cambia el de su enlace (el enlace guarda el CI del día en que se creó): el manual
  indica generar un enlace nuevo.
- La vista «Mes» del calendario se satura: el manual recomienda «Lista» para ver los cobros.
- Tras subir el comprobante de la cuota 1, el portal pasa a mostrar la cuota 2: la guía del estudiante advierte que no
  la pague todavía.

**Cosas del sistema que pueden confundir a una usuaria** (sin cambiar; para decidir)
1. **Recordatorios e indicadores de propuestas no aceptadas**: «Para recordar hoy», «Vencido» y «Por cobrar» incluyen
   cuotas de planes de propuestas en borrador, enviadas o vencidas (nunca aceptadas). La Dra. podría «recordarle» una
   cuota a alguien que no aceptó. En la demo se movieron esas fechas al futuro para que las capturas no lo muestren.
2. **Portal tras enviar el comprobante de la 1.ª cuota**: el recuadro sigue titulado «2. Paga la primera cuota con QR»
   pero ya muestra la cuota 2 con su QR; un estudiante puede pensar que debe pagar otra vez.
3. **Estado «Enviada» después de que el estudiante aceptó**: pasa a «Aceptada» recién cuando la Dra. aprueba la 1.ª
   cuota; mientras tanto la lista dice «Enviada» (la ficha sí dice «Aceptada por el estudiante el …»).
4. ~~No hay «cambiar contraseña» con sesión iniciada~~ → resuelto: **Mi cuenta y contraseña** (ver abajo).
5. **Un pago aprobado por error no se puede revertir** desde el panel.
6. **Portal solo en español**, aunque hay estudiantes brasileños (la guía PT traduce cada botón).
7. **Calendario «Mes»**: las actividades (barras de un mes) tapan los cobros («+ N más»).
8. **Editor de la landing**: cambiar de idioma sin guardar pierde lo escrito, sin aviso.
9. **Badges en minúsculas y sin traducir** en revisiones y extras de la ficha (`pendiente`, `solicitada`, `hecha`,
   `ofrecido`), distintos del resto del panel.
10. **Botón de WhatsApp «propuesta por vencer»** aparece en la ficha apenas se envía la propuesta, aunque falten días.
11. Los campos de fecha muestran el formato del idioma del navegador (mm/dd/aaaa en un navegador en inglés).

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck / lint | ✅ 0 errores / 0 avisos |
| test | ✅ 95/95, incluye `tests/unit/manual.test.ts`: Markdown escapado, `javascript:` bloqueado, nombres de imagen, cada «?» apunta a una sección existente, toda imagen referida existe, guías ES/PT con las mismas secciones |
| e2e | ✅ 52/52 (3 omitidos por proyecto, como antes); nuevo en `seguridad.spec.ts`: «ayuda y manuales»: sin salida de carpeta en `/ayuda/img`, PDF de la Dra. solo con sesión, guía pública con `noindex` |
| Capturas | ✅ recorrido completo sin errores contra `cobra_app_demo` |

## Eliminar registros, foto de la landing y cambiar contraseña ✅

**Hecho**
- **Eliminar** con confirmación (botón rojo en cada ficha): cliente (con sus propuestas, planes, pagos y archivos),
  plan de pagos suelto (los de tesis se eliminan desde la propuesta), propuesta/proyecto (con su plan) y formulario.
  Todo en una transacción con RLS + auditoría; los comprobantes y archivos se borran también del disco tras el commit.
  Aviso «… eliminado» al volver a la lista.
- **Foto de la portada** desde Tesis → Landing pública: JPG/PNG/WEBP hasta 15 MB, validada por magic bytes,
  convertida con sharp a WEBP ≤ 900×1200 sin metadatos (sin GPS). Se sirve en `/marca/{org}/foto`; reemplazar o quitar
  borra la anterior. Migración `0014_foto_landing` (columna `organizaciones.foto_landing_archivo_id`). Si no hay foto
  subida, sigue valiendo `public/landing/foto-dra.webp` o el dibujo de reemplazo.
- **«¿Olvidaste tu contraseña?» no enviaba nada**: no hay `RESEND_API_KEY` ni `SMTP_HOST` (los correos solo se guardan
  en `.data/correos`), y la pantalla igual decía «Revisa tu correo». Ahora avisa «El envío de correos no está activado»
  cuando falta la configuración, y existe **Mi cuenta y contraseña** (menú del usuario) para cambiarla sin correo.
  Cómo activar Resend: `docs/manual/Manual-Tecnico.md`, sección 6.1.
- Manuales y capturas actualizados (eliminar, foto, Mi cuenta).

**Pendiente del usuario**
- [ ] Cuenta de Resend + dominio verificado + `RESEND_API_KEY` en app y worker (sin esto no salen correos).

**Revisión**
| Paso | Resultado |
|---|---|
| typecheck / lint | ✅ |
| e2e | ✅ 58/58 (3 omitidos por proyecto). Nuevo `fase9-eliminar-foto-clave.spec.ts` 6/6: borrar plan (y comprobante del disco) y cliente; plan de tesis sin botón; propuesta con su plan; estudiante con sus propuestas; formulario; foto WEBP en la landing, archivo inválido rechazado, quitar → 404; cambiar contraseña (actual incorrecta rechazada) y entrar con la nueva; aviso de correo no configurado |
