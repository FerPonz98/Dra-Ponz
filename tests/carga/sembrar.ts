// Datos realistas para las pruebas de carga en la BD de PRUEBAS (cobra_app_test). Idempotente.
//   node scripts/con-entorno.mjs .env.test -- npx tsx tests/carga/sembrar.ts
// 50 organizaciones (cobros + tesis) con su asesor/a, 2.000 clientes/estudiantes, 2.000 planes, 5.000 cuotas,
// 2.000 enlaces de portal (CI), 300 propuestas con cronograma y actividades, 600 pagos con comprobante (archivo real).
// Escribe .data/carga/credenciales.json (asesores y estudiantes) para los scripts de k6.
import "dotenv/config";
import { inArray, like, sql } from "drizzle-orm";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { directorioSubidas } from "@/core/archivos";
import { archivos, organizaciones } from "@/core/db/schema";
import { crearOrganizacion } from "@/core/servicios";
import { cerrarPools, dbAdmin, withAdmin } from "@/lib/db";
import { generarToken, normalizarCi } from "@/modules/cobros/dominio/portal";
import { clientes, cuotas, enlacesPortal, pagos, planesPago } from "@/modules/cobros/schema";
import { actividades, cronogramas, propuestas } from "@/modules/tesis/schema";

export const CLAVE_ASESOR = "Carga2026!asesor";
const N_ORGS = 50;
const CLIENTES_POR_ORG = 40; // 2.000
const PROPUESTAS_POR_ORG = 6; // 300
const PAGOS_POR_ORG = 12; // 600

const NOMBRES = ["Ana", "Luis", "María", "Jorge", "Carla", "Diego", "Lucía", "Pedro", "Sofía", "Miguel", "Valeria", "Andrés", "Paola", "Raúl", "Gabriela", "Fernando", "Daniela", "Marco", "Camila", "Rodrigo"];
const APELLIDOS = ["Quispe", "Mamani", "Rojas", "Vargas", "Flores", "Gutiérrez", "Pérez", "Choque", "Mendoza", "Torrez", "Rivera", "Suárez", "Herrera", "Castro", "Salazar"];
const azar = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const fecha = (base: string, mesesMas: number) => {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + mesesMas);
  return d.toISOString().slice(0, 10);
};
async function enLotes<T>(filas: T[], tam: number, fn: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < filas.length; i += tam) await fn(filas.slice(i, i + tam));
}

