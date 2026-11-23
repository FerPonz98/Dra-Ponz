import { Plus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TablaDatos } from "@/components/ui/tabla-datos";
import { BarraProgreso, EncabezadoPagina, EstadoVacio } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { BadgeMora, ETIQUETA_MORA } from "@/modules/cobros/componentes/estado";
import { listarPlanes } from "@/modules/cobros/servicios/planes";

export const metadata: Metadata = { title: "Planes de pago" };

export default async function PlanesPage() {
  const ctx = await requerirModulo("cobros", "cobros:ver");
  const planes = await withOrg(ctx.organizacion.id, (tx) => listarPlanes(tx));
  const editar = ctx.puede("cobros:editar");
  const boton = editar && (
    <Button asChild>
      <Link href="/panel/cobros/planes/nuevo">
        <Plus /> Nuevo plan
      </Link>
    </Button>
  );
  return (
    <div>
      <EncabezadoPagina titulo="Planes de pago" descripcion="Cuotas, avance de pago y estado de mora de cada plan." acciones={boton} />
      <TablaDatos
        etiqueta="Planes de pago"
        buscar="Buscar por concepto o cliente"
        filtro={{ etiqueta: "Estado", opciones: Object.entries(ETIQUETA_MORA).map(([valor, e]) => ({ valor, etiqueta: e.texto })) }}
        columnas={[
          { id: "concepto", titulo: "Concepto", ordenable: true },
          { id: "cliente", titulo: "Cliente", ordenable: true },
          { id: "avance", titulo: "Pagado", ordenable: true },
          { id: "total", titulo: "Total", ordenable: true, alinear: "derecha" },
          { id: "estado", titulo: "Estado" },
        ]}
        filas={planes.map((p) => {
          const pct = p.total ? Math.round((p.pagado / p.total) * 100) : 0;
          return {
            id: p.plan.id,
            busqueda: `${p.plan.titulo} ${p.cliente.nombre}`,
            filtro: p.plan.estadoMora,
            orden: { concepto: p.plan.titulo, cliente: p.cliente.nombre, avance: pct, total: p.total },
            celdas: {
              concepto: (
                <span className="flex flex-col">
                  <Link href={`/panel/cobros/planes/${p.plan.id}`} className="font-medium hover:text-primary">
                    {p.plan.titulo}
                  </Link>
                  <span className="flex gap-1.5 text-xs text-muted-foreground">
                    {p.plan.moneda}
                    {p.plan.origen === "tesis" && <span>· Tesis</span>}
                    {p.plan.estado !== "activo" && <span>· {p.plan.estado}</span>}
                  </span>
                </span>
              ),
              cliente: p.cliente.nombre,
              avance: (
                <span className="flex min-w-32 items-center gap-2">
                  <BarraProgreso valor={pct} etiqueta={`Pagado ${pct}%`} className="w-20" />
                  <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
                </span>
              ),
              total: <span className="font-medium">{formatoMoneda(p.total, p.plan.moneda)}</span>,
              estado: p.plan.estado === "finalizado" ? <Badge variant="secondary">Finalizado</Badge> : <BadgeMora estado={p.plan.estadoMora} />,
            },
            acciones: [
              { etiqueta: "Ver plan", href: `/panel/cobros/planes/${p.plan.id}` },
              { etiqueta: "Ver cliente", href: `/panel/cobros/clientes/${p.cliente.id}` },
            ],
          };
        })}
        vacio={
          <Card>
            <EstadoVacio icono={Wallet} titulo="Crea tu primer plan de pagos" descripcion="Define las cuotas, las fechas y las reglas de mora. Luego envía el enlace para pagar con QR." accion={boton} />
          </Card>
        }
      />
    </div>
  );
}
