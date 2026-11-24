import { and, eq } from "drizzle-orm";
import { organizacionModulos, organizaciones } from "@/core/db/schema";
import { logoParaCorreo } from "@/core/marca/servidor";
import { enviarCorreo } from "@/lib/correo";
import { dbAdmin, withAdmin, withOrg } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha, hoyEnZona, sumarDias } from "@/lib/fechas";
import { clientes, cuotas, planesPago, recordatoriosEnviados } from "@/modules/cobros/schema";
import { enlaceVigenteDePlan, urlPortal } from "./enlaces";
import { montoAPagar } from "./pagos";
import { idsPlanesActivos, recalcularMoraLote } from "./planes";
import { actualizarTipoCambio } from "./tipo-cambio";

/** Organizaciones activas con el módulo cobros encendido. */
export async function organizacionesConCobros() {
  return dbAdmin()
    .select({ id: organizaciones.id, nombre: organizaciones.nombre, zona: organizaciones.zonaHoraria })
    .from(organizaciones)
    .innerJoin(organizacionModulos, and(eq(organizacionModulos.organizacionId, organizaciones.id), eq(organizacionModulos.modulo, "cobros"), eq(organizacionModulos.activo, true)))
    .where(eq(organizaciones.suspendida, false));
}

export type ResumenJob = { organizacion: string; planes: number; cambiosEstado: number; recargos: number; correos: number };

/**
 * Job diario (07:00 America/La_Paz): recalcula estados y recargos de todos los planes y envía correos
 * 3 días antes y el día del vencimiento. Idempotente: si corre dos veces el mismo día no duplica nada.
 */
export async function jobMoraYRecordatorios(ahora = new Date(), soloOrganizacion?: string): Promise<ResumenJob[]> {
  const orgs = (await organizacionesConCobros()).filter((o) => !soloOrganizacion || o.id === soloOrganizacion);
  const resumen: ResumenJob[] = [];
  for (const o of orgs) {
    const hoy = hoyEnZona(o.zona, ahora);
    const r: ResumenJob = { organizacion: o.nombre, planes: 0, cambiosEstado: 0, recargos: 0, correos: 0 };
    // 1) Mora y recargos: una transacción corta por organización, por lotes (sin N+1).
    await withOrg(o.id, async (tx) => {
      const resultados = await recalcularMoraLote(tx, await idsPlanesActivos(tx), hoy, o.zona);
      for (const m of resultados.values()) {
        r.planes++;
        if (m.estadoMora !== m.estadoAnterior) r.cambiosEstado++;
        r.recargos += m.recargosAgregados;
      }
    });
    // 2) Correos FUERA de esa transacción: no se bloquean filas mientras se espera al proveedor de correo.
    r.correos = await enviarRecordatoriosPorCorreo(o.id, o.nombre, hoy);
    resumen.push(r);
  }
  return resumen;
}

async function enviarRecordatoriosPorCorreo(organizacionId: string, nombreOrg: string, hoy: string) {
  const objetivos = [
    { tipo: "faltan_3_dias" as const, fecha: sumarDias(hoy, 3) },
    { tipo: "vence_hoy" as const, fecha: hoy },
  ];
  let enviados = 0;
  // Logo de la organización en PNG (los clientes de correo no siempre muestran SVG)
  const logo = await logoParaCorreo(organizacionId);
  const cabecera = logo ? `<p><img src="${logo.url}" alt="${escapar(logo.alt)}" width="240" style="display:block;max-width:240px;height:auto;border:0"></p>` : "";
  for (const obj of objetivos) {
    const filas = await withOrg(organizacionId, (tx) =>
      tx
        .select({ cuota: cuotas, plan: planesPago, cliente: clientes })
        .from(cuotas)
        .innerJoin(planesPago, eq(planesPago.id, cuotas.planId))
        .innerJoin(clientes, eq(clientes.id, planesPago.clienteId))
        .where(and(eq(cuotas.estado, "pendiente"), eq(cuotas.fechaVencimiento, obj.fecha), eq(planesPago.estado, "activo"))),
    );
    for (const f of filas) {
      if (!f.cliente.correo) continue;
      // Reserva idempotente en su propia transacción corta, confirmada ANTES de enviar: solo envía quien la logra.
      const reserva = await withOrg(organizacionId, async (tx) => {
        const [nuevo] = await tx
          .insert(recordatoriosEnviados)
          .values({ organizacionId, cuotaId: f.cuota.id, tipo: obj.tipo, fecha: hoy })
          .onConflictDoNothing()
          .returning({ id: recordatoriosEnviados.id });
        if (!nuevo) return null;
        return { id: nuevo.id, enlace: await enlaceVigenteDePlan(tx, f.plan.id), monto: await montoAPagar(tx, f.cuota.id, hoy).catch(() => null) };
      });
      if (!reserva) continue;
      const { enlace, monto } = reserva;
      const montoTxt = monto ? formatoMoneda(monto.montoCentavos, f.plan.moneda) : formatoMoneda(f.cuota.montoCentavos, f.plan.moneda);
      const cuando = obj.tipo === "vence_hoy" ? "vence hoy" : `vence el ${formatoFecha(f.cuota.fechaVencimiento)}`;
      const link = enlace?.token ? urlPortal(enlace.token) : null;
      try {
        await enviarCorreo({
          para: f.cliente.correo,
          asunto: `${nombreOrg}: tu cuota ${f.cuota.numero} ${cuando}`,
          html: `${cabecera}<p>Hola ${escapar(f.cliente.nombre)},</p><p>Tu cuota ${f.cuota.numero} de <strong>${montoTxt}</strong> (${escapar(f.plan.titulo)}) ${cuando}.</p>${link ? `<p>Puedes pagar con QR aquí: <a href="${link}">${link}</a></p>` : ""}<p>${escapar(nombreOrg)}</p>`,
          texto: `Tu cuota ${f.cuota.numero} de ${montoTxt} ${cuando}.${link ? ` Paga aquí: ${link}` : ""}`,
        });
        enviados++;
      } catch (e) {
        // Si el envío falla se libera la reserva: el próximo job lo reintenta, sin duplicar los que sí salieron.
        console.error(`[job] no se pudo enviar el recordatorio de la cuota ${f.cuota.id}`, e);
        await withOrg(organizacionId, (tx) => tx.delete(recordatoriosEnviados).where(eq(recordatoriosEnviados.id, reserva.id)));
      }
    }
  }
  return enviados;
}

/** Job diario (08:00): tipo de cambio BRL→BOB del BCB. */
export async function jobTipoCambio(ahora = new Date(), obtenerHtml?: () => Promise<string>) {
  const hoy = hoyEnZona("America/La_Paz", ahora);
  return withAdmin((tx) => actualizarTipoCambio(tx, hoy, obtenerHtml));
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
