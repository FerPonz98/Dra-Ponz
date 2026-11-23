import { Mail, Phone, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirModulo } from "@/core/contexto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, BarraProgreso, EncabezadoPagina, EstadoVacio, Migas } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { BadgeMora } from "@/modules/cobros/componentes/estado";
import { obtenerCliente } from "@/modules/cobros/servicios/clientes";
import { listarPlanes } from "@/modules/cobros/servicios/planes";
import { FormCliente } from "../form-cliente";

export default async function ClientePage(props: { params: Promise<{ id: string }> }) {
  const ctx = await requerirModulo("cobros", "cobros:ver");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const datos = await withOrg(ctx.organizacion.id, async (tx) => ({ cliente: await obtenerCliente(tx, id), planes: await listarPlanes(tx, { clienteId: id }) }));
  if (!datos.cliente) notFound();
  const c = datos.cliente;
  const editar = ctx.puede("cobros:editar");
  return (
    <div>
      <EncabezadoPagina
        migas={<Migas items={[{ etiqueta: "Clientes", href: "/panel/cobros/clientes" }, { etiqueta: c.nombre }]} />}
        titulo={
          <span className="flex items-center gap-3">
            <Avatar nombre={c.nombre} className="size-11 text-sm" />
            {c.nombre}
          </span>
        }
        descripcion={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {c.ci && <span>CI {c.ci}</span>}
            {c.whatsapp && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" aria-hidden />+{c.whatsapp}
              </span>
            )}
            {c.correo && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5" aria-hidden />
                {c.correo}
              </span>
            )}
          </span>
        }
        acciones={
          editar && (
            <Button asChild>
              <Link href={`/panel/cobros/planes/nuevo?cliente=${c.id}`}>
                <Plus /> Nuevo plan de pagos
              </Link>
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader>
            <CardTitle>Planes de pago</CardTitle>
            <CardDescription>{datos.planes.length ? `${datos.planes.length} ${datos.planes.length === 1 ? "plan" : "planes"}` : "Todavía no tiene planes"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {datos.planes.length === 0 && <EstadoVacio icono={Wallet} titulo="Sin planes de pago" descripcion="Crea un plan con sus cuotas y envíale el enlace para pagar con QR." className="py-6" />}
            {datos.planes.map((p) => (
              <Link key={p.plan.id} href={`/panel/cobros/planes/${p.plan.id}`} className="block rounded-lg border border-border p-4 transition-colors hover:border-primary/40 hover:bg-surface-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.plan.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatoMoneda(p.pagado, p.plan.moneda)} pagado de {formatoMoneda(p.total, p.plan.moneda)}
                    </p>
                  </div>
                  <BadgeMora estado={p.plan.estadoMora} />
                </div>
                <BarraProgreso valor={p.total ? Math.round((p.pagado / p.total) * 100) : 0} etiqueta={`Avance de pago de ${p.plan.titulo}`} className="mt-3" />
              </Link>
            ))}
          </CardContent>
        </Card>
        {editar && (
          <Card>
            <CardHeader>
              <CardTitle>Datos del cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <FormCliente id={c.id} inicial={{ nombre: c.nombre, ci: c.ci ?? "", whatsapp: c.whatsapp ?? "", correo: c.correo ?? "", notas: c.notas ?? "" }} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
