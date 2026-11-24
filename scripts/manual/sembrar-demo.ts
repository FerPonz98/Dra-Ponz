// Datos de DEMOSTRACIÓN para las capturas del manual (base cobra_app_demo). Todos los nombres, CI, teléfonos,
// correos y montos son ficticios. Usa los mismos servicios que la app (no inserta a mano lo que la app calcula):
// planes, propuestas, enlaces, pagos, mora, formularios y archivos. Lo corre scripts/manual/capturas.ts.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { organizaciones, roles, usuarios } from "@/core/db/schema";
import { guardarArchivo } from "@/core/archivos";
import { crearUsuarioDeOrganizacion } from "@/core/servicios";
import { cerrarPools, dbAdmin, withAdmin, withOrg, type Tx } from "@/lib/db";
import { hoyEnZona, sumarDias } from "@/lib/fechas";
import { cuotas, enlacesPortal, pagos, planesPago, tiposCambio } from "@/modules/cobros/schema";
import { crearCliente } from "@/modules/cobros/servicios/clientes";
import { crearEnlace } from "@/modules/cobros/servicios/enlaces";
import { aprobarPago, registrarPago } from "@/modules/cobros/servicios/pagos";
import { crearPlan, recalcularMora, type Actor } from "@/modules/cobros/servicios/planes";
import type { ReglasMora } from "@/modules/cobros/dominio/plan";
import { plantillaCronograma } from "@/modules/tesis/dominio/cronograma";
import { guardarFormulario, guardarRespuestas, obtenerFormulario, subirArchivosEstudiante } from "@/modules/tesis/servicios/formularios";
import {
  aceptarPropuesta,
  cambiarEstadoManual,
  enviarPropuesta,
  guardarNotas,
  guardarPropuesta,
  marcarRevision,
  solicitarExtra,
  solicitarTerceraRevision,
  sincronizarProyecto,
  vencerPropuestas,
} from "@/modules/tesis/servicios/propuestas";
import { propuestaExtras, revisiones } from "@/modules/tesis/schema";
import { CARPETA_RECURSOS, generarRecursos } from "./recursos";

const hoy = hoyEnZona();
const d = (n: number) => sumarDias(hoy, n);
/** Instante a las 10:00 de La Paz del día hoy+n. */
const inst = (n: number, hora = 14) => new Date(`${d(n)}T${String(hora).padStart(2, "0")}:00:00Z`);
const archivo = (ruta: string, nombre: string, tipo: string) => new File([readFileSync(ruta)], nombre, { type: tipo });
const comprobantePng = () => archivo(join(CARPETA_RECURSOS, "comprobante-demo.png"), "comprobante.png", "image/png");
const comprobantePdf = () => archivo("tests/fixtures/comprobante.pdf", "comprobante-transferencia.pdf", "application/pdf");

const REGLAS: ReglasMora = { plazoPrimeraCuotaDias: null, diasGracia: 5, recargoActivo: true, recargoPorcentaje: 5, recargoModo: "unico", diasGraciaNuevaMora: 10 };

type Estudiante = { nombre: string; ci: string; whatsapp: string; correo: string };
type DefProyecto = {
  estudiante: Estudiante;
  titulo: string;
  universidad: string;
  nivel: "pregrado" | "posgrado";
  moneda?: "BOB" | "BRL";
  cuotas: [number, number][]; // [días desde hoy, monto en unidades]
  inicio: number; // días desde hoy
  hechas?: number; // cuántas actividades (en orden) están hechas
  formularioId?: string | null;
  vigencia?: number;
};

