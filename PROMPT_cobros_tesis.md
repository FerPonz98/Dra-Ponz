# PROMPT PARA CLAUDE CODE — Plataforma "Cobros + Tesis"

> Copia todo este archivo como primer mensaje en Claude Code, dentro de la carpeta del proyecto.

---

## 0. Cómo debes trabajar (léelo primero)

- Trabaja de forma **autónoma**: no me pidas confirmación entre pasos. Si algo es ambiguo, toma la decisión más razonable, anótala en `DECISIONES.md` y sigue.
- Avanza **por fases** (sección 7). Al terminar cada fase **revisas tú mismo** antes de pasar a la siguiente (sección 8): compila, corre lint, tests y pruebas E2E, y corrige todo lo que falle. Una fase no está terminada si algo de la revisión falla.
- Antes de escribir código, **revisa el repo actual** (`ls`, `package.json`, estructura). Si existe mi plantilla base **PlantillaWEB** (login, usuarios, roles creados por superadmin, accesos por módulo), reutilízala como núcleo. Si no está, créala tú siguiendo la sección 4.
- Lleva un `PROGRESO.md` con checklist por fase: qué hiciste, qué probaste y el resultado.
- **Sin Docker.** Todo corre directo en Node + PostgreSQL local y en mi VPS.
- Código en TypeScript estricto. Textos de la interfaz en **español** (y portugués donde se indica). Nombres de tablas y columnas en español, `snake_case`.
- Commits pequeños y claros por cada parte terminada.

---

## 1. Qué vamos a construir

Una sola aplicación web con **dos módulos**:

1. **Cobros** (producto principal, vendible a cualquier negocio: dentistas, constructoras, academias, asesores): clientes, planes de pago en cuotas, mora, recordatorios, pago por QR con comprobante, portal del cliente.
2. **Tesis** (módulo vertical que usa Cobros): propuestas de asesoría de tesis, cronograma de actividades, calendario, revisiones del tribunal, extras, formularios dinámicos, subida de archivos y landing pública de la asesora.

**Primer cliente:** Dra. Elizabeth Julieta Ponz Sejas (asesora de tesis en Cobija, Bolivia), dominio **julietaponz.com**. Ella usa Cobros + Tesis. Clientes futuros pueden tener solo Cobros.

**Multi-cliente desde el día 1:** cada negocio es una `organizacion`. Toda tabla de negocio lleva `organizacion_id` y está protegida con **Row Level Security** de PostgreSQL.

---

## 2. Stack (obligatorio)

| Parte | Tecnología |
|---|---|
| App | **Next.js** (App Router, `output: 'standalone'`), React, TypeScript |
| UI | Tailwind CSS + shadcn/ui, diseño limpio, mobile-first |
| BD | **PostgreSQL** (local y en VPS) |
| ORM | **Drizzle ORM** + drizzle-kit (migraciones versionadas) |
| Auth | **Better Auth** (sesiones en Postgres) |
| Validación | Zod + React Hook Form |
| Calendario | FullCalendar |
| PDF | @react-pdf/renderer |
| i18n | next-intl (es / pt) para la landing |
| Correo | Resend (o SMTP configurable por `.env`) |
| Archivos | Disco del servidor en `UPLOAD_DIR` (ej. `/var/data/uploads/{organizacion_id}/...`), servidos SOLO por rutas autenticadas |
| Tests | Vitest (unitarios), Playwright (E2E) |
| Producción | PM2 + Nginx + Certbot en VPS Ubuntu |

---

## 3. Arquitectura de carpetas

```
src/
  core/                 auth, organizaciones, usuarios, roles, superadmin, módulos activables
  modules/
    cobros/             clientes, planes-pago, cuotas, mora, recordatorios, pagos, portal, tipo-cambio
    tesis/              propuestas, cronograma, calendario, revisiones, extras, formularios, archivos, landing
  app/                  rutas Next.js (panel, portal, landing, api)
  lib/                  db, utilidades, i18n
drizzle/                migraciones
tests/                  unit + e2e
scripts/                deploy, backup
```

