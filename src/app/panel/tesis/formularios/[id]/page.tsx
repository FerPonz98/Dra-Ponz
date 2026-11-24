import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirModulo } from "@/core/contexto";
import { EncabezadoPagina, Migas } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { obtenerFormulario } from "@/modules/tesis/servicios/formularios";
import { EditorFormulario } from "../editor-formulario";
import { BotonEliminar } from "@/components/panel/boton-eliminar";
import { accionEliminarFormulario } from "@/app/panel/eliminar-acciones";

export const metadata: Metadata = { title: "Formulario" };

export default async function FormularioPage(props: { params: Promise<{ id: string }> }) {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const { id } = await props.params;
  if (id === "nuevo") {
    return (
      <div className="mx-auto max-w-3xl">
        <EncabezadoPagina ayuda="formularios" migas={<Migas items={[{ etiqueta: "Formularios", href: "/panel/tesis/formularios" }, { etiqueta: "Nuevo" }]} />} titulo="Nuevo formulario" descripcion="Agrega los campos en el orden en que quieres que el estudiante los complete." />
        <EditorFormulario inicial={{ nombre: "", descripcion: "", campos: [{ tipo: "texto_corto", etiqueta: "", ayuda: "", obligatorio: true, opciones: "" }] }} />
      </div>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const f = await withOrg(ctx.organizacion.id, (tx) => obtenerFormulario(tx, id));
  if (!f) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <EncabezadoPagina ayuda="formularios" migas={<Migas items={[{ etiqueta: "Formularios", href: "/panel/tesis/formularios" }, { etiqueta: f.nombre }]} />} titulo={f.nombre}
        descripcion="Los cambios no afectan las respuestas que ya se enviaron."
        acciones={
          <BotonEliminar
            etiqueta="Eliminar formulario"
            titulo={`¿Eliminar «${f.nombre}»?`}
            descripcion="Las propuestas que lo usaban quedan sin formulario y se borran las respuestas enviadas con él (los archivos que subieron los estudiantes siguen en cada proyecto). No se puede deshacer."
            accion={accionEliminarFormulario.bind(null, f.id)}
          />
        }
      />
      <EditorFormulario
        id={f.id}
        inicial={{ nombre: f.nombre, descripcion: f.descripcion ?? "", campos: f.campos.map((c) => ({ id: c.id, tipo: c.tipo, etiqueta: c.etiqueta, ayuda: c.ayuda ?? "", obligatorio: c.obligatorio, opciones: c.opciones.join("\n") })) }}
      />
    </div>
  );
}
