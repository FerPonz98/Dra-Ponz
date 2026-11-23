"use client";
import Link from "next/link";
import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Input, Textarea } from "@/components/ui/input";
import type { DefSeccion } from "@/modules/tesis/dominio/landing";
import { accionGuardarLanding } from "./acciones";

export function EditorLanding({ idioma, secciones, valores }: { idioma: "es" | "pt"; secciones: DefSeccion[]; valores: Record<string, string> }) {
  const [v, setV] = useState(valores);
  const [res, setRes] = useState<{ ok: boolean; mensaje?: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Idioma" className="flex gap-2">
          {(["es", "pt"] as const).map((l) => (
            <Button key={l} asChild size="sm" variant={l === idioma ? "default" : "outline"}>
              <Link href={`/panel/tesis/landing?idioma=${l}`} aria-current={l === idioma ? "page" : undefined}>
                {l === "es" ? "Español" : "Português"}
              </Link>
            </Button>
          ))}
        </nav>
        <Button asChild size="sm" variant="ghost">
          <a href={`/${idioma}`} target="_blank" rel="noopener">
            Ver la página
          </a>
        </Button>
      </div>
      {secciones.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle className="text-base">{s.titulo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.campos.map((c) => (
              <Campo key={c.clave} etiqueta={c.etiqueta} htmlFor={c.clave} ayuda={c.ayuda}>
                {c.tipo === "texto" ? (
                  <Input id={c.clave} value={v[c.clave] ?? ""} onChange={(e) => setV({ ...v, [c.clave]: e.target.value })} />
                ) : (
                  <Textarea id={c.clave} rows={c.tipo === "parrafo" ? 2 : 6} value={v[c.clave] ?? ""} onChange={(e) => setV({ ...v, [c.clave]: e.target.value })} />
                )}
              </Campo>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="sticky bottom-0 space-y-2 border-t bg-background/95 py-3">
        {res && <Aviso tipo={res.ok ? "exito" : "error"}>{res.mensaje}</Aviso>}
        <Button
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true);
            setRes(null);
            setRes(await accionGuardarLanding(idioma, v));
            setOcupado(false);
          }}
        >
          Guardar textos ({idioma.toUpperCase()})
        </Button>
      </div>
    </div>
  );
}