**Reglas de módulos (no negociables):**
- `tesis` puede importar de `cobros`. `cobros` **nunca** importa nada de `tesis`. Agrega una regla de ESLint (`no-restricted-imports`) que lo haga cumplir.
- Cada organización tiene módulos activos (`organizacion_modulos`). El menú, las rutas y las APIs validan que el módulo esté activo.

---

## 4. Núcleo (core)

- **Superadmin** (yo): crea organizaciones, activa o desactiva módulos, suspende organizaciones y ve su uso.
- **Organización**: nombre, logo, colores, imagen del QR estático, datos bancarios, moneda por defecto, zona horaria `America/La_Paz`, dominio o subdominio.
- **Usuarios** con rol dentro de su organización (admin de la organización). La Dra. trabaja sola, pero deja preparados roles con permisos por módulo.
- Login con correo + contraseña. Recuperación de contraseña por correo.
- RLS: cada consulta corre con `organizacion_id` de la sesión (`SET app.organizacion_id`). Incluye un test que demuestre que la organización A no puede leer datos de la organización B.

---

## 5. Módulo COBROS — requisitos

### 5.1 Clientes
Nombre, CI, celular WhatsApp (con código de país), correo, notas. Búsqueda y filtro.

### 5.2 Plan de pagos
- Moneda: **BOB** o **BRL**.
- Número de cuotas, monto **editable por cuota**, fecha de cada cuota. El total se calcula solo.
- **Todas las fechas se pueden editar siempre**, pasadas o futuras. Se pueden agregar o quitar cuotas incluso con el plan en curso. Cada cambio se guarda en un **historial** (quién, cuándo, valor antes y después).
- **Plazo para pagar la 1.ª cuota** tras aceptar (X días, lo define el negocio). Si no paga en ese plazo, se aplica el recargo (si está activado).

### 5.3 Reglas de mora (por plan; todas opcionales, el negocio llena solo las que quiere)
- Días de gracia (0–30).
- Recargo: sí/no, %, aplicación **única** o **por cada mes de atraso**.
- **Gracia en una nueva mora**: días distintos (normalmente más) para la siguiente mora.
- Estados: `al_dia` → `vencida` (dentro de la gracia) → `en_cola` (pausado, recargo aplicado) → al pagar vuelve a `al_dia`.
- Job diario que recalcula estados y recargos. Debe ser idempotente: si corre dos veces el mismo día, no duplica recargos.

