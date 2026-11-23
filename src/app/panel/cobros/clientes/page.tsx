import type { Metadata } from "next";
import Link from "next/link";
import { requerirModulo } from "@/core/contexto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { withOrg } from "@/lib/db";
import { listarClientes } from "@/modules/cobros/servicios/clientes";
import { FormCliente } from "./form-cliente";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage(props: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requerirModulo("cobros", "cobros:ver");
  const { q } = await props.searchParams;
  const lista = await withOrg(ctx.organizacion.id, (tx) => listarClientes(tx, q));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Clientes</h1>
      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Lista</CardTitle>
          <form className="flex gap-2" role="search">
            <Input name="q" defaultValue={q} placeholder="Buscar por nombre, CI, celular o correo" aria-label="Buscar clientes" className="md:w-80" />
            <Button variant="outline" type="submit">
              Buscar
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">{q ? "Sin resultados." : "Aún no hay clientes."}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nombre</TH>
                  <TH className="hidden sm:table-cell">CI</TH>
                  <TH>WhatsApp</TH>
                  <TH className="hidden md:table-cell">Correo</TH>
                </TR>
              </THead>
              <TBody>
                {lista.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/panel/cobros/clientes/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.nombre}
                      </Link>
                    </TD>
                    <TD className="hidden sm:table-cell">{c.ci ?? "—"}</TD>
                    <TD>{c.whatsapp ? `+${c.whatsapp}` : "—"}</TD>
                    <TD className="hidden md:table-cell">{c.correo ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {ctx.puede("cobros:editar") && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <FormCliente />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
