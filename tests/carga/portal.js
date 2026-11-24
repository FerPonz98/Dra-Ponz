// Escenario 2 — Portal: 200 estudiantes simultáneos entran con su enlace + CI, ven sus cuotas y suben un
// comprobante de 2–5 MB (cada uno el suyo, con una marca única para verificar integridad después).
import { check, sleep } from "k6";
import http from "k6/http";
import { azar, BASE, entrarPortal, ESTADISTICAS, ESTUDIANTES, pdfConMarca } from "./comun.js";

const VUS = Number(__ENV.VUS || 200);
export const options = {
  scenarios: {
    portal: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: __ENV.SUBIDA || "1m", target: VUS },
        { duration: __ENV.SOSTENIDO || "4m", target: VUS },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    "http_req_duration{tipo:portal}": ["p(95)<800"],
    "http_req_duration{tipo:portal-login}": ["p(95)<800"],
    "http_req_duration{tipo:subida}": ["p(95)<3000"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ESTADISTICAS,
};

let subido = false; // estado por VU (cada VU es un estudiante distinto)

export default function () {
  const e = ESTUDIANTES[(__VU - 1) % ESTUDIANTES.length];
  const r = entrarPortal(e);
  check(r, { "portal: entró y ve sus cuotas": (x) => x.status === 200 && (x.body || "").includes("Ya pagué, subir comprobante") });
  sleep(azar(2, 5));
  const v = http.get(`${BASE}/p/${e.token}`, { tags: { tipo: "portal" } });
  check(v, { "portal: vuelve a ver sus cuotas": (x) => x.status === 200 });
  if (!subido) {
    const s = http.post(
      `${BASE}/p/${e.token}/comprobante`,
      { cuotaId: e.cuotaId, comprobante: http.file(pdfConMarca(`${e.token}:${e.cuotaId}`), "comprobante.pdf", "application/pdf") },
      { headers: { Origin: BASE }, tags: { tipo: "subida" }, timeout: "120s" },
    );
    const ok = check(s, { "subida: comprobante aceptado": (x) => x.status === 200 && JSON.parse(x.body).ok === true });
    if (ok) subido = true;
  }
  sleep(azar(3, 8));
}
