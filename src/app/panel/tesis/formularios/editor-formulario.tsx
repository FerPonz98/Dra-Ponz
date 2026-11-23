"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input, Select, Textarea } from "@/components/ui/input";
import { ETIQUETA_TIPO, TIPOS_CAMPO, type TipoCampo } from "@/modules/tesis/dominio/campos";
import { accionGuardarFormulario } from "./acciones";

type CampoEd = { id?: string; tipo: TipoCampo; etiqueta: string; ayuda: string; obligatorio: boolean; opciones: string };

export function EditorFormulario({ id, inicial }: { id?: string; inicial: { nombre: string; descripcion: string; campos: CampoEd[] } }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(inicial.nombre);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [campos, setCampos] = useState<CampoEd[]>(inicial.campos);
  const [res, setRes] = useState<{ ok: boolean; mensaje?: string } | null>(null);
  const set = (i: number, c: Partial<CampoEd>) => setCampos((x) => x.map((y, j) => (j === i ? { ...y, ...c } : y)));
  const mover = (i: number, d: -1 | 1) =>
    setCampos((x) => {
      const n = [...x];
      const j = i + d;
      if (j < 0 || j >= n.length) return x;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function guardar() {
    const r = await accionGuardarFormulario(
      { nombre, descripcion, campos: campos.map((c) => ({ id: c.id, tipo: c.tipo, etiqueta: c.etiqueta, ayuda: c.ayuda, obligatorio: c.obligatorio, opciones: c.opciones.split("\n").map((o) => o.trim()).filter(Boolean) })) },
      id,
    );
    setRes(r);
    if (r.ok && r.datos) {
      if (!id) router.push(`/panel/tesis/formularios/${r.datos.id}`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-4 md:pt-6">
          <Campo etiqueta="Nombre del formulario" htmlFor="f-nombre">
            <Input id="f-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo etiqueta="Descripción (la ve el estudiante)" htmlFor="f-desc">
            <Textarea id="f-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </Campo>
        </CardContent>
      </Card>
      {campos.map((c, i) => (
        <Card key={c.id ?? `n${i}`} data-testid="campo-formulario">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Campo {i + 1}</CardTitle>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label={`Subir campo ${i + 1}`} onClick={() => mover(i, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Bajar campo ${i + 1}`} onClick={() => mover(i, 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Quitar campo ${i + 1}`} onClick={() => setCampos((x) => x.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Campo etiqueta="Etiqueta" htmlFor={`c-et-${i}`}>
              <Input id={`c-et-${i}`} value={c.etiqueta} onChange={(e) => set(i, { etiqueta: e.target.value })} />
            </Campo>
            <Campo etiqueta="Tipo" htmlFor={`c-tipo-${i}`}>
              <Select id={`c-tipo-${i}`} value={c.tipo} onChange={(e) => set(i, { tipo: e.target.value as TipoCampo })}>
                {TIPOS_CAMPO.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO[t]}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo etiqueta="Ayuda (opcional)" htmlFor={`c-ay-${i}`}>
              <Input id={`c-ay-${i}`} value={c.ayuda} onChange={(e) => set(i, { ayuda: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" className="size-4" checked={c.obligatorio} onChange={(e) => set(i, { obligatorio: e.target.checked })} /> Obligatorio
            </label>
            {c.tipo === "seleccion" && (
              <div className="md:col-span-2">
                <Campo etiqueta="Opciones (una por línea)" htmlFor={`c-op-${i}`}>
                  <Textarea id={`c-op-${i}`} value={c.opciones} onChange={(e) => set(i, { opciones: e.target.value })} />
                </Campo>
              </div>
            )}
            {(c.tipo === "archivo" || c.tipo === "zip") && <p className="text-xs text-muted-foreground md:col-span-2">Límite: 50 MB por archivo. Se valida el tipo por extensión y por contenido.</p>}
          </CardContent>
        </Card>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setCampos((x) => [...x, { tipo: "texto_corto", etiqueta: "", ayuda: "", obligatorio: false, opciones: "" }])}>
          <Plus /> Agregar campo
        </Button>
        <Button type="button" onClick={guardar}>
          Guardar formulario
        </Button>
      </div>
      {res && <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>}
    </div>
  );
}