async function main() {
  await generarRecursos(new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeZone: "America/La_Paz" }).format(new Date()));
  const db = dbAdmin();
  const [org] = await db.select().from(organizaciones).where(eq(organizaciones.slug, "dra-ponz"));
  if (!org) throw new Error("Falta la organización dra-ponz (corre antes el seed)");
  const [dra] = await db.select().from(usuarios).where(eq(usuarios.organizacionId, org.id));
  const actor: Actor = { organizacionId: org.id, usuarioId: dra.id, usuarioNombre: dra.name };

  // Tipo de cambio de los últimos días (valores de ejemplo cercanos a la cotización oficial).
  await withAdmin(async (tx) => {
    for (let i = 9; i >= 0; i--) {
      const valor = (1.97798 + ((i * 37) % 11) / 10000 - 0.0005).toFixed(5);
      await tx.insert(tiposCambio).values({ fecha: d(-i), moneda: "BRL", valor, fuente: "BCB" }).onConflictDoNothing();
    }
  });

  await withOrg(org.id, async (tx) => {
    // Organización: QR de muestra, datos bancarios y WhatsApp ficticios.
    const qr = await guardarArchivo(tx, { organizacionId: org.id, categoria: "organizacion", archivo: archivo(join(CARPETA_RECURSOS, "qr-demo.png"), "qr-cobro.png", "image/png"), permitidos: ["imagen"] });
    await tx
      .update(organizaciones)
      .set({ qrArchivoId: qr.id, whatsapp: "59171000000", datosBancarios: "Banco de Ejemplo · Caja de ahorro N.º 1000-000000-0\nTitular: cuenta de demostración\nGlosa: tu nombre y el número de cuota" })
      .where(eq(organizaciones.id, org.id));
  });

  // Formulario de recolección de datos
  const formularioId = await withOrg(org.id, (tx) =>
    guardarFormulario(tx, org.id, {
      nombre: "Datos para iniciar tu tesis",
      descripcion: "Completa estos datos para que podamos planificar tu asesoría. Te toma 5 minutos.",
      campos: [
        { tipo: "texto_corto", etiqueta: "Carrera", ayuda: "Ej. Enfermería, Bioquímica, Derecho", obligatorio: true, opciones: [] },
        { tipo: "texto_largo", etiqueta: "¿Qué problema te interesa investigar?", ayuda: "Cuéntalo con tus palabras, en 3 o 4 líneas.", obligatorio: true, opciones: [] },
        { tipo: "fecha", etiqueta: "Fecha límite para defender", ayuda: "", obligatorio: false, opciones: [] },
        { tipo: "seleccion", etiqueta: "Modalidad de las reuniones", ayuda: "", obligatorio: true, opciones: ["Presencial en Cobija", "Virtual (Zoom o Meet)", "Mixta"] },
        { tipo: "archivo", etiqueta: "Perfil o avance (si ya tienes uno)", ayuda: "PDF o Word", obligatorio: false, opciones: [] },
        { tipo: "zip", etiqueta: "Datos recolectados", ayuda: "Fotos, audios o bases de datos comprimidos en un ZIP", obligatorio: false, opciones: [] },
      ],
    }),
  );
  await withOrg(org.id, (tx) =>
    guardarFormulario(tx, org.id, {
      nombre: "Ficha para la defensa",
      descripcion: "Datos para preparar tu sustentación.",
      campos: [
        { tipo: "fecha", etiqueta: "Fecha de la defensa", ayuda: "", obligatorio: true, opciones: [] },
        { tipo: "texto_corto", etiqueta: "Nombres del tribunal", ayuda: "", obligatorio: false, opciones: [] },
        { tipo: "archivo", etiqueta: "Documento final aprobado", ayuda: "", obligatorio: true, opciones: [] },
      ],
    }),
  );

  async function proyecto(tx: Tx, p: DefProyecto) {
    const actividades = plantillaCronograma(5).map((a, i) => ({ ...a, hecha: i < (p.hechas ?? 0) }));
    return guardarPropuesta(tx, actor, {
      estudiante: { nuevo: p.estudiante },
      titulo: p.titulo,
      universidad: p.universidad,
      nivel: p.nivel,
      moneda: p.moneda ?? "BOB",
      cuotas: p.cuotas.map(([dia, monto]) => ({ montoCentavos: monto * 100, fechaVencimiento: d(dia) })),
      cronograma: { fechaInicio: d(p.inicio), meses: 5, actividades },
      reglas: REGLAS,
      precioTerceraRevisionCentavos: 50000,
      extras: [{ nombre: "Diapositivas para la sustentación", precioCentavos: 30000 }],
      formularioId: p.formularioId ?? null,
      vigenciaDias: p.vigencia ?? 7,
    });
  }
  const enlaceDe = async (tx: Tx, planId: string) => (await tx.select().from(enlacesPortal).where(and(eq(enlacesPortal.planId, planId), isNotNull(enlacesPortal.token))))[0];
  /** Paga y aprueba las cuotas indicadas, con fechas de pago realistas (1 día después de cada vencimiento). */
  async function pagar(tx: Tx, planId: string, numeros: number[], aprobar = true) {
    const e = await enlaceDe(tx, planId);
    const lista = await tx.select().from(cuotas).where(eq(cuotas.planId, planId));
    for (const n of numeros) {
      const c = lista.find((x) => x.numero === n)!;
      const pago = await registrarPago(tx, { organizacionId: org.id, planId, cuotaId: c.id, enlaceId: e?.id ?? null, archivo: n % 2 ? comprobantePng() : comprobantePdf(), hoy });
      const dias = Math.round((Date.parse(c.fechaVencimiento) - Date.parse(hoy)) / 86_400_000);
      const cuando = inst(Math.min(dias, 0) - 1, 15);
      await tx.update(pagos).set({ creadoEn: cuando }).where(eq(pagos.id, pago.id));
      if (aprobar) {
        await aprobarPago(tx, actor, pago.id, hoy);
        await tx.update(pagos).set({ revisadoEn: new Date(cuando.getTime() + 3 * 3600_000) }).where(eq(pagos.id, pago.id));
        await tx.update(cuotas).set({ pagadaEn: new Date(cuando.getTime() + 3 * 3600_000) }).where(eq(cuotas.id, c.id));
      }
    }
  }

  await withOrg(org.id, async (tx) => {
    // 1) Mariana: al día, 2 cuotas pagadas, la 3.ª vence en 2 días. Formulario y archivos enviados.
    const mariana = await proyecto(tx, {
      estudiante: { nombre: "Mariana Rojas Vaca", ci: "7654321", whatsapp: "59171000101", correo: "mariana.rojas@ejemplo.com" },
      titulo: "Calidad del agua de consumo en comunidades rurales de Pando",
      universidad: "Universidad Amazónica de Pando",
      nivel: "pregrado",
      cuotas: [[-58, 2000], [-28, 2000], [2, 2000], [32, 2000], [62, 1000]],
      inicio: -60,
      hechas: 4,
      formularioId,
    });
    await enviarPropuesta(tx, actor, mariana.id, "ci", inst(-63));
    await aceptarPropuesta(tx, mariana.id, inst(-62));
    await pagar(tx, mariana.planId, [1, 2]);
    const eM = await enlaceDe(tx, mariana.planId);
    const fd = new FormData();
    const form = (await obtenerFormulario(tx, formularioId))!;
    const val: Record<string, string | File> = {
      Carrera: "Bioquímica y Farmacia",
      "¿Qué problema te interesa investigar?": "Muchas familias de las comunidades toman agua de pozo sin tratar. Quiero medir su calidad y relacionarla con enfermedades diarreicas en niños.",
      "Fecha límite para defender": d(150),
      "Modalidad de las reuniones": "Virtual (Zoom o Meet)",
      "Perfil o avance (si ya tienes uno)": archivo(join(CARPETA_RECURSOS, "perfil-demo.pdf"), "Perfil_Mariana_Rojas.pdf", "application/pdf"),
      "Datos recolectados": archivo("tests/fixtures/datos.zip", "Fotos_de_campo.zip", "application/zip"),
    };
    for (const c of form.campos) fd.set(`campo_${c.id}`, val[c.etiqueta] ?? "");
    await guardarRespuestas(tx, { organizacionId: org.id, propuestaId: mariana.id, enlaceId: eM.id, fd });
    await subirArchivosEstudiante(tx, { organizacionId: org.id, propuestaId: mariana.id, enlaceId: eM.id, descripcion: "Encuesta piloto aplicada", archivos: [archivo("tests/fixtures/datos.zip", "Encuesta_piloto.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")] });
    await guardarNotas(tx, mariana.id, "Reuniones por Zoom los jueves a las 19:00. Pendiente: ampliar el marco teórico con normas de agua potable (NB 512).");

    // 2) Lucas: plan en reales (BRL), cuota 2 vencida hace 3 días (dentro de la gracia de 5).
    const lucas = await proyecto(tx, {
      estudiante: { nombre: "Lucas Almeida Souza", ci: "", whatsapp: "5568999000202", correo: "lucas.almeida@ejemplo.com" },
      titulo: "Prevalência de parasitoses intestinais em escolares de Cobija",
      universidad: "Universidad Amazónica de Pando",
      nivel: "posgrado",
      moneda: "BRL",
      cuotas: [[-33, 1200], [-3, 1200], [27, 1200], [57, 1200], [87, 800]],
      inicio: -35,
      hechas: 2,
    });
    await enviarPropuesta(tx, actor, lucas.id, "pin", inst(-37));
    await aceptarPropuesta(tx, lucas.id, inst(-36));
    await pagar(tx, lucas.planId, [1]);

    // 3) José Luis: en cola (cuota 2 con 20 días de atraso, recargo del 5 %): necesita un cronograma nuevo.
    const jose = await proyecto(tx, {
      estudiante: { nombre: "José Luis Mamani Quispe", ci: "6123456", whatsapp: "59171000303", correo: "" },
      titulo: "Uso de redes sociales y rendimiento académico en estudiantes de Contaduría",
      universidad: "Universidad Domingo Savio",
      nivel: "pregrado",
      cuotas: [[-50, 2000], [-20, 2000], [10, 2000], [40, 2000], [70, 1000]],
      inicio: -52,
      hechas: 2,
    });
    await enviarPropuesta(tx, actor, jose.id, "ci", inst(-55));
    await aceptarPropuesta(tx, jose.id, inst(-54));
    await pagar(tx, jose.planId, [1]);

    // 4) Andrea: en tribunal, 4 cuotas pagadas, comprobante de la 5.ª por aprobar; pidió 3.ª revisión y diapositivas.
    const andrea = await proyecto(tx, {
      estudiante: { nombre: "Andrea Gutiérrez Molina", ci: "5987654", whatsapp: "59171000404", correo: "andrea.gutierrez@ejemplo.com" },
      titulo: "Factores asociados a la deserción universitaria en Pando (maestría)",
      universidad: "Universidad Amazónica de Pando",
      nivel: "posgrado",
      cuotas: [[-125, 2000], [-95, 2000], [-65, 2000], [-20, 2000], [5, 1000]],
      inicio: -130,
      hechas: 8,
    });
    await enviarPropuesta(tx, actor, andrea.id, "ci", inst(-133));
    await aceptarPropuesta(tx, andrea.id, inst(-132));
    await pagar(tx, andrea.planId, [1, 2, 3, 4]);
    await sincronizarProyecto(tx, andrea.id, hoy);
    await cambiarEstadoManual(tx, actor, andrea.id, "tribunal");
    for (const r of await tx.select().from(revisiones).where(eq(revisiones.propuestaId, andrea.id))) await marcarRevision(tx, r.id, true);
    await solicitarTerceraRevision(tx, andrea.id);
    const [diapo] = await tx.select().from(propuestaExtras).where(eq(propuestaExtras.propuestaId, andrea.id));
    await solicitarExtra(tx, andrea.id, diapo.id);
    await pagar(tx, andrea.planId, [5], false);
    await tx.update(pagos).set({ creadoEn: inst(-1, 22) }).where(and(eq(pagos.planId, andrea.planId), eq(pagos.estado, "pendiente")));

    // 5) Camila: propuesta enviada hace 2 días (vence en 5), todavía sin aceptar.
    const camila = await proyecto(tx, {
      estudiante: { nombre: "Camila Suárez Rivero", ci: "8456123", whatsapp: "59171000505", correo: "camila.suarez@ejemplo.com" },
      titulo: "Calidad de vida en adultos mayores con diabetes tipo 2",
      universidad: "Universidad Amazónica de Pando",
      nivel: "pregrado",
      cuotas: [[12, 1800], [42, 1800], [72, 1800], [102, 1800], [132, 1800]],
      inicio: 12,
      formularioId,
    });
    await enviarPropuesta(tx, actor, camila.id, "ci", inst(-2));

    // 6) Diego: propuesta que venció sin ser aceptada (el enlace se destruyó).
    const diego = await proyecto(tx, {
      estudiante: { nombre: "Diego Fernández Paz", ci: "9012345", whatsapp: "59171000606", correo: "" },
      titulo: "Impacto del turismo en la economía de Puerto Rico (Pando)",
      universidad: "Universidad Siglo XX",
      nivel: "pregrado",
      cuotas: [[8, 1500], [38, 1500], [68, 1500], [98, 1500]],
      inicio: 8,
    });
    await enviarPropuesta(tx, actor, diego.id, "ci", inst(-12));
    await vencerPropuestas(tx, new Date());

    // 7) Valeria: borrador sin enviar.
    await proyecto(tx, {
      estudiante: { nombre: "Valeria Choque Flores", ci: "7345678", whatsapp: "59171000707", correo: "valeria.choque@ejemplo.com" },
      titulo: "Estrés laboral en el personal de enfermería del Hospital Roberto Galindo",
      universidad: "Universidad Amazónica de Pando",
      nivel: "pregrado",
      cuotas: [[20, 2000], [50, 2000], [80, 2000], [110, 2000], [140, 1000]],
      inicio: 20,
    });

    // Clientes solo de Cobros (sin tesis)
    const rodrigo = await crearCliente(tx, org.id, { nombre: "Rodrigo Céspedes Áñez", ci: "4567890", whatsapp: "59171000808", correo: "rodrigo.cespedes@ejemplo.com", notas: "Docente. Pidió apoyo para el análisis estadístico de su artículo." });
    const planR = await crearPlan(tx, actor, { clienteId: rodrigo.id, titulo: "Asesoría estadística para artículo científico", moneda: "BOB", cuotas: [0, 30, 60].map((n) => ({ montoCentavos: 80000, fechaVencimiento: d(n) })), reglas: REGLAS });
    await crearEnlace(tx, { organizacionId: org.id, planId: planR.id, metodo: "ci" });
    const gabriela = await crearCliente(tx, org.id, { nombre: "Gabriela Ortiz Saucedo", ci: "3456789", whatsapp: "59171000909", correo: "", notas: "" });
    const planG = await crearPlan(tx, actor, { clienteId: gabriela.id, titulo: "Curso de metodología de la investigación", moneda: "BOB", cuotas: [-1, 29].map((n) => ({ montoCentavos: 60000, fechaVencimiento: d(n) })), reglas: REGLAS });
    await tx.update(planesPago).set({ aceptadoEn: inst(-20) }).where(eq(planesPago.id, planG.id));
    await crearEnlace(tx, { organizacionId: org.id, planId: planG.id, metodo: "ci" });
    const [cg] = await tx.select().from(cuotas).where(and(eq(cuotas.planId, planG.id), eq(cuotas.numero, 1)));
    const eG = await enlaceDe(tx, planG.id);
    const pg = await registrarPago(tx, { organizacionId: org.id, planId: planG.id, cuotaId: cg.id, enlaceId: eG.id, archivo: comprobantePdf(), hoy });
    await tx.update(pagos).set({ creadoEn: inst(-1, 16) }).where(eq(pagos.id, pg.id));

    // Mora y estados con la fecha de hoy (lo mismo que hace el job diario de las 07:00).
    const planes = await tx.select({ id: planesPago.id }).from(planesPago);
    for (const p of planes) await recalcularMora(tx, p.id, hoy);
    // Dos pasadas: enviada → aceptada → en curso (igual que al abrir la ficha dos días seguidos).
    for (let i = 0; i < 2; i++) for (const p of [mariana, lucas, jose, camila]) await sincronizarProyecto(tx, p.id, hoy);
    // Las fechas de creación de los planes, al día en que se armaron (para que el historial se lea natural).
    await tx.execute(sql`update clientes set creado_en = now() - interval '70 days' where nombre in ('Mariana Rojas Vaca','José Luis Mamani Quispe','Andrea Gutiérrez Molina','Lucas Almeida Souza')`);
  });

  // Una asistente (rol Asistente) para la sección de usuarios.
  const [asistente] = await db.select().from(roles).where(and(eq(roles.organizacionId, org.id), eq(roles.nombre, "Asistente")));
  if (asistente) await crearUsuarioDeOrganizacion(org.id, { nombre: "Carla Rivero", correo: "carla.asistente@ejemplo.com", contrasena: "Demo-Asistente-2026", rolId: asistente.id }, async () => true);
  console.log(`✓ Datos de demostración listos (hoy = ${hoy})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarPools());
