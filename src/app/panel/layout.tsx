import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requerirOrganizacion } from "@/core/contexto";
import type { CodigoModulo } from "@/core/db/schema";
import type { Permiso } from "@/core/permisos";
import { MarcaOrganizacion } from "@/components/marca/marca";
import { EstiloTema } from "@/components/tema/estilo-tema";
import { temaDeOrganizacion } from "@/core/tema/cache";
import { ShellPanel, type GrupoNav, type ItemNav } from "@/components/panel/shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Item = ItemNav & { modulo?: CodigoModulo; permiso?: Permiso };
const GRUPOS: { titulo: string; items: Item[] }[] = [
  { titulo: "Inicio", items: [{ href: "/panel", etiqueta: "Resumen", icono: "inicio", exacto: true }] },
  {
    titulo: "Cobros",
    items: [
      { href: "/panel/cobros/clientes", etiqueta: "Clientes", icono: "clientes", modulo: "cobros", permiso: "cobros:ver" },
      { href: "/panel/cobros/planes", etiqueta: "Planes de pago", icono: "planes", modulo: "cobros", permiso: "cobros:ver" },
      { href: "/panel/cobros/pagos", etiqueta: "Comprobantes", icono: "comprobantes", modulo: "cobros", permiso: "cobros:aprobar" },
      { href: "/panel/cobros/recordatorios", etiqueta: "Para recordar hoy", icono: "recordar", modulo: "cobros", permiso: "cobros:ver" },
      { href: "/panel/cobros/plantillas", etiqueta: "Plantillas de mensaje", icono: "plantillas", modulo: "cobros", permiso: "cobros:editar" },
    ],
  },
  {
    titulo: "Tesis",
    items: [
      { href: "/panel/tesis/propuestas", etiqueta: "Propuestas y proyectos", icono: "propuestas", modulo: "tesis", permiso: "tesis:ver" },
      { href: "/panel/tesis/calendario", etiqueta: "Calendario", icono: "calendario", modulo: "tesis", permiso: "tesis:ver" },
      { href: "/panel/tesis/formularios", etiqueta: "Formularios", icono: "formularios", modulo: "tesis", permiso: "tesis:editar" },
      { href: "/panel/tesis/landing", etiqueta: "Landing pública", icono: "landing", modulo: "tesis", permiso: "tesis:editar" },
    ],
  },
  {
    titulo: "Configuración",
    items: [
      { href: "/panel/configuracion", etiqueta: "Organización", icono: "organizacion", permiso: "organizacion:configurar", exacto: true },
      { href: "/panel/configuracion/apariencia", etiqueta: "Apariencia", icono: "apariencia", permiso: "organizacion:configurar" },
      { href: "/panel/usuarios", etiqueta: "Usuarios y roles", icono: "usuarios", permiso: "usuarios:gestionar" },
    ],
  },
  { titulo: "Ayuda", items: [{ href: "/panel/ayuda", etiqueta: "Ayuda", icono: "ayuda" }] },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requerirOrganizacion();
  const c = await cookies();
  const permitido = (i: Item) => (!i.modulo || ctx.modulos.includes(i.modulo)) && (!i.permiso || ctx.puede(i.permiso));
  const grupos: GrupoNav[] = GRUPOS.map((g) => ({ titulo: g.titulo, items: g.items.filter(permitido).map(({ href, etiqueta, icono, exacto }) => ({ href, etiqueta, icono, exacto })) })).filter((g) => g.items.length > 0);
  const todos = grupos.flatMap((g) => g.items);
  const preferidos = ["/panel", "/panel/cobros/clientes", "/panel/cobros/recordatorios", "/panel/tesis/propuestas", "/panel/cobros/planes"];
  const inferior = preferidos.map((h) => todos.find((i) => i.href === h)).filter((x): x is ItemNav => !!x).slice(0, 4).map((i) => ({ ...i, etiqueta: CORTO[i.href] ?? i.etiqueta }));

  // El panel mantiene el diseño de la plataforma; del tema solo toma el color primario para acentos.
  const tema = await temaDeOrganizacion(ctx.organizacion.id);
  return (
    <>
    {tema && <EstiloTema tema={tema} alcance="panel" id={ctx.organizacion.id} />}
    <ShellPanel
      organizacion={{
        nombre: ctx.organizacion.nombre,
        zona: ctx.organizacion.zonaHoraria,
        simbolo: <MarcaOrganizacion org={ctx.organizacion} cual="isotipo" className="size-8" claseInicial="size-8 text-sm shadow-sm" />,
      }}
      usuario={{ nombre: ctx.usuario.nombre, correo: ctx.usuario.correo }}
      grupos={grupos}
      inferior={inferior}
      colapsadoInicial={c.get("panel_colapsado")?.value === "1"}
      oscuroInicial={c.get("tema")?.value === "oscuro"}
    >
      {children}
    </ShellPanel>
    </>
  );
}

const CORTO: Record<string, string> = {
  "/panel": "Inicio",
  "/panel/cobros/clientes": "Clientes",
  "/panel/cobros/recordatorios": "Recordar",
  "/panel/tesis/propuestas": "Tesis",
  "/panel/cobros/planes": "Planes",
};
