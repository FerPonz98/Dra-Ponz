import { GraduationCap, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TablaDatos } from "@/components/ui/tabla-datos";
import { Avatar, EncabezadoPagina, EstadoVacio } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoFecha } from "@/lib/fechas";
import { BadgeEstadoProyecto } from "@/modules/tesis/componentes/estado";
import { ETIQUETA_ESTADO } from "@/modules/tesis/dominio/estados";
import { listarPropuestas } from "@/modules/tesis/servicios/propuestas";
import { accionEliminarPropuesta } from "@/app/panel/eliminar-acciones";

export const metadata: Metadata = { title: "Propuestas y proyectos" };

export default async function PropuestasPage(props: { searchParams: Promise<{ eliminado?: string }> }) {
  const { eliminado } = await props.searchParams;
  const ctx = await requerirModulo("tesis", "tesis:ver");
  const lista = await withOrg(ctx.organizacion.id, (tx) => listarPropuestas(tx));
  const editar = ctx.puede("tesis:editar");
  const boton = editar && (
    <Button asChild>
      <Link href="/panel/tesis/propuestas/nueva">
        <Plus /> Nueva propuesta
      </Link>
    </Button>
  );
  return (
    <div>
      <EncabezadoPagina ayuda="propuestas" titulo="Propuestas y proyectos" descripcion="Desde la propuesta enviada hasta la defensa: estado, estudiante y avance de cada tesis." acciones={boton} />
      {eliminado && <Aviso tipo="exito" className="mb-4">Propuesta eliminada, con su plan de pagos y sus archivos.</Aviso>}
      <TablaDatos
        etiqueta="Propuestas y proyectos"
        buscar="Buscar por tema, estudiante o universidad"
        filtro={{ etiqueta: "Estado", opciones: Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => ({ valor, etiqueta })) }}
        columnas={[
          { id: "proyecto", titulo: "Proyecto", ordenable: true },
          { id: "estudiante", titulo: "Estudiante", ordenable: true },
          { id: "nivel", titulo: "Nivel", ocultarEnMovil: true },
          { id: "actualizado", titulo: "Actualizado", ordenable: true },
          { id: "estado", titulo: "Estado" },
        ]}
        filas={lista.map(({ propuesta: p, cliente }) => ({
          id: p.id,
          busqueda: `${p.titulo} ${cliente.nombre} ${p.universidad ?? ""}`,
          filtro: p.estado,
          orden: { proyecto: p.titulo, estudiante: cliente.nombre, actualizado: p.actualizadoEn.toISOString() },
          celdas: {
            proyecto: (
              <span className="flex flex-col">
                <Link href={`/panel/tesis/propuestas/${p.id}`} className="font-medium hover:text-primary">
                  {p.titulo}
                </Link>
                {p.universidad && <span className="truncate text-xs text-muted-foreground">{p.universidad}</span>}
              </span>
            ),
            estudiante: (
              <span className="flex items-center gap-2">
                <Avatar nombre={cliente.nombre} className="size-7 text-[10px]" />
                <span className="truncate">{cliente.nombre}</span>
              </span>
            ),
            nivel: <span className="capitalize">{p.nivel}</span>,
            actualizado: <span className="text-muted-foreground">{formatoFecha(p.actualizadoEn)}</span>,
            estado: <BadgeEstadoProyecto estado={p.estado} />,
          },
          acciones: [
            { etiqueta: "Abrir ficha", href: `/panel/tesis/propuestas/${p.id}` },
            { etiqueta: "Plan de pagos", href: `/panel/cobros/planes/${p.planId}` },
            ...(editar
              ? [
                  {
                    etiqueta: "Eliminar propuesta",
                    eliminar: {
                      titulo: "¿Eliminar esta propuesta?",
                      descripcion: `Se borra «${p.titulo}» con su cronograma, revisiones, extras, archivos, respuestas y su plan de pagos (cuotas, pagos y comprobantes). El enlace deja de funcionar. El estudiante queda en Clientes. No se puede deshacer.`,
                      accion: accionEliminarPropuesta.bind(null, p.id),
                    },
                  },
                ]
              : []),
          ],
        }))}
        vacio={
          <Card>
            <EstadoVacio icono={GraduationCap} titulo="Crea tu primera propuesta" descripcion="Arma el plan de pagos, el cronograma y las condiciones en 10 pasos. Luego la envías por WhatsApp." accion={boton} />
          </Card>
        }
      />
    </div>
  );
}
