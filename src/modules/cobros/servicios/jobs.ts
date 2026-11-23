import { and, eq } from "drizzle-orm";
import { organizacionModulos, organizaciones } from "@/core/db/schema";
import { enviarCorreo } from "@/lib/correo";
import { dbAdmin, withAdmin, withOrg, type Ejecutor } from "@/lib/db";
import { formatoMoneda } from "@/lib/dinero";
import { formatoFecha, hoyEnZona, sumarDias } from "@/lib/fechas";
import { clientes, cuotas, planesPago, recordatoriosEnviados } from "@/modules/cobros/schema";
import { enlaceVigenteDePlan, urlPortal } from "./enlaces";
import { montoAPagar } from "./pagos";
import { idsPlanesActivos, recalcularMora } from "./planes";
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
    await withOrg(o.id, async (tx) => {
      for (const id of await idsPlanesActivos(tx)) {
        const m = await recalcularMora(tx, id, hoy, o.zona);
        r.planes++;
        if (m && m.estadoMora !== m.estadoAnterior) r.cambiosEstado++;
        r.recargos += m?.recargosAgregados ?? 0;
      }
      r.correos = await enviarRecordatoriosPorCorreo(tx, o.id, o.nombre, hoy);
    });
    resumen.push(r);
  }
  return resumen;
}

async function enviarRecordatoriosPorCorreo(tx: Ejecutor, organizacionId: string, nombreOrg: string, hoy: string) {
  const objetivos = [
    { tipo: "faltan_3_dias" as const, fecha: sumarDias(hoy, 3) },
    { tipo: "vence_hoy" as const, fecha: hoy },
  ];
  let enviados = 0;
  for (const obj of objetivos) {
    const filas = await tx
      .select({ cuota: cuotas, plan: planesPago, cliente: clientes })
      .from(cuotas)
      .innerJoin(planesPago, eq(planesPago.id, cuotas.planId))
      .innerJoin(clientes, eq(clientes.id, planesPago.clienteId))
      .where(and(eq(cuotas.estado, "pendiente"), eq(cuotas.fechaVencimiento, obj.fecha), eq(planesPago.estado, "activo")));
    for (const f of filas) {
      if (!f.cliente.correo) continue;
      // Reserva idempotente: solo envía quien logra insertar el registro.
      const [nuevo] = await tx
        .insert(recordatoriosEnviados)
        .values({ organizacionId, cuotaId: f.cuota.id, tipo: obj.tipo, fecha: hoy })
        .onConflictDoNothing()
        .returning({ id: recordatoriosEnviados.id });
      if (!nuevo) continue;
      const enlace = await enlaceVigenteDePlan(tx, f.plan.id);
      const monto = await montoAPagar(tx, f.cuota.id, hoy).catch(() => null);
      const montoTxt = monto ? formatoMoneda(monto.montoCentavos, f.plan.moneda) : formatoMoneda(f.cuota.montoCentavos, f.plan.moneda);
      const cuando = obj.tipo === "vence_hoy" ? "vence hoy" : `vence el ${formatoFecha(f.cuota.fechaVencimiento)}`;
      const link = enlace?.token ? urlPortal(enlace.token) : null;
      await enviarCorreo({
        para: f.cliente.correo,
        asunto: `${nombreOrg}: tu cuota ${f.cuota.numero} ${cuando}`,
        html: `<p>Hola ${escapar(f.cliente.nombre)},</p><p>Tu cuota ${f.cuota.numero} de <strong>${montoTxt}</strong> (${escapar(f.plan.titulo)}) ${cuando}.</p>${link ? `<p>Puedes pagar con QR aquí: <a href="${link}">${link}</a></p>` : ""}<p>${escapar(nombreOrg)}</p>`,
        texto: `Tu cuota ${f.cuota.numero} de ${montoTxt} ${cuando}.${link ? ` Paga aquí: ${link}` : ""}`,
      });
      enviados++;
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
