import type { Metadata } from "next";
import { requerirSuperadmin } from "@/core/contexto";
import { MODULOS } from "@/core/db/schema";
import { usoDeOrganizaciones } from "@/core/servicios";
import { BotonSalir } from "@/components/boton-salir";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { accionCambiarModulo, accionSuspender } from "./acciones";
import { FormNuevaOrganizacion } from "./form-nueva";

export const metadata: Metadata = { title: "Superadmin", robots: { index: false } };

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

export default async function SuperadminPage() {
  const ctx = await requerirSuperadmin();
  const orgs = await usoDeOrganizaciones();
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Superadmin</h1>
          <p className="text-sm text-muted-foreground">{ctx.usuario.correo}</p>
        </div>
        <BotonSalir />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Organizaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Organización</TH>
                <TH>Módulos</TH>
                <TH>Uso</TH>
                <TH>Estado</TH>
              </TR>
            </THead>
            <TBody>
              {orgs.map((o) => (
                <TR key={o.id} data-testid={`org-${o.slug}`}>
                  <TD>
                    <p className="font-medium">{o.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.slug} {o.dominio ? `· ${o.dominio}` : ""}
                    </p>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      {MODULOS.map((m) => {
                        const activo = o.modulos.find((x) => x.modulo === m)?.activo ?? false;
                        return (
                          <form key={m} action={accionCambiarModulo}>
                            <input type="hidden" name="organizacionId" value={o.id} />
                            <input type="hidden" name="modulo" value={m} />
                            <input type="hidden" name="activo" value={String(!activo)} />
                            <Button size="sm" variant={activo ? "default" : "outline"} aria-pressed={activo} title={activo ? "Desactivar" : "Activar"}>
                              {m} {activo ? "✓" : "✗"}
                            </Button>
                          </form>
                        );
                      })}
                    </div>
                  </TD>
                  <TD className="text-xs">
                    {o.usuarios} usuarios · {o.clientes} clientes · {o.planes} planes · {mb(o.bytesArchivos)}
                  </TD>
                  <TD>
                    <form action={accionSuspender} className="flex items-center gap-2">
                      <input type="hidden" name="organizacionId" value={o.id} />
                      <input type="hidden" name="suspendida" value={String(!o.suspendida)} />
                      {o.suspendida ? <Badge variant="peligro">Suspendida</Badge> : <Badge variant="exito">Activa</Badge>}
                      <Button size="sm" variant="outline">
                        {o.suspendida ? "Reactivar" : "Suspender"}
                      </Button>
                    </form>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nueva organización</CardTitle>
        </CardHeader>
        <CardContent>
          <FormNuevaOrganizacion />
        </CardContent>
      </Card>
    </main>
  );
}
