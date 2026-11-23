"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/input";
import { accionGuardarOrganizacion } from "./acciones";

type Inicial = { nombre: string; colorPrimario: string; colorSecundario: string; datosBancarios: string; monedaDefecto: "BOB" | "BRL"; whatsapp: string; dominio: string };

export function FormOrganizacion({ inicial, qrId, logoId }: { inicial: Inicial; qrId: string | null; logoId: string | null }) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState(accionGuardarOrganizacion, null);
  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);
  return (
    <form action={accion} className="grid gap-4 md:grid-cols-2">
      {estado && (
        <div className="md:col-span-2">
          <Aviso tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Aviso>
        </div>
      )}
      <Campo etiqueta="Nombre" htmlFor="o-nombre">
        <Input id="o-nombre" name="nombre" defaultValue={inicial.nombre} required />
      </Campo>
      <Campo etiqueta="WhatsApp del negocio" htmlFor="o-wa" ayuda="Con código de país, solo números">
        <Input id="o-wa" name="whatsapp" defaultValue={inicial.whatsapp} inputMode="tel" />
      </Campo>
      <Campo etiqueta="Color principal" htmlFor="o-c1">
        <Input id="o-c1" name="colorPrimario" type="color" defaultValue={inicial.colorPrimario} />
      </Campo>
      <Campo etiqueta="Color secundario" htmlFor="o-c2">
        <Input id="o-c2" name="colorSecundario" type="color" defaultValue={inicial.colorSecundario} />
      </Campo>
      <Campo etiqueta="Moneda por defecto" htmlFor="o-mon">
        <Select id="o-mon" name="monedaDefecto" defaultValue={inicial.monedaDefecto}>
          <option value="BOB">BOB</option>
          <option value="BRL">BRL</option>
        </Select>
      </Campo>
      <Campo etiqueta="Dominio" htmlFor="o-dom" ayuda="Lo configura el superadmin">
        <Input id="o-dom" defaultValue={inicial.dominio} disabled />
      </Campo>
      <div className="md:col-span-2">
        <Campo etiqueta="Datos bancarios (se muestran en el portal junto al QR)" htmlFor="o-banco">
          <Textarea id="o-banco" name="datosBancarios" defaultValue={inicial.datosBancarios} />
        </Campo>
      </div>
      <Campo etiqueta="Imagen del QR estático de cobro" htmlFor="o-qr" ayuda={qrId ? "Ya hay un QR cargado; sube otro para reemplazarlo." : "PNG, JPG o WEBP"}>
        <Input id="o-qr" name="qr" type="file" accept=".png,.jpg,.jpeg,.webp" />
      </Campo>
      <Campo etiqueta="Logo" htmlFor="o-logo" ayuda={logoId ? "Ya hay un logo cargado." : "PNG, JPG o WEBP"}>
        <Input id="o-logo" name="logo" type="file" accept=".png,.jpg,.jpeg,.webp" />
      </Campo>
      {qrId && (
        // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por ruta autenticada
        <img src={`/api/archivos/${qrId}`} alt="QR de cobro actual" className="h-40 w-40 rounded border object-contain" />
      )}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pendiente}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
