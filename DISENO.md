# Sistema de diseño

Un solo sistema de tokens con **dos identidades**:

| | Plataforma (panel, superadmin, portal, acceso) | Landing julietaponz.com |
|---|---|---|
| Carácter | Sobria, neutra, para cualquier negocio | Académica, cálida, confiable |
| Fondo | Grises cálidos (`stone`) | **Tema de la organización** (por defecto crema `#faf6ee`) |
| Primario | Índigo `#4338ca` (oscuro: `#818cf8`); si la organización eligió tema, su primario en modo claro | Tema (por defecto azul petróleo `#0e4a55` / `#0a3640`) |
| Acento | Colores de estado | Tema (por defecto dorado `#b4843a`; para texto `#795927`, calculado) |
| Tipografía | Inter (`next/font`) | Tema: 4 serif para títulos + 4 sans para texto (por defecto Fraunces + Inter) |
| Modo oscuro | Sí (botón en la barra superior, cookie `tema`) | No (siempre claro) |

## Tokens

Definidos como variables CSS en `src/app/globals.css` (`:root` y `.dark`) y expuestos a Tailwind 4 con `@theme inline`.

| Token | Uso | Clase |
|---|---|---|
| `--background` | Fondo de la app | `bg-background` |
| `--surface`, `--surface-2` | Tarjetas, menús / zonas secundarias, encabezados de tabla | `bg-surface`, `bg-surface-2` |
| `--foreground`, `--muted-foreground`, `--subtle-foreground` | Texto principal / secundario / terciario | `text-foreground`, … |
| `--border`, `--border-strong` | Bordes finos / bordes de inputs | `border-border`, `border-border-strong` |
| `--primary`, `--primary-hover`, `--primary-soft` | Acciones, selección, fondos suaves | `bg-primary`, `bg-primary-soft`, `text-primary` |
| `--exito` / `--exito-soft` | **Al día**, pagado, aprobado | `text-exito`, `bg-exito-soft` |
| `--aviso` / `--aviso-soft` | **Por vencer**, en gracia | `text-aviso`, `bg-aviso-soft` |
| `--peligro` / `--peligro-soft` | **Vencida / en cola**, rechazos, acciones peligrosas | `text-peligro`, `bg-peligro-soft` |
| `--info` / `--info-soft` | Informativo, en revisión | `text-info`, `bg-info-soft` |
| `--whatsapp` | Botones de WhatsApp (≥ 4.5:1 con blanco en claro y oscuro) | `bg-whatsapp` |
| `tema-*` (`tema-primario`, `tema-titulo`, `tema-fondo`, `tema-texto-suave`, …) | Landing y vista previa (ver **Temas por organización**) | `bg-tema-primario`, `text-tema-titulo`, `rounded-boton`, `font-titulos` |

**Estados (siempre texto + color, nunca solo color):** al día = verde, por vencer / en gracia = ámbar, vencida / en cola = rojo,
informativo / en revisión = azul. Los `Badge` llevan un punto de color y el texto del estado.

## Escala

- **Tipografía:** 12 · 13 · 14 · 15 (inputs en escritorio) · 16 · 18 · 20 · 24 (títulos de página, `text-2xl font-semibold tracking-tight`) · 30+ (cifras y landing).
  Números con `tabular-nums`.
- **Espaciado:** múltiplos de 4/8 (`gap-2/3/4/6`, `p-4/5/6`). Páginas: `space-y-6`; tarjetas: `px-5 pb-5`.
- **Radios:** 6 px (`sm`), 8 px (`md`, botones/inputs), 12 px (`xl`, tarjetas), 16–24 px en el portal (táctil) y la landing.
- **Sombras:** `shadow-xs` en tarjetas, `shadow-md` en elementos flotantes, `shadow-lg` en diálogos y menús. Bordes de 1 px.
- **Íconos:** `lucide-react`, 16 px en botones y listas, 18 px en el menú, 20–24 px en estados vacíos; grosor por defecto (2).

## Componentes (`src/components/ui`)

