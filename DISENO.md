# Sistema de diseño

Un solo sistema de tokens con **dos identidades**:

| | Plataforma (panel, superadmin, portal, acceso) | Landing julietaponz.com |
|---|---|---|
| Carácter | Sobria, neutra, para cualquier negocio | Académica, cálida, confiable |
| Fondo | Grises cálidos (`stone`) | Crema `#faf6ee` |
| Primario | Índigo `#4338ca` (oscuro: `#818cf8`) | Azul petróleo `#0e4a55` / `#0a3640` |
| Acento | Colores de estado | Dorado `#b8873b` (texto: `#835d1f`) |
| Tipografía | Inter (`next/font`) | Fraunces para títulos + Inter para texto (Fraunces se carga solo en la landing) |
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
| `petroleo`, `petroleo-oscuro`, `petroleo-claro`, `dorado`, `dorado-oscuro`, `crema`, `crema-2`, `tinta` | Solo landing | `bg-petroleo`, `text-dorado-oscuro`, … |

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
- **Landing:** aparición al hacer scroll (`.revelar` + `IntersectionObserver`), cifras animadas, hover en tarjetas y botones.
  Con `prefers-reduced-motion` no hay animaciones y todo se ve desde el inicio. Sin JavaScript también se ve todo.

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