async function main() {
  if (!/cobra_app_test/.test(process.env.DATABASE_URL ?? "")) throw new Error("Solo contra la base de pruebas (cobra_app_test).");
  const db = dbAdmin();
  const existentes = await db.select({ id: organizaciones.id, slug: organizaciones.slug }).from(organizaciones).where(like(organizaciones.slug, "carga-%"));
  const credenciales: { asesores: { correo: string; clave: string; org: string }[]; estudiantes: { token: string; ci: string; cuotaId: string; org: string }[]; propuestas: { id: string; org: string }[] } = { asesores: [], estudiantes: [], propuestas: [] };
  const pdf = new Uint8Array(readFileSync("tests/fixtures/comprobante.pdf"));
  const t0 = Date.now();

  for (let o = 1; o <= N_ORGS; o++) {
    const slug = `carga-${String(o).padStart(2, "0")}`;
    const correo = `asesor${String(o).padStart(2, "0")}@carga.test`;
    credenciales.asesores.push({ correo, clave: CLAVE_ASESOR, org: slug });
    if (existentes.some((e) => e.slug === slug)) continue;
    const org = await crearOrganizacion({ nombre: `Asesorías ${slug}`, slug, modulos: ["cobros", "tesis"], monedaDefecto: "BOB", adminNombre: `Asesor ${o}`, adminCorreo: correo, adminContrasena: CLAVE_ASESOR });

    await withAdmin(async (tx) => {
      const cls = Array.from({ length: CLIENTES_POR_ORG }, (_, i) => ({
        id: crypto.randomUUID(),
        organizacionId: org.id,
        nombre: `${azar(NOMBRES)} ${azar(APELLIDOS)} ${azar(APELLIDOS)}`,
        ci: String(3_000_000 + o * 10_000 + i),
        whatsapp: `5917${String(1_000_000 + o * 1000 + i).slice(-7)}`,
        correo: `estudiante${o}-${i}@correo.test`,
      }));
      await tx.insert(clientes).values(cls);
      // 2.000 planes: la mitad con 3 cuotas y la otra mitad con 2 → 5.000 cuotas. Algunos con recargo.
      const pls = cls.map((c, i) => ({
        id: crypto.randomUUID(),
        organizacionId: org.id,
        clienteId: c.id,
        titulo: i < PROPUESTAS_POR_ORG ? `Tesis ${c.nombre}` : `Curso ${i}`,
        moneda: "BOB" as const,
        aceptadoEn: new Date(),
        recargoActivo: i % 3 === 0,
        recargoPorcentaje: i % 3 === 0 ? "5.00" : null,
        diasGracia: 3,
        origen: i < PROPUESTAS_POR_ORG ? "tesis" : "cobros",
      }));
      await tx.insert(planesPago).values(pls);
      const cts = pls.flatMap((p, i) =>
        Array.from({ length: i % 2 === 0 ? 3 : 2 }, (_, k) => ({
          id: crypto.randomUUID(),
          organizacionId: org.id,
          planId: p.id,
          numero: k + 1,
          montoCentavos: 25_000 + (i % 5) * 5_000,
          // Vencimientos entre septiembre 2026 y febrero 2027: hay cuotas vencidas, por vencer y futuras.
          fechaVencimiento: fecha("2026-09-10", k + (i % 3)),
        })),
      );
      await enLotes(cts, 1000, (l) => tx.insert(cuotas).values(l));
      const enls = pls.map((p, i) => ({ id: crypto.randomUUID(), organizacionId: org.id, planId: p.id, token: generarToken(), metodo: "ci" as const, ci: normalizarCi(cls[i].ci) }));
      await tx.insert(enlacesPortal).values(enls);

      // 300 propuestas (6 por organización) con cronograma de 6 meses y actividades
      const props = pls.slice(0, PROPUESTAS_POR_ORG).map((p, i) => ({
        id: crypto.randomUUID(),
        organizacionId: org.id,
        clienteId: p.clienteId,
        planId: p.id,
        titulo: `Tesis de ${cls[i].nombre}: análisis de caso ${i + 1}`,
        universidad: azar(["UAP", "UMSA", "UAGRM", "UMSS", "USFX"]),
        nivel: (i % 2 ? "posgrado" : "pregrado") as "pregrado" | "posgrado",
        estado: azar(["enviada", "aceptada", "en_curso", "en_curso", "en_gracia", "tribunal"]) as "en_curso",
        enviadaEn: new Date(),
        aceptadaEn: new Date(),
        vecesEnviada: 1,
      }));
      await tx.insert(propuestas).values(props);
      const crs = props.map((p) => ({ id: crypto.randomUUID(), organizacionId: org.id, propuestaId: p.id, version: 1, fechaInicio: "2026-09-01", meses: 6, estado: "aceptado" as const, aceptadoEn: new Date() }));
      await tx.insert(cronogramas).values(crs);
      await tx.insert(actividades).values(
        crs.flatMap((c) =>
          ["Planteamiento del problema", "Marco teórico", "Metodología", "Trabajo de campo", "Análisis de datos", "Redacción final"].map((nombre, k) => ({
            organizacionId: org.id,
            cronogramaId: c.id,
            orden: k + 1,
            nombre,
            meses: [k + 1],
            aCargoEstudiante: k % 2 === 1,
            hecha: k < 2,
          })),
        ),
      );

      // 600 pagos con comprobante PDF real en UPLOAD_DIR (12 por organización; la mitad aprobados)
      const dir = join(directorioSubidas(), org.id, "comprobantes");
      mkdirSync(dir, { recursive: true });
      const primeras = cts.filter((c) => c.numero === 1).slice(PROPUESTAS_POR_ORG + 4, PROPUESTAS_POR_ORG + 4 + PAGOS_POR_ORG);
      for (const [k, c] of primeras.entries()) {
        const archivoId = crypto.randomUUID();
        writeFileSync(join(dir, `${archivoId}.pdf`), pdf);
        await tx.insert(archivos).values({ id: archivoId, organizacionId: org.id, rutaRelativa: `${org.id}/comprobantes/${archivoId}.pdf`, nombreOriginal: "comprobante.pdf", tipoMime: "application/pdf", tamanoBytes: pdf.byteLength, categoria: "comprobantes" });
        const aprobado = k % 2 === 0;
        await tx.insert(pagos).values({ organizacionId: org.id, planId: c.planId, cuotaId: c.id, moneda: "BOB", montoCentavos: c.montoCentavos, montoBobCentavos: c.montoCentavos, comprobanteArchivoId: archivoId, estado: aprobado ? "aprobado" : "pendiente", revisadoEn: aprobado ? new Date() : null });
        if (aprobado) await tx.update(cuotas).set({ estado: "pagada", pagadaEn: new Date() }).where(inArray(cuotas.id, [c.id]));
      }
    });
    process.stdout.write(`\r  ${slug} lista (${Math.round((Date.now() - t0) / 1000)} s)   `);
  }
  mkdirSync(".data/carga", { recursive: true });
  // Estudiantes sin pagos (para subir comprobantes) y propuestas, leídos de la BD (sirve también si ya existían)
  {
    const r = await db.execute<{ token: string; ci: string; cuota_id: string; slug: string }>(sql`
      select e.token, cl.ci, cu.id as cuota_id, o.slug
      from enlaces_portal e join planes_pago p on p.id = e.plan_id join clientes cl on cl.id = p.cliente_id
      join organizaciones o on o.id = e.organizacion_id join cuotas cu on cu.plan_id = p.id and cu.numero = 1
      where o.slug like 'carga-%' and p.origen = 'cobros' and e.token is not null
        and not exists (select 1 from pagos pg where pg.plan_id = p.id)
      order by o.slug, cl.ci limit 400`);
    credenciales.estudiantes = r.rows.map((x) => ({ token: x.token, ci: x.ci, cuotaId: x.cuota_id, org: x.slug }));
    credenciales.propuestas = (await db.execute<{ id: string; org: string }>(sql`select p.id, o.slug as org from propuestas p join organizaciones o on o.id = p.organizacion_id where o.slug like 'carga-%'`)).rows;
  }
  writeFileSync(".data/carga/credenciales.json", JSON.stringify(credenciales, null, 1));
  const cuenta = await db.execute<Record<string, string>>(sql`
    select (select count(*) from organizaciones where slug like 'carga-%') orgs,
           (select count(*) from clientes c join organizaciones o on o.id=c.organizacion_id where o.slug like 'carga-%') clientes,
           (select count(*) from cuotas c join organizaciones o on o.id=c.organizacion_id where o.slug like 'carga-%') cuotas,
           (select count(*) from propuestas c join organizaciones o on o.id=c.organizacion_id where o.slug like 'carga-%') propuestas,
           (select count(*) from pagos c join organizaciones o on o.id=c.organizacion_id where o.slug like 'carga-%') pagos,
           (select count(*) from archivos c join organizaciones o on o.id=c.organizacion_id where o.slug like 'carga-%') archivos`);
  console.log("\n", cuenta.rows[0], `(${Math.round((Date.now() - t0) / 1000)} s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarPools());
