import type { Metadata } from "next";
import { requerirPermiso } from "@/core/contexto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormOrganizacion } from "./form-organizacion";

export const metadata: Metadata = { title: "Organización" };

export default async function ConfiguracionPage() {
  const ctx = await requerirPermiso("organizacion:configurar");
  const o = ctx.organizacion;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Organización</h1>
      <Card>
        <CardHeader>
          <CardTitle>Datos, marca y cobro</CardTitle>
        </CardHeader>
        <CardContent>
          <FormOrganizacion
            inicial={{
              nombre: o.nombre,
              colorPrimario: o.colorPrimario,
              colorSecundario: o.colorSecundario,
              datosBancarios: o.datosBancarios ?? "",
              monedaDefecto: o.monedaDefecto as "BOB" | "BRL",
              whatsapp: o.whatsapp ?? "",
              dominio: o.dominio ?? "",
            }}
            qrId={o.qrArchivoId}
            logoId={o.logoArchivoId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
