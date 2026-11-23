import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { organizaciones } from "@/core/db/schema";
import { dbAdmin, withOrg, type Ejecutor } from "@/lib/db";
import { aplicarIntento, estaBloqueado, generarPin, generarToken, hashPin, verificarCredencial } from "@/modules/cobros/dominio/portal";
import { enlacesPortal, planesPago } from "@/modules/cobros/schema";
import { clientes } from "@/modules/cobros/schema";

export type Enlace = typeof enlacesPortal.$inferSelect;

/** Crea un enlace único (token largo aleatorio) protegido con el CI del cliente o un PIN. */
export async function crearEnlace(
  tx: Ejecutor,
  d: { organizacionId: string; planId: string; metodo: "ci" | "pin"; expiraEn?: Date | null; referenciaTipo?: string | null; referenciaId?: string | null; anularAnteriores?: boolean },
) {
  const [plan] = await tx.select({ clienteId: planesPago.clienteId }).from(planesPago).where(eq(planesPago.id, d.planId));
  if (!plan) throw new Error("Plan no encontrado");
  let ci: string | null = null;
  let pin: string | null = null;
  if (d.metodo === "ci") {
    const [c] = await tx.select({ ci: clientes.ci }).from(clientes).where(eq(clientes.id, plan.clienteId));
    if (!c?.ci) throw new Error("El cliente no tiene CI registrado. Agrega su CI o usa un PIN.");
    ci = c.ci;
  } else pin = generarPin(6);
  if (d.anularAnteriores !== false) await anularEnlacesDePlan(tx, d.planId);
  const token = generarToken();
  const [e] = await tx
    .insert(enlacesPortal)
    .values({
      organizacionId: d.organizacionId,
      planId: d.planId,
      token,
      metodo: d.metodo,
      ci,
      pinHash: pin ? hashPin(pin) : null,
      expiraEn: d.expiraEn ?? null,
      referenciaTipo: d.referenciaTipo ?? null,
      referenciaId: d.referenciaId ?? null,
    })
    .returning();
  return { enlace: e, token, pin };
}

/** Destruye el token (queda null) para que el enlace deje de funcionar. */
export async function anularEnlace(tx: Ejecutor, enlaceId: string) {
  await tx.update(enlacesPortal).set({ token: null, anuladoEn: new Date() }).where(eq(enlacesPortal.id, enlaceId));
}

export async function anularEnlacesDePlan(tx: Ejecutor, planId: string) {
  await tx.update(enlacesPortal).set({ token: null, anuladoEn: new Date() }).where(and(eq(enlacesPortal.planId, planId), isNotNull(enlacesPortal.token)));
}

export async function enlaceVigenteDePlan(tx: Ejecutor, planId: string) {
  const [e] = await tx
    .select()
    .from(enlacesPortal)
    .where(and(eq(enlacesPortal.planId, planId), isNotNull(enlacesPortal.token), isNull(enlacesPortal.anuladoEn)))
    .limit(1);
  return e ?? null;
}

export function urlPortal(token: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/p/${token}`;
}

export type EnlaceResuelto = { enlace: Enlace; organizacion: typeof organizaciones.$inferSelect };

/**
 * Busca un enlace por token (con el rol dueño, porque aún no se conoce la organización).
 * Devuelve null si no existe, fue anulado, venció o la organización está suspendida.
 */
export async function resolverToken(token: string, ahora = new Date()): Promise<EnlaceResuelto | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const db = dbAdmin();
  const [fila] = await db
    .select({ enlace: enlacesPortal, organizacion: organizaciones })
    .from(enlacesPortal)
    .innerJoin(organizaciones, eq(organizaciones.id, enlacesPortal.organizacionId))
    .where(eq(enlacesPortal.token, token));
  if (!fila || fila.enlace.anuladoEn || fila.organizacion.suspendida) return null;
  if (fila.enlace.expiraEn && fila.enlace.expiraEn <= ahora) return null;
  return fila;
}

export type ResultadoAcceso = { ok: true } | { ok: false; bloqueado: boolean; restantes: number; hasta?: Date };

/** Verifica CI/PIN con bloqueo: 5 intentos fallidos → 15 minutos bloqueado. */
export async function intentarAcceso(r: EnlaceResuelto, valor: string, ahora = new Date()): Promise<ResultadoAcceso> {
  return withOrg(r.organizacion.id, async (tx) => {
    const [e] = await tx.select().from(enlacesPortal).where(eq(enlacesPortal.id, r.enlace.id)).for("update");
    if (!e) return { ok: false, bloqueado: false, restantes: 0 };
    if (estaBloqueado(e, ahora)) return { ok: false, bloqueado: true, restantes: 0, hasta: e.bloqueadoHasta! };
    const exito = verificarCredencial(e, valor);
    const nuevo = aplicarIntento(e, exito, ahora);
    await tx
      .update(enlacesPortal)
      .set({ intentosFallidos: nuevo.intentosFallidos, bloqueadoHasta: nuevo.bloqueadoHasta, ...(exito ? { ultimoAccesoEn: ahora } : {}) })
      .where(eq(enlacesPortal.id, e.id));
    if (exito) return { ok: true };
    const bloqueado = estaBloqueado(nuevo, ahora);
    return { ok: false, bloqueado, restantes: bloqueado ? 0 : 5 - nuevo.intentosFallidos, hasta: nuevo.bloqueadoHasta ?? undefined };
  });
}
