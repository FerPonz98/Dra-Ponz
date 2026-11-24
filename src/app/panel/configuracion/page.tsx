import type { Metadata } from "next";
import { requerirPermiso } from "@/core/contexto";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EncabezadoPagina } from "@/components/ui/varios";
import { FormOrganizacion } from "./form-organizacion";

export const metadata: Metadata = { title: "Organización" };

export default async function ConfiguracionPage() {
  const ctx = await requerirPermiso("organizacion:configurar");
  const o = ctx.organizacion;
  return (
    <div className="mx-auto max-w-4xl">
      <EncabezadoPagina ayuda="configurar-cuenta" titulo="Organización" descripcion="Datos de tu negocio y lo que ven tus clientes al pagar." />
      <Card>
        <CardHeader>
          <CardTitle>Datos, marca y cobro</CardTitle>
          <CardDescription>El QR y los datos bancarios aparecen en el portal de pago de tus clientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormOrganizacion
            inicial={{
              nombre: o.nombre,
              datosBancarios: o.datosBancarios ?? "",
              monedaDefecto: o.monedaDefecto as "BOB" | "BRL",
              whatsapp: o.whatsapp ?? "",
              dominio: o.dominio ?? "",
            }}
            qrId={o.qrArchivoId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
