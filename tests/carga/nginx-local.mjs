// Nginx nativo de Windows delante del servidor de carga, con la MISMA configuración de producción
// (scripts/nginx/julietaponz.com.conf) adaptada: puerto 8088 → app en 127.0.0.1:3500, caché en .data, y los
// límites por IP muy altos (k6 sale de una sola IP; los límites se prueban aparte). Sin WSL ni Docker.
//   node tests/carga/nginx-local.mjs iniciar | detener | probar
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const accion = process.argv[2] ?? "iniciar";
const buscar = (dir, re) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const r = buscar(p, re);
      if (r) return r;
    } else if (re.test(e.name)) return p;
  }
  return null;
};
const exe = buscar(resolve(".herramientas", "nginx"), /^nginx\.exe$/);
if (!exe) throw new Error("Falta nginx: scripts\\auditoria\\instalar-herramientas.ps1");
const prefijo = resolve(".data", "nginx");
for (const d of ["conf", "logs", "temp", "cache"]) mkdirSync(join(prefijo, d), { recursive: true });
const barra = (p) => p.replace(/\\/g, "/");

if (accion === "iniciar" || accion === "probar") {
  let sitio = readFileSync("scripts/nginx/julietaponz.com.conf", "utf8").replace(/\r\n/g, "\n");
  sitio = sitio
    .replace(/server 127\.0\.0\.1:3000;/, "server 127.0.0.1:3500;")
    .replace(/^\s*listen \[::\]:80.*$/gm, "")
    .replace(/listen 80 default_server;/, "listen 127.0.0.1:8088 default_server;")
    .replace(/listen 80;/g, "listen 127.0.0.1:8088;")
    .replace(/server_name julietaponz\.com;/, "server_name julietaponz.com 127.0.0.1;")
    .replace(/\/var\/cache\/nginx\/cobros_landing/, barra(join(prefijo, "cache")))
    .replace(/rate=\d+r\/[sm]/g, "rate=100000r/s")
    .replace(/burst=\d+/g, "burst=100000") // Nginx de Windows atiende muchas peticiones en el mismo milisegundo
    .replace(/limit_conn cobros_conn \d+;/, "limit_conn cobros_conn 60000;")
    .replace(/; upgrade-insecure-requests"/, '"'); // local sin HTTPS
  writeFileSync(join(prefijo, "conf", "sitio.conf"), sitio);
  writeFileSync(
    join(prefijo, "conf", "nginx.conf"),
    `worker_processes 1;
events { worker_connections 8192; }
http {
  include ${barra(join(dirname(exe), "conf", "mime.types"))};
  default_type application/octet-stream;
  access_log off;
  error_log ${barra(join(prefijo, "logs", "error.log"))} warn;
  keepalive_timeout 65;
  proxy_temp_path ${barra(join(prefijo, "temp"))};
  client_body_temp_path ${barra(join(prefijo, "temp"))};
  include ${barra(join(prefijo, "conf", "sitio.conf"))};
}
`,
  );
}
const args = ["-p", prefijo + "\\", "-c", "conf/nginx.conf"];
if (accion === "probar") {
  const r = spawnSync(exe, ["-t", ...args], { cwd: dirname(exe), encoding: "utf8" });
  console.log(r.stderr || r.stdout);
  process.exit(r.status ?? 1);
} else if (accion === "detener") {
  spawnSync(exe, ["-s", "stop", ...args], { cwd: dirname(exe), stdio: "inherit" });
} else {
  spawn(exe, args, { cwd: dirname(exe), detached: true, stdio: "ignore" }).unref();
  console.log("nginx escuchando en http://127.0.0.1:8088 → app en 127.0.0.1:3500");
}
