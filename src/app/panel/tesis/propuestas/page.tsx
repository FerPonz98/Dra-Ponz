import { GraduationCap, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TablaDatos } from "@/components/ui/tabla-datos";
import { Avatar, EncabezadoPagina, EstadoVacio } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoFecha } from "@/lib/fechas";
import { BadgeEstadoProyecto } from "@/modules/tesis/componentes/estado";
import { ETIQUETA_ESTADO } from "@/modules/tesis/dominio/estados";
import { listarPropuestas } from "@/modules/tesis/servicios/propuestas";

export const metadata: Metadata = { title: "Propuestas y proyectos" };

export default async function PropuestasPage() {
  const ctx = await requerirModulo("tesis", "tesis:ver");
  const lista = await withOrg(ctx.organizacion.id, (tx) => listarPropuestas(tx));
  const boton = ctx.puede("tesis:editar") && (
    <Button asChild>
      <Link href="/panel/tesis/propuestas/nueva">
        <Plus /> Nueva propuesta
      </Link>
    </Button>
  );
  return (
    <div>
      <EncabezadoPagina titulo="Propuestas y proyectos" descripcion="Desde la propuesta enviada hasta la defensa: estado, estudiante y avance de cada tesis." acciones={boton} />
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
          acciones: [{ etiqueta: "Abrir ficha", href: `/panel/tesis/propuestas/${p.id}` }, { etiqueta: "Plan de pagos", href: `/panel/cobros/planes/${p.planId}` }],
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
