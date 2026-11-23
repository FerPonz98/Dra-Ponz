"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accionAnularEnlace, accionCrearEnlace } from "../../acciones";

type Props = { planId: string; tieneCi: boolean; vigente: { id: string; url: string; metodo: "ci" | "pin"; expiraEn: string | null } | null; whatsapp: string | null };

export function EnlacesPlan({ planId, tieneCi, vigente }: Props) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState<{ url: string; pin: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generar(metodo: "ci" | "pin") {
    setError(null);
    const r = await accionCrearEnlace(planId, metodo);
    if (r.ok && r.datos) setNuevo(r.datos);
    else if (!r.ok) setError(r.mensaje);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal del cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {nuevo?.pin && (
          <Aviso tipo="aviso">
            PIN de acceso: <strong data-testid="pin-portal">{nuevo.pin}</strong>. Anótalo y compártelo con el cliente: no se volverá a mostrar.
          </Aviso>
        )}
        {vigente ? (
          <div className="space-y-2">
            <p className="text-sm">
              Enlace activo (acceso con {vigente.metodo === "ci" ? "CI del cliente" : "PIN"}
              {vigente.expiraEn ? `, vence ${new Date(vigente.expiraEn).toLocaleDateString("es-BO")}` : ""}):
            </p>
            <code className="block break-all rounded bg-muted p-2 text-xs" data-testid="url-portal">
              {vigente.url}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(vigente.url)}>
                Copiar enlace
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (!confirm("¿Anular el enlace? El cliente ya no podrá entrar con él.")) return;
                  await accionAnularEnlace(planId, vigente.id);
                  setNuevo(null);
                  router.refresh();
                }}
              >
                Anular enlace
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay un enlace activo.</p>
        )}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button size="sm" onClick={() => generar("ci")} disabled={!tieneCi} title={tieneCi ? undefined : "El cliente no tiene CI"}>
            {vigente ? "Nuevo enlace con CI" : "Generar enlace con CI"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => generar("pin")}>
            {vigente ? "Nuevo enlace con PIN" : "Generar enlace con PIN"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Generar un enlace nuevo anula el anterior.</p>
      </CardContent>
    </Card>
  );
}
