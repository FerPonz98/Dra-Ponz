// Datos iniciales (idempotente): la organización de la Dra. (cobros + tesis) con sus administradores.
// - DRA_EMAIL / DRA_PASSWORD: administradora principal (la Dra.).
// - ADMINS_EXTRA: más administradores de la organización, "correo:Nombre:contraseña" separados por ";" (opcional).
// - SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD y DEMO_EMAIL / DEMO_PASSWORD: opcionales (solo si están definidos).
//   En producción no hacen falta; las pruebas E2E crean y borran los suyos (tests/e2e/preparar.ts).
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { organizaciones, roles, usuarios } from "@/core/db/schema";
import { crearOrganizacion, crearUsuario } from "@/core/servicios";
import { sembrarTema } from "@/core/tema/servicio";
import { TEMA_POR_DEFECTO } from "@/core/tema/tema";
import { cerrarPools, dbAdmin, withAdmin, withOrg } from "@/lib/db";
import { sembrarModulos } from "./seed-modulos";

function req(n: string) {
  const v = process.env[n];
  if (!v) throw new Error(`Falta ${n}`);
  return v;
}

export async function sembrar() {
  const db = dbAdmin();
  const supCorreo = process.env.SUPERADMIN_EMAIL?.toLowerCase();
  if (supCorreo) {
    const [sup] = await db.select().from(usuarios).where(eq(usuarios.email, supCorreo));
    if (!sup) {
      await withAdmin((tx) => crearUsuario(tx, { nombre: "Superadmin", correo: supCorreo, contrasena: req("SUPERADMIN_PASSWORD"), organizacionId: null, rolId: null, esSuperadmin: true }));
      console.log(`Superadmin creado: ${supCorreo}`);
    }
  }

  const orgs = [
    {
      slug: "dra-ponz",
      nombre: "Dra. Elizabeth Julieta Ponz Sejas",
      dominio: "julietaponz.com",
      modulos: ["cobros", "tesis"] as const,
      adminNombre: "Dra. Julieta Ponz",
      adminCorreo: req("DRA_EMAIL"),
      adminContrasena: req("DRA_PASSWORD"),
    },
    ...(process.env.DEMO_EMAIL
      ? [
          {
            slug: "demo-dentista",
            nombre: "Demo Dentista",
            dominio: null,
            modulos: ["cobros"] as const,
            adminNombre: "Administrador Demo",
            adminCorreo: req("DEMO_EMAIL"),
            adminContrasena: req("DEMO_PASSWORD"),
          },
        ]
      : []),
  ];
  for (const o of orgs) {
    let [org] = await db.select().from(organizaciones).where(eq(organizaciones.slug, o.slug));
    if (!org) {
      org = await crearOrganizacion({ ...o, modulos: [...o.modulos], monedaDefecto: "BOB" });
      console.log(`Organización creada: ${o.nombre}`);
    }
    if (o.slug === "dra-ponz") {
      await db.update(organizaciones).set({ whatsapp: process.env.WHATSAPP_LANDING ?? null, colorPrimario: TEMA_POR_DEFECTO.colorPrimario, colorSecundario: TEMA_POR_DEFECTO.colorSecundario }).where(eq(organizaciones.id, org.id));
      // Tema de la landing y el portal: los colores actuales de la Dra. (sin pisar uno ya elegido).
      await withOrg(org.id, (tx) => sembrarTema(tx, org.id));
      // Administradores adicionales de la organización (mismo rol que la Dra.)
      const [admin] = await db.select().from(roles).where(and(eq(roles.organizacionId, org.id), eq(roles.esAdmin, true)));
      for (const linea of (process.env.ADMINS_EXTRA ?? "").split(";").map((x) => x.trim()).filter(Boolean)) {
        const [correo, nombre, contrasena] = linea.split(":");
        if (!correo || !nombre || !contrasena) throw new Error(`ADMINS_EXTRA mal formado: usa correo:Nombre:contraseña`);
        const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, correo.toLowerCase()));
        if (existe) continue;
        await withAdmin((tx) => crearUsuario(tx, { nombre, correo, contrasena, organizacionId: org.id, rolId: admin.id }));
        console.log(`Administrador creado: ${correo}`);
      }
    }
    await sembrarModulos(org.id, [...o.modulos]);
  }
  console.log("Seed completo.");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed.ts")) {
  sembrar()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => cerrarPools());
}
