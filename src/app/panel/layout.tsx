import type { Metadata } from "next";
import Link from "next/link";
import { requerirOrganizacion } from "@/core/contexto";
import type { Permiso } from "@/core/permisos";
import type { CodigoModulo } from "@/core/db/schema";
import { BotonSalir } from "@/components/boton-salir";
import { MenuMovil } from "@/components/menu-movil";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Item = { href: string; etiqueta: string; modulo?: CodigoModulo; permiso?: Permiso };
const GRUPOS: { titulo: string; items: Item[] }[] = [
  { titulo: "General", items: [{ href: "/panel", etiqueta: "Resumen" }] },
  {
    titulo: "Cobros",
    items: [
      { href: "/panel/cobros/clientes", etiqueta: "Clientes", modulo: "cobros", permiso: "cobros:ver" },
      { href: "/panel/cobros/planes", etiqueta: "Planes de pago", modulo: "cobros", permiso: "cobros:ver" },
      { href: "/panel/cobros/pagos", etiqueta: "Comprobantes", modulo: "cobros", permiso: "cobros:aprobar" },
      { href: "/panel/cobros/recordatorios", etiqueta: "Para recordar hoy", modulo: "cobros", permiso: "cobros:ver" },
      { href: "/panel/cobros/plantillas", etiqueta: "Plantillas de mensaje", modulo: "cobros", permiso: "cobros:editar" },
    ],
  },
  {
    titulo: "Tesis",
    items: [
      { href: "/panel/tesis/propuestas", etiqueta: "Propuestas y proyectos", modulo: "tesis", permiso: "tesis:ver" },
      { href: "/panel/tesis/calendario", etiqueta: "Calendario", modulo: "tesis", permiso: "tesis:ver" },
      { href: "/panel/tesis/formularios", etiqueta: "Formularios", modulo: "tesis", permiso: "tesis:editar" },
      { href: "/panel/tesis/landing", etiqueta: "Landing pública", modulo: "tesis", permiso: "tesis:editar" },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/panel/configuracion", etiqueta: "Organización", permiso: "organizacion:configurar" },
      { href: "/panel/usuarios", etiqueta: "Usuarios y roles", permiso: "usuarios:gestionar" },
    ],
  },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requerirOrganizacion();
  const grupos = GRUPOS.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.modulo || ctx.modulos.includes(i.modulo)) && (!i.permiso || ctx.puede(i.permiso))),
  })).filter((g) => g.items.length > 0);

  const nav = (
    <nav aria-label="Menú principal" className="space-y-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</p>
          <ul className="mt-1 space-y-0.5">
            {g.items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  {i.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ ["--primary" as string]: ctx.organizacion.colorPrimario }}>
      <aside className="hidden w-60 shrink-0 border-r bg-background p-4 md:block">
        <p className="mb-6 truncate px-2 font-semibold" title={ctx.organizacion.nombre}>
          {ctx.organizacion.nombre}
        </p>
        {nav}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <MenuMovil titulo={ctx.organizacion.nombre}>{nav}</MenuMovil>
          <p className="hidden text-sm text-muted-foreground md:block">Zona horaria: {ctx.organizacion.zonaHoraria}</p>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm sm:inline" data-testid="usuario-actual">
              {ctx.usuario.nombre}
            </span>
            <BotonSalir />
          </div>
        </header>
        <main className="flex-1 bg-muted/40 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
