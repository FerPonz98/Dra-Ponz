// Corre el servidor standalone de Next en N procesos (como PM2 en modo cluster) para las pruebas de carga.
//   node scripts/con-entorno.mjs .env.carga -- node tests/carga/cluster.mjs 4      (puerto: PORT o 3500)
// Antes: npm run build y copiar estáticos (lo hace este script si faltan, igual que scripts/deploy.sh).
import cluster from "node:cluster";
import { cpSync, existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const procesos = Number(process.argv[2] ?? process.env.PM2_INSTANCIAS ?? availableParallelism());
const raiz = resolve(".next", "standalone");

// Reparto round-robin, como Node en Linux (y PM2 en el VPS). En Windows el valor por defecto deja que el sistema
// operativo reparta las conexiones y casi todas caen en un solo proceso.
cluster.schedulingPolicy = cluster.SCHED_RR;

if (cluster.isPrimary) {
  if (!existsSync(resolve(raiz, "server.js"))) throw new Error("Falta .next/standalone/server.js: corre npm run build");
  cpSync(resolve("public"), resolve(raiz, "public"), { recursive: true });
  cpSync(resolve(".next", "static"), resolve(raiz, ".next", "static"), { recursive: true });
  process.env.PORT ??= "3500";
  process.env.HOSTNAME ??= "127.0.0.1";
  console.log(`cluster: ${procesos} procesos en http://${process.env.HOSTNAME}:${process.env.PORT}`);
  for (let i = 0; i < procesos; i++) cluster.fork();
  cluster.on("exit", (w, codigo) => {
    console.error(`proceso ${w.process.pid} terminó (${codigo}); se levanta otro`);
    cluster.fork();
  });
} else {
  await import(pathToFileURL(resolve(raiz, "server.js")).href);
}
