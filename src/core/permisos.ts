import type { CodigoModulo } from "@/core/db/schema";

/** Catálogo de permisos "modulo:accion". Los roles de cada organización eligen de esta lista. */
export const CATALOGO_PERMISOS = [
  { codigo: "organizacion:configurar", modulo: null, etiqueta: "Configurar la organización" },
  { codigo: "usuarios:gestionar", modulo: null, etiqueta: "Gestionar usuarios y roles" },
  { codigo: "cobros:ver", modulo: "cobros", etiqueta: "Ver cobros" },
  { codigo: "cobros:editar", modulo: "cobros", etiqueta: "Crear y editar clientes y planes" },
  { codigo: "cobros:aprobar", modulo: "cobros", etiqueta: "Aprobar o rechazar pagos" },
  { codigo: "tesis:ver", modulo: "tesis", etiqueta: "Ver proyectos de tesis" },
  { codigo: "tesis:editar", modulo: "tesis", etiqueta: "Crear y editar propuestas, formularios y landing" },
] as const satisfies readonly { codigo: string; modulo: CodigoModulo | null; etiqueta: string }[];

export type Permiso = (typeof CATALOGO_PERMISOS)[number]["codigo"];
export const TODOS_LOS_PERMISOS: Permiso[] = CATALOGO_PERMISOS.map((p) => p.codigo);

export function moduloDePermiso(p: Permiso): CodigoModulo | null {
  return CATALOGO_PERMISOS.find((x) => x.codigo === p)?.modulo ?? null;
}

/** Permisos efectivos: los del rol, filtrados por módulos activos. El admin recibe todos. */
export function permisosEfectivos(rol: { permisos: string[]; esAdmin: boolean } | null, modulosActivos: CodigoModulo[]): Permiso[] {
  if (!rol) return [];
  const base = rol.esAdmin ? TODOS_LOS_PERMISOS : (rol.permisos.filter((p) => (TODOS_LOS_PERMISOS as string[]).includes(p)) as Permiso[]);
  return base.filter((p) => {
    const m = moduloDePermiso(p);
    return m === null || modulosActivos.includes(m);
  });
}
