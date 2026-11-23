import { and, asc, eq, ilike, or } from "drizzle-orm";
import type { Ejecutor } from "@/lib/db";
import { clientes } from "@/modules/cobros/schema";

export { esquemaCliente, type DatosCliente } from "./clientes-esquema";
import { esquemaCliente, type DatosCliente } from "./clientes-esquema";

export type Cliente = typeof clientes.$inferSelect;

export async function listarClientes(tx: Ejecutor, buscar?: string) {
  const q = buscar?.trim();
  const filtro = q ? or(ilike(clientes.nombre, `%${q}%`), ilike(clientes.ci, `%${q}%`), ilike(clientes.whatsapp, `%${q}%`), ilike(clientes.correo, `%${q}%`)) : undefined;
  return tx.select().from(clientes).where(filtro).orderBy(asc(clientes.nombre)).limit(500);
}

export async function obtenerCliente(tx: Ejecutor, id: string) {
  const [c] = await tx.select().from(clientes).where(eq(clientes.id, id));
  return c ?? null;
}

const vacioANull = (v: string | undefined) => (v ? v : null);

export async function crearCliente(tx: Ejecutor, organizacionId: string, datos: DatosCliente) {
  const d = esquemaCliente.parse(datos);
  const [c] = await tx
    .insert(clientes)
    .values({ organizacionId, nombre: d.nombre, ci: vacioANull(d.ci), whatsapp: vacioANull(d.whatsapp), correo: vacioANull(d.correo?.toLowerCase()), notas: vacioANull(d.notas) })
    .returning();
  return c;
}

export async function actualizarCliente(tx: Ejecutor, id: string, datos: DatosCliente) {
  const d = esquemaCliente.parse(datos);
  const [c] = await tx
    .update(clientes)
    .set({ nombre: d.nombre, ci: vacioANull(d.ci), whatsapp: vacioANull(d.whatsapp), correo: vacioANull(d.correo?.toLowerCase()), notas: vacioANull(d.notas) })
    .where(and(eq(clientes.id, id)))
    .returning();
  if (!c) throw new Error("Cliente no encontrado");
  return c;
}
