import type { Moneda } from "@/modules/cobros/schema";

export const URL_BCB = "https://www.bcb.gob.bo/librerias/indicadores/otras/ultimo.php";

const MESES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

/**
 * Lee la tabla del BCB y devuelve la cotización BRL→BOB (Bs por 1 real) y su fecha.
 * Formato: fila con <td>BRL</td> seguida de <td class="numero">1.97798</td>.
 */
export function parsearBcb(html: string): { fecha: string | null; valor: number } {
  const fila = html.match(/<td[^>]*>\s*BRL\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>/i);
  if (!fila) throw new Error("No se encontró la fila BRL en la página del BCB");
  const valor = Number(fila[1].replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100) throw new Error(`Cotización BRL inválida: ${fila[1]}`);
  const f = html.match(/COTIZACI(?:&Oacute;|Ó|O)N:(?:&nbsp;|\s)*(\d{1,2}) de (\w+) (?:de )?(\d{4})/i);
  const mes = f ? MESES[f[2].toLowerCase()] : undefined;
  const fecha = f && mes ? `${f[3]}-${mes}-${f[1].padStart(2, "0")}` : null;
  return { fecha, valor };
}

/** Monto a pagar en Bs. BOB queda igual; BRL se multiplica por la cotización del día. */
export function convertirABob(montoCentavos: number, moneda: Moneda, tipoCambio: number | null): number {
  if (moneda === "BOB") return montoCentavos;
  if (!tipoCambio || tipoCambio <= 0) throw new Error("No hay cotización BRL→BOB disponible");
  return Math.round(montoCentavos * tipoCambio);
}

export type Cotizacion = { fecha: string; valor: number };

/** Elige la cotización del día; si no existe, la última guardada (y avisa que es un respaldo). */
export function elegirCotizacion(disponibles: Cotizacion[], hoy: string): { cotizacion: Cotizacion | null; esRespaldo: boolean } {
  const previas = disponibles.filter((c) => c.fecha <= hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const delDia = previas.find((c) => c.fecha === hoy);
  if (delDia) return { cotizacion: delDia, esRespaldo: false };
  return { cotizacion: previas[0] ?? null, esRespaldo: previas.length > 0 };
}
