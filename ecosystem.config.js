// PM2: corre el servidor standalone de Next.js con las variables de .env.
// Uso: pm2 start ecosystem.config.js && pm2 save   |   deploy: pm2 reload ecosystem.config.js --update-env
const fs = require("node:fs");
const path = require("node:path");

function leerEnv(archivo) {
  if (!fs.existsSync(archivo)) return {};
  const env = {};
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: "cobros",
      cwd: __dirname,
      script: ".next/standalone/server.js",
      // Cluster: un proceso por vCPU (PM2_INSTANCIAS, por defecto 2). Es seguro: los límites del login y los
      // bloqueos viven en la BD, y el tema/textos de la landing se leen frescos en cada visita (sin caché por proceso).
      // Cada proceso abre hasta 2 × DB_POOL_MAX conexiones (app + dueño): procesos × 2 × 10 < max_connections (100).
      instances: Number(leerEnv(path.join(__dirname, ".env")).PM2_INSTANCIAS || 2),
      exec_mode: "cluster",
      // Bajo carga un proceso llega a ~1–1,5 GB (medido con 1.000 usuarios): con 700M PM2 lo reiniciaba en pleno pico.
      max_memory_restart: "1500M",
      kill_timeout: 10000,
      time: true,
      env: {
        ...leerEnv(path.join(__dirname, ".env")),
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
        // Detrás del Nginx del repo: activa el nonce marcador de la micro-caché de la landing (ver scripts/nginx)
        LANDING_CACHE_NGINX: "1",
      },
    },
  ],
};
