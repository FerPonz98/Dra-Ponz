"use client";
import { Palette } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/input";
import { notificar } from "@/components/ui/toaster";
import { accionGuardarOrganizacion } from "./acciones";

type Inicial = { nombre: string; datosBancarios: string; monedaDefecto: "BOB" | "BRL"; whatsapp: string; dominio: string };

export function FormOrganizacion({ inicial, qrId }: { inicial: Inicial; qrId: string | null }) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState(accionGuardarOrganizacion, null);
  useEffect(() => {
    if (!estado) return;
    notificar(estado);
    if (estado.ok) router.refresh();
  }, [estado, router]);
  return (
    <form action={accion} className="grid gap-4 md:grid-cols-2">
      <Campo etiqueta="Nombre" htmlFor="o-nombre">
        <Input id="o-nombre" name="nombre" defaultValue={inicial.nombre} required />
      </Campo>
      <Campo etiqueta="WhatsApp del negocio" htmlFor="o-wa" ayuda="Con código de país, solo números">
        <Input id="o-wa" name="whatsapp" defaultValue={inicial.whatsapp} inputMode="tel" />
      </Campo>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-sm md:col-span-2">
        <Palette className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="flex-1 text-muted-foreground">El logo, los colores, las fuentes y los bordes de tu landing y del portal se eligen en Apariencia, con vista previa y revisión de contraste.</p>
        <Link href="/panel/configuracion/apariencia" className="shrink-0 font-medium text-primary hover:underline">
          Ir a Apariencia
        </Link>
      </div>
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
      {qrId && (
        // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por ruta autenticada
        <img src={`/api/archivos/${qrId}`} alt="QR de cobro actual" className="h-40 w-40 rounded-xl border border-border bg-white object-contain p-2" />
      )}
      <div className="border-t border-border pt-4 md:col-span-2">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
