// Escenario 3 — Panel: 50 asesores simultáneos navegando (inicio con KPIs, calendario, proyectos, ficha, clientes).
import { check, sleep } from "k6";
import http from "k6/http";
import { ASESORES, azar, BASE, ESTADISTICAS, loginAsesor, PROPUESTAS } from "./comun.js";

const VUS = Number(__ENV.VUS || 50);
export const options = {
  scenarios: {
    panel: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: __ENV.SUBIDA || "30s", target: VUS },
        { duration: __ENV.SOSTENIDO || "4m", target: VUS },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    "http_req_duration{tipo:panel}": ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ESTADISTICAS,
};

export function setup() {
  return ASESORES.map((a) => ({ cookie: loginAsesor(a), org: a.org }));
}

export default function (sesiones) {
  const s = sesiones[(__VU - 1) % sesiones.length];
  const propias = PROPUESTAS.filter((p) => p.org === s.org);
  const pid = propias[Math.floor(Math.random() * propias.length)].id;
  const rutas = [
    ["/panel", "Cobrado este mes"],
    ["/panel/tesis/calendario", "Calendario"],
    ["/panel/tesis/propuestas", "Propuestas"],
    [`/panel/tesis/propuestas/${pid}`, "Cronograma"],
    ["/panel/cobros/clientes", "Clientes"],
  ];
  for (const [ruta, texto] of rutas) {
    const r = http.get(`${BASE}${ruta}`, { headers: { Cookie: s.cookie }, tags: { tipo: "panel", ruta: ruta.replace(/[0-9a-f-]{36}/, ":id") }, redirects: 0 });
    check(r, { [`panel ${ruta.replace(/[0-9a-f-]{36}/, ":id")} 200`]: (x) => x.status === 200 && (x.body || "").includes(texto) });
    sleep(azar(1, 3));
  }
}
