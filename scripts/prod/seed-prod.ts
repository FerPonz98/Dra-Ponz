// Primer arranque en producción (a mano, una sola vez): npm run seed:prod   (consola del servicio App en Easypanel)
// Crea SOLO la organización de la Dra. (cobros + tesis, tema y contenido inicial) y su usuaria administradora con una
// contraseña ALEATORIA que se imprime UNA vez. Correo: SEED_DRA_EMAIL. Si ya existen, no cambia nada.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { organizaciones, usuarios } from "@/core/db/schema";
import { crearOrganizacion } from "@/core/servicios";
import { sembrarTema } from "@/core/tema/servicio";
import { cerrarPools, dbAdmin, withOrg } from "@/lib/db";
import { sembrarModulos } from "../seed-modulos";
import { esperarPostgres, urlDueno } from "./comun";

async function main() {
  const correo = process.env.SEED_DRA_EMAIL?.trim().toLowerCase();
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error("Define SEED_DRA_EMAIL con el correo de la Dra. (ej.: SEED_DRA_EMAIL=correo@ejemplo.com npm run seed:prod)");
  await esperarPostgres(urlDueno());
  const db = dbAdmin();
  let [org] = await db.select().from(organizaciones).where(eq(organizaciones.slug, "dra-ponz"));
  let clave: string | null = null;
  if (!org) {
    const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, correo));
    if (existe) throw new Error(`Ya existe un usuario con ${correo}`);
    clave = randomBytes(12).toString("base64url"); // 16 caracteres aleatorios
    org = await crearOrganizacion({ nombre: "Dra. Elizabeth Julieta Ponz Sejas", slug: "dra-ponz", dominio: process.env.SEED_DOMINIO ?? "julietaponz.com", modulos: ["cobros", "tesis"], monedaDefecto: "BOB", adminNombre: "Dra. Julieta Ponz", adminCorreo: correo, adminContrasena: clave });
    await db.update(organizaciones).set({ whatsapp: process.env.WHATSAPP_LANDING ?? null }).where(eq(organizaciones.id, org.id));
  }
  await withOrg(org.id, (tx) => sembrarTema(tx, org.id));
  await sembrarModulos(org.id, ["cobros", "tesis"]);
  if (clave) {
    console.log("\n════════════════════════════════════════════════════════════");
    console.log(" Organización de la Dra. creada. Guarda estos datos AHORA:");
    console.log(`   Correo:     ${correo}`);
    console.log(`   Contraseña: ${clave}`);
    console.log(" (no se vuelve a mostrar; luego se cambia con «¿Olvidaste tu contraseña?»)");
    console.log("════════════════════════════════════════════════════════════\n");
  } else console.log("La organización de la Dra. ya existía: no se cambió ningún usuario ni contraseña (solo se completaron datos base).");
}

main()
  .catch((e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => cerrarPools());
