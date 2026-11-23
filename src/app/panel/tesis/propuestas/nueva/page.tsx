import type { Metadata } from "next";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { EncabezadoPagina, Migas } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { listarClientes } from "@/modules/cobros/servicios/clientes";
import { extrasDelCatalogo, listarFormulariosActivos } from "@/modules/tesis/servicios/catalogos";
import { AsistentePropuesta } from "../asistente";
import { valorInicialNuevo } from "../valor-inicial";

export const metadata: Metadata = { title: "Nueva propuesta" };

export default async function NuevaPropuestaPage() {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const hoy = hoyDe(ctx);
  const d = await withOrg(ctx.organizacion.id, async (tx) => ({
    estudiantes: await listarClientes(tx),
    formularios: await listarFormulariosActivos(tx),
    extras: await extrasDelCatalogo(tx),
  }));
  const inicial = valorInicialNuevo(hoy, null);
  inicial.extras = d.extras.map((x) => ({ nombre: x.nombre, precio: (x.precioCentavos / 100).toFixed(2) }));
  return (
    <div>
      <EncabezadoPagina migas={<Migas items={[{ etiqueta: "Propuestas y proyectos", href: "/panel/tesis/propuestas" }, { etiqueta: "Nueva propuesta" }]} />} titulo="Nueva propuesta de asesoría" descripcion="Diez pasos cortos. Puedes guardar como borrador en cualquier momento." />
      <AsistentePropuesta inicial={inicial} estudiantes={d.estudiantes.map((c) => ({ id: c.id, nombre: c.nombre }))} formularios={d.formularios} hoy={hoy} />
    </div>
  );
}
