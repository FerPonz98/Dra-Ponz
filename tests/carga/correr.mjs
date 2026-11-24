// Corre un escenario de k6 midiendo CPU/RAM y guarda el resumen. Nativo de Windows (k6.exe de .herramientas).
//   node tests/carga/correr.mjs <landing|portal|panel|pico> <etiqueta: antes|despues> [VAR=valor …]
// Ej.: node tests/carga/correr.mjs landing antes
//      node tests/carga/correr.mjs portal despues VUS=100 SOSTENIDO=2m
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [escenario, etiqueta = "prueba", ...vars] = process.argv.slice(2);
if (!["landing", "portal", "panel", "pico"].includes(escenario)) {
  console.error("Uso: node tests/carga/correr.mjs <landing|portal|panel|pico> <etiqueta> [VAR=valor …]");
  process.exit(2);
}
const env = Object.fromEntries(vars.map((v) => v.split("=")));
const base = env.BASE_URL ?? process.env.BASE_URL ?? "http://127.0.0.1:3500"; // 127.0.0.1: en Windows "localhost" prueba IPv6 primero (+200 ms)
const puerto = env.PUERTO_APP ?? new URL(base).port ?? "80"; // procesos de la app a medir (detrás de Nginx: 3500)
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
const k6 = buscar(resolve(".herramientas", "k6"), /^k6\.exe$/);
if (!k6) throw new Error("Falta k6: scripts\\auditoria\\instalar-herramientas.ps1");

const dir = resolve(".data", "carga", "resultados");
mkdirSync(dir, { recursive: true });
const nombre = `${escenario}-${etiqueta}`;
const csv = join(dir, `${nombre}-monitor.csv`);
const resumenK6 = join(dir, `${nombre}-k6.json`);

const monitor = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve("tests/carga/monitor.ps1"), "-Puerto", puerto, "-Salida", csv], { stdio: "inherit" });
const t0 = Date.now();
const r = spawnSync(k6, ["run", "--quiet", "--summary-export", resumenK6, ...Object.entries({ BASE_URL: base, ...env }).flatMap(([k, v]) => ["-e", `${k}=${v}`]), join("tests", "carga", `${escenario}.js`)], { stdio: "inherit" });
writeFileSync(`${csv}.fin`, "");
await new Promise((ok) => monitor.on("exit", ok));

const k = JSON.parse(readFileSync(resumenK6, "utf8"));
const filas = readFileSync(csv, "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.replace(/^﻿/, "").split(",").map((x, i) => (i ? Number(x) : x)));
const col = (i) => filas.map((f) => f[i]).filter((x) => Number.isFinite(x));
const prom = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const max = (xs) => (xs.length ? Math.max(...xs) : 0);
const tendencias = Object.entries(k.metrics)
  .filter(([n]) => n.startsWith("http_req_duration{tipo:") || n === "http_req_duration")
  .map(([n, m]) => ({ métrica: n.replace("http_req_duration", "duración").replace(/[{}]/g, " ").trim(), n: m.count, p50: Math.round(m.med), p95: Math.round(m["p(95)"]), p99: Math.round(m["p(99)"]), máx: Math.round(m.max) }));
const resumen = {
  escenario,
  etiqueta,
  fecha: new Date().toISOString(),
  duraciónSeg: Math.round((Date.now() - t0) / 1000),
  vusMáx: k.metrics.vus_max?.max ?? k.metrics.vus_max?.value,
  peticiones: k.metrics.http_reqs.count,
  rps: Math.round(k.metrics.http_reqs.rate),
  erroresPct: Number((100 * (k.metrics.http_req_failed?.value ?? 0)).toFixed(2)),
  checksPct: Number((100 * (k.metrics.checks?.value ?? 1)).toFixed(2)),
  tendencias,
  umbralesOk: r.status === 0,
  cpuAppPromPct: Number(prom(col(1)).toFixed(1)),
  cpuAppMáxPct: Number(max(col(1)).toFixed(1)),
  núcleosAppMáx: Number(max(col(2)).toFixed(2)),
  ramAppMáxMb: Math.round(max(col(3))),
  cpuPgPromPct: Number(prom(col(4)).toFixed(1)),
  cpuPgMáxPct: Number(max(col(4)).toFixed(1)),
  ramPgMáxMb: Math.round(max(col(5))),
};
writeFileSync(join(dir, `${nombre}.json`), JSON.stringify(resumen, null, 2));
console.log(`\n══ ${nombre}: ${resumen.peticiones} peticiones (${resumen.rps}/s), errores ${resumen.erroresPct} %, checks ${resumen.checksPct} %, umbrales ${resumen.umbralesOk ? "✓" : "✗"}`);
console.table(tendencias);
console.log(`CPU app prom ${resumen.cpuAppPromPct} % (máx ${resumen.cpuAppMáxPct} %, ${resumen.núcleosAppMáx} núcleos) · RAM app máx ${resumen.ramAppMáxMb} MB · CPU Postgres prom ${resumen.cpuPgPromPct} % (máx ${resumen.cpuPgMáxPct} %) · RAM Postgres máx ${resumen.ramPgMáxMb} MB`);
if (!existsSync(resumenK6)) process.exit(1);
process.exit(r.status ?? 1);
