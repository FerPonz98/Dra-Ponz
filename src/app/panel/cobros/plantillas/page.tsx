import type { Metadata } from "next";
import { requerirModulo } from "@/core/contexto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { VARIABLES } from "@/modules/cobros/dominio/mensajes";
import { plantillasDeOrganizacion } from "@/modules/cobros/servicios/mensajes";
import { FormPlantilla } from "./form-plantilla";

export const metadata: Metadata = { title: "Plantillas de mensaje" };

export default async function PlantillasPage() {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const lista = await withOrg(ctx.organizacion.id, (tx) => plantillasDeOrganizacion(tx));
  return (
    <div className="mx-auto max-w-4xl">
      <EncabezadoPagina ayuda="plantillas"
        titulo="Plantillas de mensaje"
        descripcion={
          <span className="flex flex-wrap items-center gap-1.5">
            Se usan en los botones de WhatsApp. Variables disponibles:
            {VARIABLES.map((v) => (
              <code key={v} className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-foreground">{`{${v}}`}</code>
            ))}
          </span>
        }
      />
      <div className="space-y-4">
        {lista.map((p) => (
          <Card key={p.clave}>
            <CardHeader>
              <CardTitle>{p.titulo}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormPlantilla clave={p.clave} cuerpo={p.cuerpo} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