| Componente | Archivo | Notas |
|---|---|---|
| `Button` | `button.tsx` | Variantes `default`, `outline`, `secondary`, `ghost`, `destructive`, `exito`, `whatsapp`, `link`; tamaños `sm`, `default`, `lg`, `icon`, `icon-sm` |
| `Input`, `Textarea`, `Select`, `Label`, `Campo`, `Interruptor` | `input.tsx` | `Campo` = etiqueta + control + ayuda + error en línea (`role="alert"`) |
| `Card` (+ `Header` con `acciones`, `Title`, `Description`, `Content`, `Footer`) | `card.tsx` | |
| `Badge` | `badge.tsx` | Variantes de estado con punto |
| `Aviso` | `aviso.tsx` | Info / éxito / aviso / error con ícono |
| `Table`, `THead`, `TR`, `TH`, `TD` | `table.tsx` | Encabezado fijo |
| `TablaDatos` | `tabla-datos.tsx` | Búsqueda, filtro, orden, paginación, menú "⋯"; en el celular las filas se apilan como tarjetas |
| `Confirmar`, `PanelLateral` | `dialogo.tsx` | Diálogo de confirmación (Radix AlertDialog) y panel lateral (Radix Dialog) |
| `Menu*`, `MenuAcciones` | `menu.tsx` | Radix DropdownMenu |
| `Pestanas`, `ListaPestanas`, `Pestana`, `PanelPestana` | `tabs.tsx` | Radix Tabs |
| `EstadoVacio`, `Esqueleto`, `Avatar`, `BarraProgreso`, `AnilloProgreso`, `MiniGrafico`, `TarjetaKpi`, `EncabezadoPagina`, `Migas`, `Dato` | `varios.tsx` | |
| `LineaTiempo` | `linea-tiempo.tsx` | Historial |
| `ZonaArchivos` | `zona-archivos.tsx` | Arrastrar y soltar, barra de progreso por archivo (XHR), límite de 50 MB indicado y validado antes de subir |
| `Toaster`, `notificar` | `toaster.tsx` | Toasts (sonner) de éxito y error para las acciones |

Shell del panel: `src/components/panel/shell.tsx` (barra lateral colapsable con íconos y grupos Inicio / Cobros / Tesis /
Configuración, barra superior con buscador, organización, tema y menú de usuario; en el celular, menú inferior + drawer).

## Patrones

- **Encabezado de página:** `EncabezadoPagina` con migas, título, descripción y acciones a la derecha.
- **Listas:** `TablaDatos` en escritorio; tarjetas apiladas en el celular. Estado vacío con una acción ("Crea tu primer…").
- **Formularios:** validación en línea (Zod en el servidor siempre; en el cliente se marcan los campos con `aria-invalid`).
  Resultados con toasts; errores que bloquean, con `Aviso`.
- **Acciones peligrosas:** siempre con `Confirmar` (anular enlace, rechazar pago, finalizar proyecto, aceptar propuesta en el portal).
- **Carga:** `src/app/panel/loading.tsx` muestra skeletons.
- **Portal:** una columna, botones de 48–56 px, tarjetas de 24 px de radio, textos cálidos y sin jerga ("Ya pagué, subir comprobante").
- **Landing:** colores, fuentes y bordes del tema de la organización; movimiento según la **Guía de animaciones**. Sin JavaScript se ve todo.

## Accesibilidad (AA)

- Contraste ≥ 4.5:1 en texto (verificado con axe en claro y oscuro: `npm run accesibilidad`) y Lighthouse 100 en la landing.
- Foco visible (`outline` 2 px con `--ring`) en todos los controles, incluidas las tarjetas-radio.
- Enlace "Saltar al contenido" en el panel y la landing.
- Etiquetas en todos los campos; los íconos decorativos llevan `aria-hidden`; regiones con scroll accesibles por teclado.
- Navegación con teclado en menús, diálogos y pestañas (Radix).

## Herramientas

- `npm run capturas:diseno -- <carpeta> [1440|375] [filtro]` — capturas de todas las pantallas (`TEMA=oscuro` para modo oscuro).
- `npm run accesibilidad` — axe WCAG 2.1 AA sobre el panel (claro/oscuro), la landing y el portal.
- `npm run lighthouse` — Lighthouse móvil de la landing.

Capturas: `revisiones/diseno-antes/` y `revisiones/diseno-despues/` (+ `oscuro/`).

