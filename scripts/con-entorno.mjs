// Corre un comando con las variables de un archivo .env (sobrescribe las del sistema y las de .env).
// Uso: node scripts/con-entorno.mjs .env.test -- npm run db:migrate
// Pensado para el entorno de pruebas de seguridad/carga (base cobra_app_test); nunca apuntes a producción.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";

const [archivo, separador, ...cmd] = process.argv.slice(2);
if (!archivo || separador !== "--" || !cmd.length) {
  console.error("Uso: node scripts/con-entorno.mjs <archivo.env> -- <comando…>");
  process.exit(2);
}
const vars = parse(readFileSync(archivo));
if (/@[^/]+\/cobra_app$/.test(vars.DATABASE_URL ?? "") || vars.NODE_ENV === "production") {
  console.error("✗ Este archivo apunta a la base de desarrollo/producción. Usa una base de pruebas.");
  process.exit(2);
}
const hijo = spawn(cmd[0], cmd.slice(1), { stdio: "inherit", shell: true, env: { ...process.env, ...vars, DOTENV_CONFIG_PATH: archivo, DOTENV_CONFIG_OVERRIDE: "true" } });
hijo.on("exit", (c) => process.exit(c ?? 1));
