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
// Solo bases LOCALES de prueba: nunca una remota (producción) ni la de desarrollo (cobra_app).
const destino = URL.canParse(vars.DATABASE_URL ?? "") ? new URL(vars.DATABASE_URL) : null;
if (!destino || !/^(localhost|127\.0\.0\.1)$/.test(destino.hostname) || destino.pathname === "/cobra_app") {
  console.error("✗ Este archivo apunta a una base remota o a la de desarrollo (cobra_app). Usa una base de pruebas local.");
  process.exit(2);
}
const hijo = spawn(cmd[0], cmd.slice(1), { stdio: "inherit", shell: true, env: { ...process.env, ...vars, DOTENV_CONFIG_PATH: archivo, DOTENV_CONFIG_OVERRIDE: "true" } });
hijo.on("exit", (c) => process.exit(c ?? 1));