### 5.4 Tipo de cambio
- Job diario que lee la cotización oficial **BRL→BOB** del Banco Central de Bolivia (https://www.bcb.gob.bo/librerias/indicadores/otras/ultimo.php) y la guarda en `tipos_cambio` (fecha, moneda, valor).
- Si falla, usa la última cotización guardada y registra una alerta en el panel.
- El QR cobra en Bs: si el plan está en BRL, el monto a pagar en Bs se calcula **el día del pago** y se guarda el tipo de cambio usado en el pago.

### 5.5 Pagos
- El cliente ve el QR estático y el monto exacto en Bs y sube el comprobante (imagen o PDF, máx. 50 MB).
- El negocio **aprueba** o **rechaza** con un motivo. Al aprobar, la cuota queda pagada y se recalcula el estado.

### 5.6 Recordatorios (sin costo)
- **Lista "para recordar hoy"** en el panel: cuotas que vencen en 3 días, que vencen hoy, vencidas y en cola.
- **Botón de WhatsApp** junto a cada cliente/cuota, visible **solo con sesión iniciada**. Abre `https://wa.me/{numero}?text={mensaje}` con el mensaje ya escrito; el usuario solo presiona Enter o edita. **No** usar la API pagada de WhatsApp.
- **Plantillas de mensaje** editables por organización, con variables `{nombre}`, `{monto}`, `{moneda}`, `{fecha}`, `{enlace}`, `{proyecto}`. Plantillas base: enviar propuesta/plan, recordatorio, cuota vencida, en cola, nuevo cronograma, pago aprobado, propuesta por vencer.
- Correo automático al cliente 3 días antes del vencimiento y el día del vencimiento.

### 5.7 Portal del cliente (sin registro)
- **Enlace único** por plan/propuesta (token aleatorio largo) + **CI o PIN** de 4–6 dígitos.
- Límite de intentos fallidos (ej. 5 y bloqueo de 15 min).
- El cliente ve sus cuotas y su estado, paga con QR, sube el comprobante y ve el historial.
- El negocio puede **anular** el enlace en cualquier momento.

### 5.8 Panel del negocio
Resumen: cobrado este mes, por cobrar, vencido, en cola. Lista de pendientes: comprobantes por aprobar, recordatorios del día.

---

## 6. Módulo TESIS — requisitos

### 6.1 Propuesta (formulario por pasos)
1. Datos: nombre del proyecto o tema, estudiante (cliente de Cobros), universidad, nivel (pregrado/posgrado).
2. Moneda (BOB/BRL).
3. Plan de pagos → **crea un plan en el módulo Cobros** (reutiliza su lógica, no la dupliques).
4. Cronograma: tabla **actividades × meses**, editable. Botón "cargar plantilla" con esta plantilla por defecto:
   - Revisión bibliográfica (todos los meses)
   - Elaboración del perfil de investigación (mes 1)
   - Elaboración de instrumentos de investigación (mes 2)
   - Recolección de información primaria — a cargo del estudiante (mes 2)
   - Sistematización de información (mes 3)
   - Análisis e interpretación de datos (mes 3)
   - Elaboración del primer borrador (mes 4)
   - Correcciones del tribunal — 2 revisiones (mes 5)
   - Defensa de la tesis — a cargo del estudiante (mes 5)
5. Reglas de mora (las de Cobros).
6. **Revisiones del tribunal**: 2 incluidas. La **3.ª revisión se cobra aparte**, con el precio que pone la Dra. en cada propuesta.
7. **Extras con precio**: diapositivas para la sustentación (configurable; se pueden crear más extras). La defensa **no** es un extra: la hace el estudiante.
8. Formulario de recolección de datos: elegir uno creado en 6.4.
9. **Vigencia del enlace** en días.
10. Vista previa → genera el **PDF** de la propuesta → genera el enlace → botón de WhatsApp para enviarlo.

### 6.2 Vigencia y reutilización
- Si el estudiante no acepta dentro de la vigencia, el **enlace se destruye** (token invalidado), pero la propuesta **queda guardada** con estado `vencida`.
- La Dra. puede abrir una propuesta vencida, **editar todo** (montos, fechas, actividades, moneda, extras) y **reenviarla** con un enlace nuevo.

### 6.3 Estados del proyecto
`borrador` → `enviada` → (`vencida` ↔ editar/reenviar) → `aceptada` (1.ª cuota aprobada) → `en_curso` ↔ `en_gracia` → `en_cola` → (paga + **nuevo cronograma** que la Dra. arma y el estudiante acepta) → `en_curso` → `tribunal` → `finalizado`.
- Al salir de la cola, la Dra. genera un **cronograma nuevo** (fechas corridas, editables) que se envía al estudiante y este debe aceptar en su enlace.

### 6.4 Creador de formularios
- La Dra. crea formularios reutilizables. Tipos de campo: texto corto, texto largo, fecha, selección, archivo (**PDF, Word .doc/.docx, Excel .xls/.xlsx**), archivo **ZIP** (para cualquier otro formato).
- Cada campo puede ser obligatorio u opcional y llevar una ayuda.
- **Límite: 50 MB por archivo**, ZIP incluido. Valida tamaño y tipo (por extensión **y** magic bytes) en el servidor.

### 6.5 Portal del estudiante (extiende el portal de Cobros)
Pasos guiados: 1) revisar y aceptar la propuesta (se guarda la fecha y la hora) → 2) pagar la 1.ª cuota con QR + comprobante → 3) llenar el formulario → 4) subir archivos → 5) ver avance (barra %, actividad del mes, próxima cuota, estado de revisiones). Puede pedir extras (diapositivas, 3.ª revisión).

