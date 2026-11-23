import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requerirModulo } from "@/core/contexto";
import { withOrg } from "@/lib/db";
import { obtenerFormulario } from "@/modules/tesis/servicios/formularios";
import { EditorFormulario } from "../editor-formulario";

export const metadata: Metadata = { title: "Formulario" };

export default async function FormularioPage(props: { params: Promise<{ id: string }> }) {
  const ctx = await requerirModulo("tesis", "tesis:editar");
  const { id } = await props.params;
  if (id === "nuevo") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Nuevo formulario</h1>
        <EditorFormulario inicial={{ nombre: "", descripcion: "", campos: [{ tipo: "texto_corto", etiqueta: "", ayuda: "", obligatorio: true, opciones: "" }] }} />
      </div>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const f = await withOrg(ctx.organizacion.id, (tx) => obtenerFormulario(tx, id));
  if (!f) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">{f.nombre}</h1>
      <EditorFormulario
        id={f.id}
        inicial={{ nombre: f.nombre, descripcion: f.descripcion ?? "", campos: f.campos.map((c) => ({ id: c.id, tipo: c.tipo, etiqueta: c.etiqueta, ayuda: c.ayuda ?? "", obligatorio: c.obligatorio, opciones: c.opciones.join("\n") })) }}
      />
    </div>
  );
}
