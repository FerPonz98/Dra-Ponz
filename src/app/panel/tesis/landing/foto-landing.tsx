"use client";
import { ImageUp, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmar } from "@/components/ui/dialogo";
import { notificar } from "@/components/ui/toaster";
import { accionQuitarFotoLanding, accionSubirFotoLanding } from "./acciones";

/** Foto de la portada de la landing: vista actual, subir otra y quitarla. */
export function FotoLanding({ url }: { url: string | null }) {
  const router = useRouter();
  const [estado, accion, subiendo] = useActionState(accionSubirFotoLanding, null);
  const [quitando, iniciar] = useTransition();
  useEffect(() => {
    if (!estado) return;
    notificar(estado);
    if (estado.ok) router.refresh();
  }, [estado, router]);
  return (
    <Card data-testid="foto-landing">
      <CardHeader>
        <CardTitle className="text-base">Foto de la portada</CardTitle>
        <CardDescription>Tu foto junto al título de la página. Mejor vertical (de medio cuerpo) y con buena luz. JPG, PNG o WEBP: se optimiza sola para el celular.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex aspect-[4/5] w-36 shrink-0 items-center justify-center overflow-hidden rounded-t-full border border-border bg-surface-2">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa de la foto subida
            <img src={url} alt="Foto actual de la portada" className="size-full object-cover" />
          ) : (
            <UserRound className="size-10 text-subtle-foreground" aria-label="Sin foto todavía" />
          )}
        </div>
        <form action={accion} className="flex flex-1 flex-col gap-3">
          <label htmlFor="foto-portada" className="text-sm font-medium">
            {url ? "Cambiar la foto" : "Elegir la foto"}
          </label>
          <input
            id="foto-portada"
            name="foto"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            required
            className="max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={subiendo}>
              <ImageUp aria-hidden /> {subiendo ? "Subiendo…" : "Subir foto"}
            </Button>
            {url && (
              <Confirmar
                disparador={
                  <Button type="button" size="sm" variant="ghost" disabled={quitando}>
                    <Trash2 aria-hidden /> Quitar foto
                  </Button>
                }
                titulo="¿Quitar la foto de la portada?"
                descripcion="La página vuelve a mostrar el dibujo de reemplazo hasta que subas otra."
                confirmar="Quitar"
                alConfirmar={() =>
                  iniciar(async () => {
                    notificar(await accionQuitarFotoLanding());
                    router.refresh();
                  })
                }
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Hasta 15 MB. Los datos ocultos de la foto (como la ubicación) se borran al guardarla.</p>
        </form>
      </CardContent>
    </Card>
  );
}