## Temas por organización

La Dra. (permiso `organizacion:configurar`) elige la apariencia en **Configuración → Apariencia** (`/panel/configuracion/apariencia`).
Se aplica a su **landing** y al **portal** de sus clientes; el **panel** conserva el diseño de la plataforma y solo toma
el color primario para los acentos (en modo claro). Las organizaciones sin tema guardado ven el diseño de la plataforma
en panel y portal, y el tema por defecto en la landing.

| Pieza | Dónde |
|---|---|
| Tabla `organizacion_tema` (una fila por organización, RLS, CHECK de HEX y de radio) | `src/core/db/schema.ts`, `drizzle/0008_tema.sql`, `drizzle/0009_rls_tema.sql` |
| Presets, fuentes, variantes, contraste y CSS (puro; también corre en el navegador para la vista previa) | `src/core/tema/tema.ts`, `src/core/tema/colores.ts` |
| Leer / guardar (Zod + contraste) | `src/core/tema/servicio.ts` (siempre dentro de `withOrg`) |
| Cache por organización (`unstable_cache`, etiqueta `tema-org-<id>`; se invalida con `updateTag` al guardar) | `src/core/tema/cache.ts`, `src/app/panel/configuracion/apariencia/acciones.ts` |
| Inyección en el `<head>` (`<style precedence>` de React: llega con el HTML, sin parpadeo) | `src/components/tema/estilo-tema.tsx` |
| Fuentes elegibles (`next/font`; solo Fraunces se precarga) | `src/components/tema/fuentes.ts` |

**Colores base:** primario (botones, enlaces), secundario (títulos y franjas oscuras), acento (íconos, detalles, cifras), fondo y texto.
**Fuentes:** títulos Fraunces / Lora / Playfair Display / Source Serif; texto Inter / Source Sans / Nunito Sans / DM Sans.
**Bordes:** recto / suave / redondeado → `--radio-boton`, `--radio-tarjeta`, `--radio-bloque`.

**Presets** (todos pasan AA, probado en `tests/unit/tema.test.ts`): Académico azul petróleo (por defecto: los colores
actuales de la Dra.), Terracota cálido, Verde bosque, Vino elegante, Azul institucional, Grafito moderno, Lavanda serena.

**Variables generadas** (en `:root`; las de fuente en `.tema-fuentes`, donde están las clases de `next/font`):
`--color-primario`, `-hover`, `-suave` (10 % sobre el fondo), `-borde`, `-texto` (primario corregido para texto),
`--color-sobre-primario`, `--color-secundario`, `-suave`, `--color-sobre-secundario` (`-suave`), `--color-titulo`,
`--color-acento`, `-suave`, `-fuerte`, `-texto`, `-sobre-secundario`, `--color-fondo`, `--color-fondo-2`, `--color-superficie`,
`--color-texto`, `--color-texto-suave`, `--color-borde`, `--color-borde-fuerte`, `--fuente-titulos`, `--fuente-texto`, `--radio-*`.
Tailwind 4 las lee en `@theme inline` (`globals.css`): `bg-tema-primario`, `text-tema-titulo`, `rounded-tarjeta`, `font-titulos`…
En el portal además se reasignan los tokens de la plataforma (`--primary`, `--background`, `--surface`, `--foreground`,
`--radius-3xl`, …) solo en modo claro, así sus componentes toman la marca sin cambiar su código.

**Contraste (WCAG AA):** se revisa en vivo y en el servidor. **Bloquean el guardado:** texto/fondo < 4.5, texto del botón/primario
< 4.5, botón/fondo < 3, títulos (secundario)/fondo < 4.5, texto/secundario < 4.5. Acento/fondo < 3 solo avisa (para textos se
usa una versión corregida). Cada fallo trae una sugerencia aplicable con un clic. Las variantes de texto se corrigen solas para
llegar a 4.5:1 sobre todas las superficies donde se usan.

**Regla:** en la landing y el portal no se usan colores fijos: solo `tema-*` o los tokens de la plataforma.

## Guía de animaciones (landing)