### 6.6 Panel de la Dra.
- **Calendario** (FullCalendar, mes/semana) con actividades del cronograma y fechas de cobro, con colores por estado (al día, por vencer, en gracia, en cola).
- Ficha de proyecto: datos, estado, avance % (actividades marcadas como hechas / total), cuotas, archivos, notas, historial.
- Marcar actividades como hechas.

### 6.7 Landing pública julietaponz.com (ES / PT)
- Selector de idioma ES/PT. Mobile-first, rápida (Lighthouse ≥ 90 en performance y accesibilidad).
- Un solo objetivo: **botón de WhatsApp** ("Quiero un diagnóstico de mi tesis"), arriba, a la mitad, al final y fijo en el celular.
- Todo el texto **editable desde el panel** (tabla `landing_contenido` por idioma).
- Secciones y textos iniciales (cárgalos con un seed):
  1. **Portada**: "Tu tesis, de la idea a la defensa, con quien sabe lo que el tribunal va a observar." / Subtítulo: "Asesoría metodológica para tesis de pregrado y posgrado. 29 años de docencia universitaria y 58 tesis acompañadas como asesora y tribunal." / Firma: "Dra. Elizabeth Julieta Ponz Sejas — Coautora del Modelo Académico del Sistema Universitario Boliviano."
  2. **Cifras**: 29 años en la universidad · 58 tesis como asesora y tribunal · 2 libros publicados · 3 carreras acreditadas como evaluadora CEUB · más de 45 ponencias.
  3. **¿Te pasa esto?**: no sabes cómo plantear el problema ni los objetivos; el tribunal te observó; tienes datos pero no sabes analizarlos; se te acaba el plazo. Cierre: "No tienes que hacerlo solo. Lo hacemos con un plan."
  4. **Servicios**: Pregrado (perfil, instrumentos, análisis, documento final, 2 revisiones) · Posgrado (especialidad, maestría, doctorado) · Extras (diapositivas, revisiones adicionales).
  5. **Cómo trabajamos**: diagnóstico → propuesta con cronograma → avance mes a mes → revisiones del tribunal → tu defensa.
  6. **Pago en cuotas**: "Paga mes a mes en bolivianos o en reales, con QR, sin sorpresas."
  7. **Por qué con la Dra. Ponz**: coautora del Modelo Académico del SUB; coordinadora de Metodología de la Investigación (UAP); evaluadora externa CEUB; ha sido tribunal; investigadora con libros y artículos.
  8. **Trayectoria** (línea de tiempo): Magíster en Investigación en Ciencias Sociales para el Desarrollo (PIEB); Magíster en Educación Superior (UAP); candidata a Ph.D. en Educación Superior (UAP); Especialidad en Diseño Curricular (CEUB–U. de Barcelona); Licenciada en Farmacia y Bioquímica (USFX); docente en UAP, U. Cosmos, U. Domingo Savio, U. Siglo XX; Directora del Área de Ciencias Biológicas y Naturales (UAP); Presidenta de la Sociedad Boliviana de Bioquímica Clínica, filial Pando.
  9. **Testimonios**: sección vacía y editable (no inventes testimonios).
  10. **Preguntas frecuentes**: duración, cómo pago, qué pasa si me atraso, confidencialidad, quién defiende (el estudiante), carreras en las que asesora.
  11. **Cierre**: "Tu defensa empieza con una conversación." + botón de WhatsApp.
- Versión PT de los textos principales (ej. "Sua tese, da ideia à defesa, com quem sabe o que a banca vai observar.", "Quero um diagnóstico da minha tese", "Fale comigo pelo WhatsApp").
- SEO: metadatos, Open Graph, `sitemap.xml`, `robots.txt`, `hreflang` es/pt.
- Placeholder para la foto (la reemplazo yo).

---

## 7. Fases (en este orden)

