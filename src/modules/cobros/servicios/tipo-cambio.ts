import { desc, eq, lte } from "drizzle-orm";
import { alertasSistema } from "@/core/db/schema";
import type { Ejecutor } from "@/lib/db";
import { elegirCotizacion, parsearBcb, URL_BCB } from "@/modules/cobros/dominio/tipo-cambio";
import { tiposCambio } from "@/modules/cobros/schema";

/** Cotización BRL→BOB para `hoy` o, si falta, la última guardada. */
export async function cotizacionBrl(tx: Ejecutor, hoy: string) {
  const filas = await tx.select().from(tiposCambio).where(lte(tiposCambio.fecha, hoy)).orderBy(desc(tiposCambio.fecha)).limit(10);
  const brl = filas.filter((f) => f.moneda === "BRL").map((f) => ({ fecha: f.fecha, valor: Number(f.valor) }));
  return elegirCotizacion(brl, hoy);
}

export async function ultimasCotizaciones(tx: Ejecutor, n = 7) {
  return tx.select().from(tiposCambio).where(eq(tiposCambio.moneda, "BRL")).orderBy(desc(tiposCambio.fecha)).limit(n);
}

/**
 * Job diario: lee el BCB y guarda la cotización del día. Si falla, registra una alerta y se seguirá
 * usando la última cotización guardada. `obtenerHtml` se inyecta para poder probarlo sin red.
 */
export async function actualizarTipoCambio(tx: Ejecutor, hoy: string, obtenerHtml: () => Promise<string> = descargarBcb) {
  try {
    const { valor } = parsearBcb(await obtenerHtml());
    // Se guarda con la fecha del día del job: es la cotización vigente para los pagos de hoy.
    await tx
      .insert(tiposCambio)
      .values({ fecha: hoy, moneda: "BRL", valor: valor.toFixed(5), fuente: "BCB" })
      .onConflictDoUpdate({ target: [tiposCambio.fecha, tiposCambio.moneda], set: { valor: valor.toFixed(5), fuente: "BCB" } });
    await tx.update(alertasSistema).set({ resuelta: true }).where(eq(alertasSistema.tipo, "tipo_cambio"));
    return { ok: true as const, valor };
  } catch (e) {
    const mensaje = `No se pudo leer el tipo de cambio del BCB (${hoy}): ${e instanceof Error ? e.message : String(e)}. Se usa la última cotización guardada.`;
    await tx.insert(alertasSistema).values({ tipo: "tipo_cambio", mensaje });
    return { ok: false as const, mensaje };
  }
}

async function descargarBcb(): Promise<string> {
  const r = await fetch(URL_BCB, { headers: { "User-Agent": "Mozilla/5.0 (cobros; tipo-cambio)" }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

export async function alertasActivas(tx: Ejecutor) {
  return tx.select().from(alertasSistema).where(eq(alertasSistema.resuelta, false)).orderBy(desc(alertasSistema.creadoEn)).limit(5);
}