Estilo sobrio (Stripe/Linear/Vercel). Motion (`motion/react` con `LazyMotion`: las funciones de animación se cargan
de forma diferida) + CSS. Componentes en `src/modules/tesis/componentes/landing-movimiento.tsx`; clases en `globals.css`.

| Dónde | Qué | Cómo |
|---|---|---|
| Portada | Título palabra por palabra (fundido + subida), subtítulo y credenciales en secuencia, foto con fundido + escala, marco que flota, manchas de color que se mueven despacio, brillo en el botón de WhatsApp cada 5 s | CSS (`.entrar`, `.entrar-palabra`, `.entrar-foto`, `.flotar`, `.mancha`, `.brillo`): funciona sin JS y no espera la hidratación |
| Cifras | Contador de 0 al número al entrar en pantalla | `Contador` (rAF) |
| ¿Te pasa esto? / Servicios | Aparición escalonada; elevación con sombra; inclinación 3D leve e ícono que se balancea | `.revelar` + `--retraso`, `.elevable`, `Inclinable`, `.icono-vivo` |
| Cómo trabajamos | La línea se dibuja con el scroll y cada paso se ilumina | `LineaProceso` (`useScroll`) |
| Trayectoria | Hitos alternando izquierda/derecha | `.revelar-izq` / `.revelar-der` |
| Testimonios | Carrusel automático (6,5 s), pausa con mouse o foco, deslizable con el dedo, botones y puntos | `CarruselTestimonios` |
| Preguntas | Acordeón `<details>` con animación de altura (`::details-content`) e ícono que rota | CSS |
| Cierre | Degradado vivo y micro-rebote del botón | `.mancha`, `.rebote` |
| General | Aparición al hacer scroll (una vez), barra de progreso de lectura, encabezado sólido con blur que se esconde al bajar y vuelve al subir, scroll suave desde el menú, botón flotante de WhatsApp tras la portada, micro-interacciones (`.boton-vivo`, `.enlace-vivo`), transición ES ↔ PT (View Transitions) | `Revelador`, `BarraLectura`, `EncabezadoDinamico`, `BotonFlotante` |

**Reglas**
- Solo `transform` y `opacity` (sombras: un `::after` cuya opacidad cambia; fondo del encabezado: una capa cuya opacidad cambia).
  Única excepción, pedida: la altura del acordeón.
- Duraciones 200–700 ms, easing `cubic-bezier(0.22, 1, 0.36, 1)` (`--facil`). Lo continuo (manchas, marco, brillo, pulso) es lento.
- `prefers-reduced-motion`: `--desplazar: 0` → solo fundidos; sin deriva de manchas, brillo, pulso, inclinación,
  carrusel automático ni dibujado de la línea.
- Celular: sin inclinación 3D ni deriva de manchas.
- Manchas con `radial-gradient` (no `filter: blur`, que costaba ~0,5 s de render en el celular).
- Las palabras del título parten de opacidad 0.01 (a la vista, un fundido completo) para que el título cuente como pintado
  desde el primer cuadro y la animación no retrase el LCP.
- Nada tapa texto ni retrasa el botón de WhatsApp: el botón de la portada no tiene animación de entrada.
- Lighthouse móvil: rendimiento ≥ 90 y accesibilidad 100 (`npm run lighthouse`).

Grabaciones y capturas: `npm run capturas:animaciones` → `revisiones/animaciones/` (videos de scroll en escritorio y celular;
Apariencia con 3 presets y con una combinación ilegible).

## Marca (logo e isotipo)

Archivos originales en `public/brand/0*_*.svg`. `node scripts/marca/preparar.mjs` genera todo lo demás (reproducible):

