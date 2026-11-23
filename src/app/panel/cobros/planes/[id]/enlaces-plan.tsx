"use client";
import { Copy, KeyRound, Link2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmar } from "@/components/ui/dialogo";
import { notificar, toast } from "@/components/ui/toaster";
import { accionAnularEnlace, accionCrearEnlace } from "../../acciones";

type Props = { planId: string; tieneCi: boolean; vigente: { id: string; url: string; metodo: "ci" | "pin"; expiraEn: string | null } | null; whatsapp: string | null };

export function EnlacesPlan({ planId, tieneCi, vigente }: Props) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState<{ url: string; pin: string | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function generar(metodo: "ci" | "pin") {
    setOcupado(true);
    const r = await accionCrearEnlace(planId, metodo);
    setOcupado(false);
    if (r.ok && r.datos) {
      setNuevo(r.datos);
      toast.success("Enlace generado");
    } else notificar(r);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal del cliente</CardTitle>
        <CardDescription>Un enlace único y privado para ver sus cuotas y pagar con QR.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {nuevo?.pin && (
          <Aviso tipo="aviso" titulo="Anota el PIN">
            PIN de acceso: <strong data-testid="pin-portal" className="font-mono text-base tracking-widest">{nuevo.pin}</strong>. Compártelo con el cliente: no se volverá a mostrar.
          </Aviso>
        )}
        {vigente ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-exito" aria-hidden />
              Activo · acceso con {vigente.metodo === "ci" ? "CI del cliente" : "PIN"}
              {vigente.expiraEn ? ` · vence ${new Date(vigente.expiraEn).toLocaleDateString("es-BO")}` : ""}
            </p>
            <code className="block break-all rounded-lg border border-border bg-surface-2 p-2.5 font-mono text-xs" data-testid="url-portal">
              {vigente.url}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(vigente.url);
                  toast.success("Enlace copiado");
                }}
              >
                <Copy /> Copiar enlace
              </Button>
              <Confirmar
                disparador={
                  <Button size="sm" variant="ghost" className="text-peligro hover:bg-peligro-soft">
                    Anular enlace
                  </Button>
                }
                titulo="¿Anular el enlace?"
                descripcion="El cliente ya no podrá entrar con este enlace. Puedes generar uno nuevo cuando quieras."
                confirmar="Anular enlace"
                peligroso
                alConfirmar={async () => {
                  const r = await accionAnularEnlace(planId, vigente.id);
                  notificar(r);
                  setNuevo(null);
                  router.refresh();
                }}
              />
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-muted-foreground">
            <Link2 className="size-4" aria-hidden /> No hay un enlace activo.
          </p>
        )}
        <div className="space-y-2 border-t border-border pt-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Button onClick={() => generar("ci")} disabled={!tieneCi || ocupado} title={tieneCi ? undefined : "El cliente no tiene CI registrado"}>
              <ShieldCheck /> {vigente ? "Nuevo enlace con CI" : "Generar enlace con CI"}
            </Button>
            <Button variant="outline" onClick={() => generar("pin")} disabled={ocupado}>
              <KeyRound /> {vigente ? "Nuevo enlace con PIN" : "Generar enlace con PIN"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Generar un enlace nuevo anula el anterior.</p>
        </div>
      </CardContent>
    </Card>
  );
}
