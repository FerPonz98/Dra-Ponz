import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { Card } from "@/components/ui/card";
import { TablaDatos } from "@/components/ui/tabla-datos";
import { Avatar, EncabezadoPagina, EstadoVacio } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoFecha } from "@/lib/fechas";
import { listarClientes } from "@/modules/cobros/servicios/clientes";
import { accionEliminarCliente } from "@/app/panel/eliminar-acciones";
import { NuevoCliente } from "./form-cliente";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage(props: { searchParams: Promise<{ q?: string; eliminado?: string }> }) {
  const ctx = await requerirModulo("cobros", "cobros:ver");
  const { q, eliminado } = await props.searchParams;
  const lista = await withOrg(ctx.organizacion.id, (tx) => listarClientes(tx));
  const editar = ctx.puede("cobros:editar");
  return (
    <div>
      <EncabezadoPagina ayuda="clientes" titulo="Clientes" descripcion="Las personas a quienes cobras. Desde aquí creas sus planes de pago." acciones={editar && <NuevoCliente />} />
      {eliminado && <Aviso tipo="exito" className="mb-4">Cliente eliminado, con sus planes, pagos y archivos.</Aviso>}
      <TablaDatos
        etiqueta="Clientes"
        buscar="Buscar por nombre, CI, celular o correo"
        busquedaInicial={q ?? ""}
        columnas={[
          { id: "nombre", titulo: "Cliente", ordenable: true },
          { id: "ci", titulo: "CI", ordenable: true },
          { id: "whatsapp", titulo: "WhatsApp" },
          { id: "correo", titulo: "Correo", ocultarEnMovil: true },
          { id: "alta", titulo: "Alta", ordenable: true, ocultarEnMovil: true },
        ]}
        filas={lista.map((c) => ({
          id: c.id,
          busqueda: [c.nombre, c.ci, c.whatsapp, c.correo].filter(Boolean).join(" "),
          orden: { nombre: c.nombre, ci: c.ci ?? "", alta: c.creadoEn.toISOString() },
          celdas: {
            nombre: (
              <Link href={`/panel/cobros/clientes/${c.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                <Avatar nombre={c.nombre} className="size-8" />
                <span className="truncate">{c.nombre}</span>
              </Link>
            ),
            ci: c.ci ?? <span className="text-subtle-foreground">—</span>,
            whatsapp: c.whatsapp ? `+${c.whatsapp}` : <span className="text-subtle-foreground">—</span>,
            correo: c.correo ?? <span className="text-subtle-foreground">—</span>,
            alta: <span className="text-muted-foreground">{formatoFecha(c.creadoEn).split(",")[0]}</span>,
          },
          acciones: [
            { etiqueta: "Ver ficha", href: `/panel/cobros/clientes/${c.id}` },
            ...(editar
              ? [
                  { etiqueta: "Nuevo plan de pagos", href: `/panel/cobros/planes/nuevo?cliente=${c.id}` },
                  {
                    etiqueta: "Eliminar cliente",
                    eliminar: {
                      titulo: `¿Eliminar a ${c.nombre}?`,
                      descripcion: "Se borran también sus planes de pago, sus propuestas de tesis, cuotas, pagos, comprobantes y archivos. No se puede deshacer.",
                      accion: accionEliminarCliente.bind(null, c.id),
                    },
                  },
                ]
              : []),
          ],
        }))}
        vacio={
          <Card>
            <EstadoVacio icono={Users} titulo="Aún no tienes clientes" descripcion="Agrega a tu primer cliente para crearle un plan de pagos y enviarle su enlace." accion={editar && <NuevoCliente />} />
          </Card>
        }
      />
    </div>
  );
}
