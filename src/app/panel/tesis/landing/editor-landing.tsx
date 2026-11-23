"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Save } from "lucide-react";
import { Campo, Input, Textarea } from "@/components/ui/input";
import { notificar } from "@/components/ui/toaster";
import type { DefSeccion } from "@/modules/tesis/dominio/landing";
import { accionGuardarLanding } from "./acciones";

export function EditorLanding({ idioma, secciones, valores }: { idioma: "es" | "pt"; secciones: DefSeccion[]; valores: Record<string, string> }) {
  const [v, setV] = useState(valores);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Idioma" className="inline-flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
          {(["es", "pt"] as const).map((l) => (
            <Button key={l} asChild size="sm" variant={l === idioma ? "outline" : "ghost"} className={l === idioma ? "shadow-xs" : "text-muted-foreground"}>
              <Link href={`/panel/tesis/landing?idioma=${l}`} aria-current={l === idioma ? "page" : undefined}>
                {l === "es" ? "Español" : "Português"}
              </Link>
            </Button>
          ))}
        </nav>
        <Button asChild size="sm" variant="ghost">
          <a href={`/${idioma}`} target="_blank" rel="noopener">
            Ver la página <ExternalLink />
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
      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 p-3 shadow-md backdrop-blur lg:bottom-4">
        <p className="text-xs text-muted-foreground">Los cambios se publican al guardar.</p>
        <Button
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true);
            notificar(await accionGuardarLanding(idioma, v));
            setOcupado(false);
          }}
        >
          <Save /> Guardar textos ({idioma.toUpperCase()})
        </Button>
      </div>
    </div>
  );
}
