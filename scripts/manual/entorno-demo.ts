// Entorno de la base de DEMOSTRACIÓN para las capturas del manual (cobra_app_demo, local).
// Se arma a partir de .env (mismos roles y servidor de Postgres local) cambiando solo el nombre de la base, la carpeta
// de archivos y la URL. Nunca envía correos (Resend/SMTP vacíos) ni toca la base de desarrollo (cobra_app).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";

export const BASE_DEMO = "cobra_app_demo";
export const PUERTO_DEMO = Number(process.env.MANUAL_PUERTO ?? 3200);
export const URL_DEMO = `http://localhost:${PUERTO_DEMO}`;
/** Usuaria de la demo (ficticia, solo en la base local de demostración). */
export const DRA_DEMO = { correo: "dra.demo@ejemplo.com", clave: "Demo-Manual-2026", nombre: "Dra. Julieta Ponz" };

function conBase(url: string | undefined, nombre: string) {
  if (!url) throw new Error(`Falta ${nombre} en .env (se necesita para crear la base de demostración)`);
  const u = new URL(url);
  if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) throw new Error(`${nombre} no apunta a un Postgres local: las capturas solo se generan en local.`);
  u.pathname = `/${BASE_DEMO}`;
  return u.toString();
}

export function entornoDemo(): Record<string, string> {
  const env = parse(readFileSync(resolve(".env")));
  const pick = (k: string) => process.env[k] ?? env[k];
  const admin = pick("DATABASE_ADMIN_URL") ?? pick("DATABASE_URL_OWNER");
  const superUrl = pick("PG_SUPERUSER_URL");
  if (!superUrl) throw new Error("Falta PG_SUPERUSER_URL en .env (para crear la base de demostración)");
  return {
    NODE_ENV: "production",
    TZ: "America/La_Paz",
    PG_SUPERUSER_URL: superUrl,
    DATABASE_URL: conBase(pick("DATABASE_URL"), "DATABASE_URL"),
    DATABASE_ADMIN_URL: conBase(admin, "DATABASE_ADMIN_URL"),
    DATABASE_URL_OWNER: conBase(admin, "DATABASE_ADMIN_URL"),
    BETTER_AUTH_SECRET: pick("BETTER_AUTH_SECRET") ?? "demo-manual-secreto-local-solo-capturas-0000",
    BETTER_AUTH_URL: URL_DEMO,
    APP_URL: URL_DEMO,
    UPLOAD_DIR: resolve(".data/demo-manual/uploads"),
    // Sin correo: nada sale de la máquina.
    RESEND_API_KEY: "",
    SMTP_HOST: "",
    CRON_SECRET: "",
    // Solo la organización de la Dra. con la usuaria de la demo (los demás usuarios del seed quedan fuera).
    DRA_EMAIL: DRA_DEMO.correo,
    DRA_PASSWORD: DRA_DEMO.clave,
    ADMINS_EXTRA: "",
    SUPERADMIN_EMAIL: "",
    DEMO_EMAIL: "",
    WHATSAPP_LANDING: "59171000000",
    LANDING_ORG_SLUG: "dra-ponz",
    LOGIN_MAX_POR_MINUTO: "1000",
    LIMITES_DESACTIVADOS: "1",
    PORT: String(PUERTO_DEMO),
    HOSTNAME: "localhost",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
