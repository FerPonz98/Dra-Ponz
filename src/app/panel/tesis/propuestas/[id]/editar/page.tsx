import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hoyDe, requerirModulo } from "@/core/contexto";
import { Aviso } from "@/components/ui/aviso";
import { EncabezadoPagina, Migas } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { listarClientes } from "@/modules/cobros/servicios/clientes";
import { ESTADOS_EDITABLES } from "@/modules/tesis/dominio/estados";
import { listarFormulariosActivos } from "@/modules/tesis/servicios/catalogos";
import { obtenerProyecto } from "@/modules/tesis/servicios/propuestas";
import { AsistentePropuesta } from "../../asistente";
import { valorDesdeProyecto } from "../../valor-inicial";

export const metadata: Metadata = { title: "Editar propuesta" };

export default async function EditarPropuestaPage(props: { params: Promise<{ id: string }> }) {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const hoy = hoyDe(ctx);
  const d = await withOrg(ctx.organizacion.id, async (tx) => ({
    p: await obtenerProyecto(tx, id),
    estudiantes: await listarClientes(tx),
    formularios: await listarFormulariosActivos(tx),
  }));
  if (!d.p) notFound();
  if (d.p.propuesta.aceptadaEn || !ESTADOS_EDITABLES.includes(d.p.propuesta.estado)) redirect(`/panel/tesis/propuestas/${id}`);
  return (
    <div className="space-y-4">
      <EncabezadoPagina
        migas={<Migas items={[{ etiqueta: "Propuestas y proyectos", href: "/panel/tesis/propuestas" }, { etiqueta: d.p.propuesta.titulo, href: `/panel/tesis/propuestas/${id}` }, { etiqueta: "Editar" }]} />}
        titulo="Editar propuesta"
        descripcion="Los cambios del plan de pagos quedan en su historial."
      />
      {d.p.propuesta.estado === "vencida" && <Aviso tipo="aviso" titulo="Esta propuesta venció">Puedes editar todo y luego reenviarla con un enlace nuevo.</Aviso>}
      <AsistentePropuesta id={id} inicial={valorDesdeProyecto(d.p, hoy)} estudiantes={d.estudiantes.map((c) => ({ id: c.id, nombre: c.nombre }))} formularios={d.formularios} hoy={hoy} />
    </div>
  );
}
