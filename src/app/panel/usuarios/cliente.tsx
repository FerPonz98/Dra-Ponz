"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select } from "@/components/ui/input";
import { notificar } from "@/components/ui/toaster";
import { Avatar } from "@/components/ui/varios";
import { accionActualizarUsuario, accionCrearUsuario, accionGuardarRol } from "./acciones";

type Rol = { id: string; nombre: string; permisos: string[]; esAdmin: boolean };
type Res = { ok: boolean; mensaje?: string } | null;

export function TablaUsuarios({ usuarios, roles }: { usuarios: { id: string; nombre: string; correo: string; activo: boolean; rolId: string | null; yo: boolean }[]; roles: Rol[] }) {
  const router = useRouter();
  const correr = async (p: Promise<Res>) => {
    const r = await p;
    notificar(r);
    if (r?.ok) router.refresh();
  };
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border">
        {usuarios.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-3">
              <Avatar nombre={u.nombre} />
              <span className="min-w-0">
              <strong className="font-medium">{u.nombre}</strong> {u.yo && <Badge variant="secondary">tú</Badge>} {!u.activo && <Badge variant="peligro">inactivo</Badge>}
              <span className="block truncate text-muted-foreground">{u.correo}</span>
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Select aria-label={`Rol de ${u.nombre}`} className="w-44" value={u.rolId ?? ""} disabled={u.yo} onChange={(e) => correr(accionActualizarUsuario(u.id, { rolId: e.target.value }))}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </Select>
              {!u.yo && (
                <Button size="sm" variant="outline" onClick={() => correr(accionActualizarUsuario(u.id, { activo: !u.activo }))}>
                  {u.activo ? "Desactivar" : "Activar"}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NuevoUsuario({ roles }: { roles: Rol[] }) {
  const router = useRouter();
  const [d, setD] = useState({ nombre: "", correo: "", contrasena: "", rolId: roles.find((r) => !r.esAdmin)?.id ?? roles[0]?.id ?? "" });
  return (
    <div className="space-y-4 rounded-xl border border-dashed border-border-strong p-4">
      <h3 className="font-medium">Nuevo usuario</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta="Nombre" htmlFor="u-nombre">
          <Input id="u-nombre" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
        </Campo>
        <Campo etiqueta="Correo" htmlFor="u-correo">
          <Input id="u-correo" type="email" value={d.correo} onChange={(e) => setD({ ...d, correo: e.target.value })} />
        </Campo>
        <Campo etiqueta="Contraseña inicial" htmlFor="u-clave" ayuda="Mínimo 8 caracteres. Puede cambiarla con «¿Olvidaste tu contraseña?».">
          <Input id="u-clave" type="password" value={d.contrasena} onChange={(e) => setD({ ...d, contrasena: e.target.value })} />
        </Campo>
        <Campo etiqueta="Rol" htmlFor="u-rol">
          <Select id="u-rol" value={d.rolId} onChange={(e) => setD({ ...d, rolId: e.target.value })}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Button
        onClick={async () => {
          const r = await accionCrearUsuario(d);
          notificar(r);
          if (r.ok) {
            setD({ ...d, nombre: "", correo: "", contrasena: "" });
            router.refresh();
          }
        }}
      >
        Crear usuario
      </Button>
    </div>
  );
}

export function EditorRoles({ roles, permisos }: { roles: Rol[]; permisos: { codigo: string; etiqueta: string }[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(roles.map((r) => ({ ...r })));
  const [nuevo, setNuevo] = useState("");
  const alternar = (i: number, p: string) =>
    setLista((x) => x.map((r, j) => (j === i ? { ...r, permisos: r.permisos.includes(p) ? r.permisos.filter((y) => y !== p) : [...r.permisos, p] } : r)));
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="bg-surface-2">
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Permiso</th>
              {lista.map((r) => (
                <th key={r.id} className="p-3 text-center text-xs font-medium text-muted-foreground">
                  {r.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permisos.map((p) => (
              <tr key={p.codigo} className="border-t border-border">
                <td className="p-3">{p.etiqueta}</td>
                {lista.map((r, i) => (
                  <td key={r.id} className="p-3 text-center">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" aria-label={`${r.nombre}: ${p.etiqueta}`} disabled={r.esAdmin} checked={r.esAdmin || r.permisos.includes(p.codigo)} onChange={() => alternar(i, p.codigo)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        {lista
          .filter((r) => !r.esAdmin)
          .map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant="outline"
              onClick={async () => {
                const x = await accionGuardarRol({ nombre: r.nombre, permisos: r.permisos }, r.id);
                notificar(x);
                if (x.ok) router.refresh();
              }}
            >
              Guardar «{r.nombre}»
            </Button>
          ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <Campo etiqueta="Nuevo rol" htmlFor="r-nuevo">
          <Input id="r-nuevo" value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Ej. Secretaria" />
        </Campo>
        <Button
          onClick={async () => {
            const x = await accionGuardarRol({ nombre: nuevo, permisos: [] });
            notificar(x);
            if (x.ok) {
              setNuevo("");
              router.refresh();
            }
          }}
        >
          Crear rol
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">El rol Administrador siempre tiene todos los permisos. Los permisos de un módulo desactivado no tienen efecto.</p>
    </div>
  );
}
