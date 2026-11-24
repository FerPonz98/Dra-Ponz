import "server-only";
import { cache } from "react";
import { withOrg } from "@/lib/db";
import { temaGuardado } from "./servicio";
import type { Tema } from "./tema";

/**
 * Tema guardado de la organización (o null). Se lee de la BD en cada petición (una fila, < 1 ms) y se
 * deduplica dentro de la misma petición con cache() de React. Sin caché entre peticiones a propósito:
 * con PM2 en cluster cada proceso tendría su propia copia y, al guardar, solo uno se enteraría.
 */
export const temaDeOrganizacion = cache((organizacionId: string): Promise<Tema | null> => withOrg(organizacionId, temaGuardado));
