// Datos iniciales (idempotente): superadmin, "Dra. Ponz" (cobros+tesis) y "Demo Dentista" (solo cobros).
import "dotenv/config";
import { eq } from "drizzle-orm";
import { organizaciones, usuarios } from "@/core/db/schema";
import { crearOrganizacion, crearUsuario } from "@/core/servicios";
import { sembrarTema } from "@/core/tema/servicio";
import { TEMA_POR_DEFECTO } from "@/core/tema/tema";
import { cerrarPools, dbAdmin, withAdmin, withOrg } from "@/lib/db";
import { sembrarModulos } from "./seed-modulos";

function req(n: string, defecto?: string) {
  const v = process.env[n] ?? defecto;
  if (!v) throw new Error(`Falta ${n}`);
  return v;
}

async function main() {
  const db = dbAdmin();
  const supCorreo = req("SUPERADMIN_EMAIL").toLowerCase();
  const [sup] = await db.select().from(usuarios).where(eq(usuarios.email, supCorreo));
  if (!sup) {
    await withAdmin((tx) => crearUsuario(tx, { nombre: "Superadmin", correo: supCorreo, contrasena: req("SUPERADMIN_PASSWORD"), organizacionId: null, rolId: null, esSuperadmin: true }));
    console.log(`Superadmin creado: ${supCorreo}`);
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
    {
      slug: "demo-dentista",
      nombre: "Demo Dentista",
      dominio: null,
      modulos: ["cobros"] as const,
      adminNombre: "Administrador Demo",
      adminCorreo: req("DEMO_EMAIL"),
      adminContrasena: req("DEMO_PASSWORD"),
    },
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
    }
    await sembrarModulos(org.id, [...o.modulos]);
  }
  console.log("Seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarPools());
