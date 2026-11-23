import { Building2, HardDrive, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { requerirSuperadmin } from "@/core/contexto";
import { MODULOS } from "@/core/db/schema";
import { usoDeOrganizaciones } from "@/core/servicios";
import { BotonSalir } from "@/components/boton-salir";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EncabezadoPagina, TarjetaKpi } from "@/components/ui/varios";
import { cn } from "@/lib/utils";
import { accionCambiarModulo, accionSuspender } from "./acciones";
import { FormNuevaOrganizacion } from "./form-nueva";

export const metadata: Metadata = { title: "Superadmin", robots: { index: false } };

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const plural = (n: number, uno: string, varios = `${uno}s`) => `${n} ${n === 1 ? uno : varios}`;

export default async function SuperadminPage() {
  const ctx = await requerirSuperadmin();
  const orgs = await usoDeOrganizaciones();
  const sum = (f: (o: (typeof orgs)[number]) => number) => orgs.reduce((s, o) => s + f(o), 0);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">S</span>
            <span>
              <span className="block text-sm font-semibold leading-tight">Superadmin</span>
              <span className="block text-xs text-muted-foreground">{ctx.usuario.correo}</span>
            </span>
          </div>
          <BotonSalir />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 md:px-8">
        <EncabezadoPagina titulo="Organizaciones" descripcion="Crea negocios, activa sus módulos y revisa cuánto usan la plataforma." />
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Uso total">
          <TarjetaKpi titulo="Organizaciones" valor={orgs.length} icono={Building2} tono="primario" detalle={plural(orgs.filter((o) => o.suspendida).length, "suspendida")} />
          <TarjetaKpi titulo="Usuarios" valor={sum((o) => Number(o.usuarios))} icono={Users} tono="exito" />
          <TarjetaKpi titulo="Planes de pago" valor={sum((o) => o.planes)} icono={Wallet} tono="aviso" detalle={plural(sum((o) => o.clientes), "cliente")} />
          <TarjetaKpi titulo="Archivos" valor={mb(sum((o) => o.bytesArchivos))} icono={HardDrive} tono="peligro" />
        </section>

        <Card className="overflow-hidden">
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
                      {o.slug}
                      {o.dominio ? ` · ${o.dominio}` : ""}
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
                            <button
                              type="submit"
                              aria-pressed={activo}
                              title={activo ? "Desactivar" : "Activar"}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 ring-inset transition-colors",
                                activo ? "bg-primary-soft text-primary ring-primary/25 hover:bg-primary/15" : "bg-surface text-muted-foreground ring-border-strong hover:bg-muted",
                              )}
                            >
                              <span className={cn("size-1.5 rounded-full", activo ? "bg-primary" : "bg-subtle-foreground")} aria-hidden />
                              {m} {activo ? "✓" : "✗"}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {plural(Number(o.usuarios), "usuario")} · {plural(o.clientes, "cliente")} · {plural(o.planes, "plan", "planes")} · {mb(o.bytesArchivos)}
                  </TD>
                  <TD>
                    <form action={accionSuspender} className="flex items-center gap-2">
                      <input type="hidden" name="organizacionId" value={o.id} />
                      <input type="hidden" name="suspendida" value={String(!o.suspendida)} />
                      {o.suspendida ? <Badge variant="peligro">Suspendida</Badge> : <Badge variant="exito">Activa</Badge>}
                      <Button type="submit" size="sm" variant="ghost">
                        {o.suspendida ? "Reactivar" : "Suspender"}
                      </Button>
                    </form>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nueva organización</CardTitle>
            <CardDescription>Se crea con su rol Administrador y el primer usuario.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormNuevaOrganizacion />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
