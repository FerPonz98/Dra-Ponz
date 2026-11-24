// OWASP ZAP nativo en Windows (Java portable de .herramientas, sin WSL ni Docker): baseline (pasivo) + escaneo activo
// de landing, login, portal (con sesión) y panel (con sesión de la Dra.). SOLO contra localhost con la BD de pruebas.
// Uso (servidor de pruebas corriendo: node scripts/con-entorno.mjs .env.test -- npx next start -p 3400):
//   node scripts/auditoria/zap.mjs [--solo-pasivo] [--minutos 25]
// Requiere .data/zap-cookie.txt (cookie de sesión de la Dra.) y .data/zap-portal.json (scripts/auditoria/fixture-portal.ts).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const base = process.env.ZAP_OBJETIVO ?? "http://localhost:3400";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) {
  console.error(`✗ ZAP solo se corre contra localhost (recibido: ${base}). Nunca contra producción ni terceros.`);
  process.exit(2);
}
const soloPasivo = process.argv.includes("--solo-pasivo");
const i = process.argv.indexOf("--minutos");
const minutos = i > 0 ? Number(process.argv[i + 1]) : 25;

const raiz = resolve(".herramientas");
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
if (!existsSync(raiz)) {
  console.error("Falta .herramientas: powershell -ExecutionPolicy Bypass -File scripts\\auditoria\\instalar-herramientas.ps1");
  process.exit(2);
}
const java = buscar(join(raiz, "jdk"), /^java\.exe$/);
const zapJar = buscar(join(raiz, "zap"), /^zap-[\d.]+\.jar$/);
const salida = resolve(".data", "zap");
mkdirSync(salida, { recursive: true });

const cookies = [];
if (existsSync(".data/zap-cookie.txt")) cookies.push(readFileSync(".data/zap-cookie.txt", "utf8").trim());
let portal = null;
if (existsSync(".data/zap-portal.json")) {
  portal = JSON.parse(readFileSync(".data/zap-portal.json", "utf8"));
  cookies.push(portal.cookie);
}

const semillas = ["/es", "/pt", "/login", "/recuperar", "/panel", "/panel/cobros/clientes", "/panel/cobros/planes", "/panel/tesis/propuestas", "/panel/buscar?q=a", ...(portal ? [`/p/${portal.token}`] : [])];
const y = (s) => JSON.stringify(s);
const plan = `
env:
  contexts:
    - name: app
      urls: [${y(base)}]
      includePaths: [${y(`${base}.*`)}]
      excludePaths:
        - ${y(`${base}/api/auth/sign-out.*`)}
        - ${y(`${base}/api/jobs/.*`)}
        - ${y(`${base}/_next/static/.*`)}
  parameters:
    failOnError: false
    failOnWarning: false
    progressToStdout: true
jobs:
  - type: replacer
    parameters:
      deleteAllRules: true
    rules:
      - description: sesiones
        url: ${y(`${base}.*`)}
        matchType: req_header
        matchString: Cookie
        matchRegex: false
        replacementString: ${y(cookies.join("; "))}
  - type: requestor
    requests:
${semillas.map((s) => `      - url: ${y(base + s)}\n        method: GET`).join("\n")}
  - type: spider
    parameters:
      context: app
      url: ${y(`${base}/es`)}
      maxDuration: 3
  - type: spider
    parameters:
      context: app
      url: ${y(`${base}/panel`)}
      maxDuration: 3
  - type: passiveScan-wait
    parameters:
      maxDuration: 5
${
  soloPasivo
    ? ""
    : `  - type: activeScan
    parameters:
      context: app
      maxRuleDurationInMins: 3
      maxScanDurationInMins: ${minutos}
      threadPerHost: 4
`
}  - type: report
    parameters:
      template: traditional-json
      reportDir: ${y(salida)}
      reportFile: ${soloPasivo ? "zap-pasivo" : "zap-activo"}
  - type: report
    parameters:
      template: traditional-html
      reportDir: ${y(salida)}
      reportFile: ${soloPasivo ? "zap-pasivo" : "zap-activo"}
`;
const rutaPlan = join(salida, "plan.yaml");
writeFileSync(rutaPlan, plan);
console.log(`ZAP ${soloPasivo ? "pasivo" : "activo"} contra ${base} (máx. ${minutos} min)…`);
const r = spawnSync(java, ["-Xmx2g", "-jar", zapJar, "-cmd", "-dir", join(raiz, "zap-inicio"), "-autorun", rutaPlan], { stdio: "inherit", cwd: join(zapJar, "..") });
const informe = join(salida, `${soloPasivo ? "zap-pasivo" : "zap-activo"}.json`);
if (!existsSync(informe)) {
  console.error("✗ ZAP no generó el informe");
  process.exit(r.status ?? 1);
}
const j = JSON.parse(readFileSync(informe, "utf8"));
const filas = j.site.flatMap((s) => s.alerts.map((a) => ({ riesgo: a.riskdesc, alerta: a.alert, n: Number(a.count), ejemplo: a.instances?.[0]?.uri })));
filas.sort((a, b) => b.riesgo.localeCompare(a.riesgo));
console.table(filas);
void execFileSync;
