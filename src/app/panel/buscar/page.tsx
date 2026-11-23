import { GraduationCap, SearchX, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requerirOrganizacion } from "@/core/contexto";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EncabezadoPagina, EstadoVacio } from "@/components/ui/varios";
import { withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { BadgeMora } from "@/modules/cobros/componentes/estado";
import { listarClientes } from "@/modules/cobros/servicios/clientes";
import { listarPlanes } from "@/modules/cobros/servicios/planes";
import { BadgeEstadoProyecto } from "@/modules/tesis/componentes/estado";
import { listarPropuestas } from "@/modules/tesis/servicios/propuestas";

export const metadata: Metadata = { title: "Buscar" };

export default async function BuscarPage(props: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requerirOrganizacion();
  const q = ((await props.searchParams).q ?? "").trim().slice(0, 100);
  const t = q.toLowerCase();
  const cobros = ctx.modulos.includes("cobros") && ctx.puede("cobros:ver");
  const tesis = ctx.modulos.includes("tesis") && ctx.puede("tesis:ver");
  const r = q
    ? await withOrg(ctx.organizacion.id, async (tx) => ({
        clientes: cobros ? (await listarClientes(tx, q)).slice(0, 20) : [],
        planes: cobros ? (await listarPlanes(tx)).filter((p) => `${p.plan.titulo} ${p.cliente.nombre}`.toLowerCase().includes(t)).slice(0, 20) : [],
        propuestas: tesis ? (await listarPropuestas(tx)).filter((p) => `${p.propuesta.titulo} ${p.cliente.nombre} ${p.propuesta.universidad ?? ""}`.toLowerCase().includes(t)).slice(0, 20) : [],
      }))
    : { clientes: [], planes: [], propuestas: [] };
  const total = r.clientes.length + r.planes.length + r.propuestas.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <EncabezadoPagina titulo={q ? `Resultados para «${q}»` : "Buscar"} descripcion={q ? `${total} ${total === 1 ? "resultado" : "resultados"}` : "Escribe en el buscador de arriba: clientes, planes o proyectos."} />
      {q && total === 0 && (
        <Card>
          <EstadoVacio icono={SearchX} titulo="Sin resultados" descripcion="Prueba con otro nombre, CI o parte del concepto." />
        </Card>
      )}
      {r.clientes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden /> Clientes
            </CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border border-t border-border">
            {r.clientes.map((c) => (
              <li key={c.id}>
                <Link href={`/panel/cobros/clientes/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                  <Avatar nombre={c.nombre} className="size-8" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.nombre}</span>
                    <span className="text-xs text-muted-foreground">{[c.ci && `CI ${c.ci}`, c.whatsapp && `+${c.whatsapp}`].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {r.planes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" aria-hidden /> Planes de pago
            </CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border border-t border-border">
            {r.planes.map((p) => (
              <li key={p.plan.id}>
                <Link href={`/panel/cobros/planes/${p.plan.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.plan.titulo}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.cliente.nombre} · {formatoMoneda(p.total, p.plan.moneda)}
                    </span>
                  </span>
                  <BadgeMora estado={p.plan.estadoMora} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {r.propuestas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-4 text-muted-foreground" aria-hidden /> Proyectos de tesis
            </CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border border-t border-border">
            {r.propuestas.map(({ propuesta: p, cliente }) => (
              <li key={p.id}>
                <Link href={`/panel/tesis/propuestas/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.titulo}</span>
                    <span className="text-xs text-muted-foreground">{cliente.nombre}</span>
                  </span>
                  <BadgeEstadoProyecto estado={p.estado} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
