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
      // Una sola instancia: el rate limit del login vive en memoria.
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "700M",
      time: true,
      env: {
        ...leerEnv(path.join(__dirname, ".env")),
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