| Archivo | Qué es |
|---|---|
| `public/brand/isotipo.svg`, `isotipo-geometrico.svg`, `logo.svg` | Versiones limpias (SVGO), con los colores de marca (#1E4D5C, #C59A4A) |
| `*-blanco.svg`, `*-negro.svg` | Un solo color, para fondos oscuros e impresión (el rasgo recorta un filo en la J y la P para que se lea) |
| `isotipo-contorno.svg` | Contorno (base del dibujo de la intro) |
| `logo-correo.png` (480 px), `isotipo-512.png`, `android-192/512.png` | PNG para correos e íconos de apps |
| `src/app/favicon.ico` (16/32/48), `icon.svg`, `apple-icon.png` (180) | Íconos del sitio |
| `src/components/marca/trazos.ts` | Trazos para los componentes (generado, no editar) |

- **Avisos sobre los originales:** el logo completo tenía el nombre y el lema como `<text>` (se veían distintos según la
  computadora) y ahora son trazos (Libre Baskerville y Arimo, equivalente libre de Arial, a peso 400; el original pedía 500).
  En el geométrico, la banda curva era una figura **color crema** pintada encima, no un hueco: ahora es un recorte real
  (máscara) y funciona sobre cualquier fondo. No había rasters, scripts ni ids repetidos; solo comentarios.
- **Componentes** (`src/components/marca/marca.tsx`): `<Isotipo/>`, `<IsotipoGeometrico/>`, `<Logo conLema/>`, con las
  variantes `tema` (var(--color-primario) / var(--color-acento), en el panel cae a --primary), `actual` (currentColor),
  `blanco` y `negro`. `<MarcaOrganizacion org cual="logo|isotipo">` elige entre el logo subido, el incorporado o la inicial.
- **Por organización** (`src/core/marca`): Configuración → Apariencia → "Logo e isotipo" (SVG o PNG/JPG/WEBP, ≤ 2 MB).
  Los SVG se **sanitizan** con lista blanca sobre el parser de SVGO: se rechazan scripts, eventos `on*`, `javascript:`,
  `<foreignObject>` y entidades, y se quitan `<style>`, `<image>`, `<a>`, animaciones y enlaces o `url()` externos.
  Se sirven en `/marca/{org}/{logo|isotipo}` con `CSP: sandbox` y `nosniff`. Por defecto: el monograma JP de la Dra.
  (`MARCAS_INCORPORADAS`); otras organizaciones, su inicial.
- **Dónde está:** landing (header, logo sin lema en escritorio e isotipo en el celular; footer, logo completo), login
  (logo blanco con los colores del tema; isotipo en el celular), panel (isotipo en la barra lateral y el drawer), portal
  (isotipo en el encabezado), PDF de la propuesta (logo vectorial + colores del tema), correos (PNG), imagen OG dinámica
  (`src/app/[locale]/opengraph-image.tsx`), `manifest.webmanifest` (theme_color del tema) y favicon/íconos.

## Intro de la landing

`src/modules/tesis/componentes/intro-marca.tsx` + estilos `.intro-*` en `globals.css`.

1. Fondo del tema a pantalla completa. El monograma se **dibuja** trazo a trazo (`stroke-dashoffset` con `pathLength=1`) y
   se funde al relleno.
2. "Dra. Julieta Ponz" sube con fundido y se extiende una línea dorada.
3. El telón sube y el monograma **vuela** a su lugar en el header (FLIP con WAAPI: la misma técnica que `layoutId` de
   Motion, sin cargar las funciones de layout de Motion en la landing).

- Duración: ~2,1 s en escritorio, ~1,5 s en el celular (`--t: 0.72`), contada desde que aparece.
- Se salta con el botón "Saltar"/"Pular", Esc, Enter, un clic, un toque, la rueda o el dedo.
- **Primera visita de la sesión** (`sessionStorage`, dentro de try/catch); al recargar o navegar no se repite.
  Se activa o desactiva en Apariencia (`organizacion_tema.intro_activa`).
- **No toca el SEO ni el LCP:** la portada se renderiza en el servidor por debajo. La capa está **oculta por defecto** y un
  script en línea con nonce, justo antes de ella, agrega `.con-intro` antes del primer pintado. Sin JS, con
  `prefers-reduced-motion` o para bots (Google, WhatsApp, Facebook…), nunca aparece.
- Solo transform y opacity (salvo `stroke-dashoffset` del dibujo). CLS = 0: el logo del header espera con `opacity: 0`.
- Lighthouse móvil con la intro activa: 99/100/100/100, LCP 1,1 s, CLS 0.

Grabaciones: `npm run capturas:marca` → `revisiones/intro/` (videos) y `revisiones/marca/` (landing, login, panel, portal,
PDF, imagen OG). Comparación de logos: `revisiones/logo/`.
