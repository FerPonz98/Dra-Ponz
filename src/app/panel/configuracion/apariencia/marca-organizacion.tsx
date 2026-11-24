"use client";
import { ImageUp, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useTransition } from "react";
import { MarcaOrganizacion } from "@/components/marca/marca";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmar } from "@/components/ui/dialogo";
import { notificar } from "@/components/ui/toaster";
import { MARCAS_INCORPORADAS, type OrgMarca } from "@/core/marca/marca";
import { accionQuitarMarca, accionSubirMarca } from "./acciones";

/** Logo e isotipo de la organización: vista actual (en fondo claro y oscuro), subir SVG/PNG y volver al de por defecto. */
export function SeccionMarca({ org }: { org: OrgMarca }) {
  const incorporada = !!MARCAS_INCORPORADAS[org.slug];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo e isotipo</CardTitle>
        <CardDescription>
          {incorporada ? "Por defecto se usa tu monograma JP, que toma los colores de tu tema. " : ""}Puedes subir los tuyos en SVG (ideal) o PNG, hasta 2 MB. Los SVG se
          revisan y limpian automáticamente (sin scripts, eventos ni enlaces externos).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Subir org={org} cual="logo" titulo="Logo completo" ayuda="Encabezado de la landing, PDF y correos." propio={!!org.logoArchivoId} />
        <Subir org={org} cual="isotipo" titulo="Isotipo" ayuda="Espacios chicos: celular, portal, panel, íconos." propio={!!org.isotipoArchivoId} />
      </CardContent>
    </Card>
  );
}

function Subir({ org, cual, titulo, ayuda, propio }: { org: OrgMarca; cual: "logo" | "isotipo"; titulo: string; ayuda: string; propio: boolean }) {
  const router = useRouter();
  const [estado, accion, subiendo] = useActionState(accionSubirMarca, null);
  const [quitando, iniciar] = useTransition();
  useEffect(() => {
    if (!estado) return;
    notificar(estado);
    if (estado.ok) router.refresh();
  }, [estado, router]);
  const eliminados = estado?.ok ? (estado.datos?.eliminados ?? []) : [];
  return (
    <div className="space-y-3 rounded-xl border border-border p-4" data-testid={`marca-${cual}`}>
      <div>
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
        {(["tema", "blanco"] as const).map((v) => (
          <div key={v} className={`flex h-24 items-center justify-center p-3 ${v === "blanco" ? "bg-[#0a3640]" : "bg-[#faf6ee]"}`}>
            <MarcaOrganizacion org={org} cual={cual} variante={v} className={cual === "logo" ? "h-12 w-auto max-w-full" : "h-14 w-14"} claseInicial="size-12 text-xl" />
          </div>
        ))}
      </div>
      <form action={accion} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="cual" value={cual} />
        <label className="sr-only" htmlFor={`archivo-${cual}`}>
          {`Archivo del ${titulo.toLowerCase()} (SVG o PNG)`}
        </label>
        <input id={`archivo-${cual}`} name="archivo" type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png" className="max-w-full text-xs file:mr-2 file:rounded-md file:border file:border-border-strong file:bg-surface file:px-2 file:py-1" required />
        <Button type="submit" size="sm" disabled={subiendo}>
          <ImageUp aria-hidden /> {subiendo ? "Subiendo…" : "Subir"}
        </Button>
        {propio && (
          <Confirmar
            disparador={
              <Button type="button" size="sm" variant="ghost" disabled={quitando}>
                <RotateCcw aria-hidden /> Usar el de por defecto
              </Button>
            }
            titulo={`¿Quitar el ${titulo.toLowerCase()} subido?`}
            descripcion="Vuelve el de por defecto. El archivo subido deja de usarse."
            confirmar="Quitar"
            alConfirmar={() =>
              iniciar(async () => {
                notificar(await accionQuitarMarca(cual));
                router.refresh();
              })
            }
          />
        )}
      </form>
      {eliminados.length > 0 && (
        <Aviso tipo="aviso" titulo="Limpiamos tu SVG">
          Quitamos: {eliminados.join(", ")}. Revisa que se vea bien.
        </Aviso>
      )}
    </div>
  );
}
