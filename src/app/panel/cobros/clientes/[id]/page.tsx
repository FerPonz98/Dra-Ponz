import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirModulo } from "@/core/contexto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{c.nombre}</h1>
        {ctx.puede("cobros:editar") && (
          <Button asChild>
            <Link href={`/panel/cobros/planes/nuevo?cliente=${c.id}`}>Nuevo plan de pagos</Link>
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Planes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {datos.planes.length === 0 && <p className="text-sm text-muted-foreground">Sin planes.</p>}
          {datos.planes.map((p) => (
            <Link key={p.plan.id} href={`/panel/cobros/planes/${p.plan.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted">
              <span>
                <span className="font-medium">{p.plan.titulo}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatoMoneda(p.pagado, p.plan.moneda)} de {formatoMoneda(p.total, p.plan.moneda)}
                </span>
              </span>
              <BadgeMora estado={p.plan.estadoMora} />
            </Link>
          ))}
        </CardContent>
      </Card>
      {ctx.puede("cobros:editar") && (
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
  );
}
