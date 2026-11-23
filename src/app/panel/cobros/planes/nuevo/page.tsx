import type { Metadata } from "next";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { withOrg } from "@/lib/db";
import { listarClientes } from "@/modules/cobros/servicios/clientes";
import { FormPlan } from "./form-plan";

export const metadata: Metadata = { title: "Nuevo plan" };

export default async function NuevoPlanPage(props: { searchParams: Promise<{ cliente?: string }> }) {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const { cliente } = await props.searchParams;
  const clientes = await withOrg(ctx.organizacion.id, (tx) => listarClientes(tx));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Nuevo plan de pagos</h1>
      <FormPlan clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))} clienteInicial={cliente} moneda={ctx.organizacion.monedaDefecto as "BOB" | "BRL"} hoy={hoyDe(ctx)} />
    </div>
  );
}
