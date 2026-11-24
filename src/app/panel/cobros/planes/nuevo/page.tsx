import type { Metadata } from "next";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { EncabezadoPagina, Migas } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { listarClientes } from "@/modules/cobros/servicios/clientes";
import { FormPlan } from "./form-plan";

export const metadata: Metadata = { title: "Nuevo plan" };

export default async function NuevoPlanPage(props: { searchParams: Promise<{ cliente?: string }> }) {
  const ctx = await requerirModulo("cobros", "cobros:editar");
  const { cliente } = await props.searchParams;
  const clientes = await withOrg(ctx.organizacion.id, (tx) => listarClientes(tx));
  return (
    <div>
      <EncabezadoPagina ayuda="cobros"
        migas={<Migas items={[{ etiqueta: "Planes de pago", href: "/panel/cobros/planes" }, { etiqueta: "Nuevo plan" }]} />}
        titulo="Nuevo plan de pagos"
        descripcion="Genera las cuotas automáticamente y ajusta cada monto o fecha si lo necesitas."
      />
      <FormPlan clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))} clienteInicial={cliente} moneda={ctx.organizacion.monedaDefecto as "BOB" | "BRL"} hoy={hoyDe(ctx)} />
    </div>
  );
}
