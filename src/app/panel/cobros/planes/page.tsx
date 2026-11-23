import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { BadgeMora } from "@/modules/cobros/componentes/estado";
import { listarPlanes } from "@/modules/cobros/servicios/planes";

export const metadata: Metadata = { title: "Planes de pago" };

export default async function PlanesPage() {
  const ctx = await requerirModulo("cobros", "cobros:ver");
  const planes = await withOrg(ctx.organizacion.id, (tx) => listarPlanes(tx));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planes de pago</h1>
        {ctx.puede("cobros:editar") && (
          <Button asChild>
            <Link href="/panel/cobros/planes/nuevo">Nuevo plan</Link>
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="pt-4 md:pt-6">
          {planes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay planes.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Concepto</TH>
                  <TH>Cliente</TH>
                  <TH className="hidden sm:table-cell">Pagado / total</TH>
                  <TH>Estado</TH>
                </TR>
              </THead>
              <TBody>
                {planes.map((p) => (
                  <TR key={p.plan.id}>
                    <TD>
                      <Link href={`/panel/cobros/planes/${p.plan.id}`} className="font-medium text-primary hover:underline">
                        {p.plan.titulo}
                      </Link>
                      {p.plan.estado !== "activo" && <span className="ml-2 text-xs text-muted-foreground">({p.plan.estado})</span>}
                    </TD>
                    <TD>{p.cliente.nombre}</TD>
                    <TD className="hidden sm:table-cell">
                      {formatoMoneda(p.pagado, p.plan.moneda)} / {formatoMoneda(p.total, p.plan.moneda)}
                    </TD>
                    <TD>
                      <BadgeMora estado={p.plan.estadoMora} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
