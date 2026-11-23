import type { Metadata } from "next";
import { requerirModulo } from "@/core/contexto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withOrg } from "@/lib/db";
import { VARIABLES } from "@/modules/cobros/dominio/mensajes";
import { plantillasDeOrganizacion } from "@/modules/cobros/servicios/mensajes";
import { FormPlantilla } from "./form-plantilla";

export const metadata: Metadata = { title: "Plantillas de mensaje" };

export default async function PlantillasPage() {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const lista = await withOrg(ctx.organizacion.id, (tx) => plantillasDeOrganizacion(tx));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Plantillas de mensaje</h1>
      <p className="text-sm text-muted-foreground">
        Variables disponibles:{" "}
        {VARIABLES.map((v) => (
          <code key={v} className="mr-1 rounded bg-muted px-1">{`{${v}}`}</code>
        ))}
      </p>
      {lista.map((p) => (
        <Card key={p.clave}>
          <CardHeader>
            <CardTitle className="text-base">{p.titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <FormPlantilla clave={p.clave} cuerpo={p.cuerpo} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
