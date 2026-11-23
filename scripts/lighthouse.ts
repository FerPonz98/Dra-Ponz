// Lighthouse (móvil) de la landing: npm run lighthouse  (servidor de producción corriendo en E2E_PORT o 3100)
// Falla si performance o accesibilidad quedan por debajo de 90. Usa el CLI de lighthouse con el Chromium de Playwright.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const base = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
const MINIMO = 90;
const cli = join(process.cwd(), "node_modules", "lighthouse", "cli", "index.js");

type Lhr = { categories: Record<string, { score: number | null }>; audits: Record<string, { id: string; title: string; score: number | null; scoreDisplayMode: string; displayValue?: string }> };

mkdirSync("lighthouse", { recursive: true });
const resultados: Record<string, Record<string, number>> = {};
let ok = true;
for (const ruta of ["/es", "/pt"]) {
  const salida = join("lighthouse", `landing${ruta.replace("/", "-")}`);
  execFileSync(
    process.execPath,
    [cli, `${base}${ruta}`, `--chrome-path=${chromium.executablePath()}`, "--chrome-flags=--headless=new --no-sandbox", "--only-categories=performance,accessibility,best-practices,seo", "--output=json", "--output=html", `--output-path=${salida}`, "--quiet"],
    { stdio: "inherit" },
  );
  const lhr = JSON.parse(readFileSync(`${salida}.report.json`, "utf8")) as Lhr;
  resultados[ruta] = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]));
  if ((resultados[ruta].performance ?? 0) < MINIMO || (resultados[ruta].accessibility ?? 0) < MINIMO) ok = false;
  for (const a of Object.values(lhr.audits)) {
    if (a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable") console.log(`  ⚠ ${ruta} ${a.id}: ${a.title} ${a.displayValue ?? ""}`);
  }
}
console.table(resultados);
writeFileSync("lighthouse/resumen.json", JSON.stringify(resultados, null, 2));
if (!ok) {
  console.error(`✗ Performance o accesibilidad por debajo de ${MINIMO}`);
  process.exit(1);
}
console.log(`✓ Lighthouse ≥ ${MINIMO} en performance y accesibilidad`);
