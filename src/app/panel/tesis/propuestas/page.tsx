import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { withOrg } from "@/lib/db";
import { formatoFecha } from "@/lib/fechas";
import { BadgeEstadoProyecto } from "@/modules/tesis/componentes/estado";
import { listarPropuestas } from "@/modules/tesis/servicios/propuestas";

export const metadata: Metadata = { title: "Propuestas y proyectos" };

export default async function PropuestasPage() {
  const ctx = await requerirModulo("tesis", "tesis:ver");
  const lista = await withOrg(ctx.organizacion.id, (tx) => listarPropuestas(tx));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Propuestas y proyectos</h1>
        {ctx.puede("tesis:editar") && (
          <Button asChild>
            <Link href="/panel/tesis/propuestas/nueva">Nueva propuesta</Link>
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="pt-4 md:pt-6">
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay propuestas.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Proyecto</TH>
                  <TH>Estudiante</TH>
                  <TH className="hidden md:table-cell">Actualizado</TH>
                  <TH>Estado</TH>
                </TR>
              </THead>
              <TBody>
                {lista.map(({ propuesta: p, cliente }) => (
                  <TR key={p.id}>
                    <TD>
                      <Link href={`/panel/tesis/propuestas/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.titulo}
                      </Link>
                    </TD>
                    <TD>{cliente.nombre}</TD>
                    <TD className="hidden md:table-cell">{formatoFecha(p.actualizadoEn)}</TD>
                    <TD>
                      <BadgeEstadoProyecto estado={p.estado} />
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