| Fase | Contenido | Hecho cuando… |
|---|---|---|
| 0 | Setup: Next.js, Drizzle, Postgres, Better Auth, core (organizaciones, módulos, superadmin), RLS, ESLint de módulos, seed (superadmin + organización "Dra. Ponz" con cobros+tesis + organización "Demo Dentista" solo con cobros) | Login funciona; test RLS A≠B pasa |
| 1 | Cobros: clientes, planes, cuotas editables con historial, QR + comprobante, aprobación, portal con enlace + CI/PIN | Un cliente paga una cuota de punta a punta (E2E) |
| 2 | Cobros: mora (gracia, recargo único/mensual, nueva mora, cola), job diario, tipo de cambio BCB, recordatorios, botón WhatsApp, plantillas, correos, panel | Tests de mora pasan con fechas simuladas |
| 3 | Tesis: propuestas por pasos, plantilla de cronograma, vigencia/destrucción del enlace/reenvío, estados, revisiones, extras, PDF | E2E: crear → enviar → vencer → editar → reenviar → aceptar |
| 4 | Tesis: creador de formularios, subida de archivos/ZIP (50 MB), portal del estudiante completo, calendario, avance % | E2E del estudiante completo |
| 5 | Landing ES/PT editable + SEO | Lighthouse ≥ 90 |
| 6 | Producción: scripts de deploy y backup, README | Checklist de la sección 9 completo |

---

## 8. REVISIÓN OBLIGATORIA al final de cada fase

Ejecuta y corrige hasta que **todo** pase:

1. `npm run typecheck` (tsc --noEmit) → 0 errores.
2. `npm run lint` → 0 errores (incluida la regla cobros ⇏ tesis).
3. `npm run build` → compila.
4. `npm run test` (Vitest). Mínimo cubre:
   - cálculo del total del plan y edición de cuotas con historial;
   - mora: gracia, recargo único vs. mensual, nueva mora con más días, paso a cola, salida de la cola, idempotencia del job;
   - conversión BRL→BOB con la cotización del día y fallback a la última;
   - vigencia de la propuesta: el enlace se invalida y la propuesta queda `vencida`, editable y reenviable;
   - validación de archivos: tipo y tamaño (51 MB → rechazado);
   - RLS: la organización A no ve datos de la B;
   - portal: CI/PIN incorrecto bloquea tras 5 intentos.
5. `npm run e2e` (Playwright) con los flujos de la tabla de fases.
6. Revisión manual con el servidor corriendo: abre las páginas clave (si tienes navegador o Playwright, toma capturas en `/revisiones/fase-N/`) y comprueba la vista en celular (375 px).
7. Revisión de seguridad: archivos no accesibles sin autorización, tokens de enlace largos y aleatorios, el botón de WhatsApp nunca aparece sin sesión, inputs validados con Zod en el servidor, sin secretos en el repo (`.env.example` sí).
8. Actualiza `PROGRESO.md` con lo probado y el resultado. Recién entonces pasa a la siguiente fase.

---

## 9. Producción en mi VPS (Ubuntu, sin Docker)

Genera en `scripts/` y documenta en `README.md`:
- `deploy.sh`: `git pull && npm ci && npm run db:migrate && npm run build && pm2 reload ecosystem.config.js`.
- `ecosystem.config.js` (PM2).
- Ejemplo de Nginx para `julietaponz.com` y `www`, con `client_max_body_size 50M;` y proxy a Next.js. Certbot para SSL.
- `backup.sh`: `pg_dump` + tar de `UPLOAD_DIR`, rotación de 14 días y copia **fuera del VPS** con `rclone` (remoto configurable).
- Crons: job de mora y recordatorios (diario 07:00 America/La_Paz), tipo de cambio (diario 08:00), backup (diario 02:00).
- Postgres escuchando solo en localhost. `ufw` con 22/80/443.
- `.env.example` con todas las variables (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `UPLOAD_DIR`, `RESEND_API_KEY`, `APP_URL`, etc.).

---

## 10. Entregable final

Cuando termines todas las fases, dame un resumen con:
- qué se construyó por módulo;
- resultados de la última revisión (typecheck, lint, build, tests, e2e, Lighthouse);
- decisiones tomadas (`DECISIONES.md`);
- pendientes que dependen de mí: foto de la Dra., testimonios, QR real, dominio, claves de Resend, acceso al VPS.

Empieza ahora por la **Fase 0**. Primero revisa el repo.
