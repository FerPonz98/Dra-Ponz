// Escenario 4 — Pico: 1.000 usuarios mezclados durante 2 minutos (70 % landing, 20 % portal, 10 % panel).
import { check, sleep } from "k6";
import http from "k6/http";
import { ASESORES, azar, BASE, entrarPortal, ESTADISTICAS, ESTUDIANTES, loginAsesor, PROPUESTAS } from "./comun.js";

const TOTAL = Number(__ENV.VUS || 1000);
const etapas = (n) => [
  { duration: "30s", target: n },
  { duration: __ENV.SOSTENIDO || "2m", target: n },
  { duration: "10s", target: 0 },
];
export const options = {
  scenarios: {
    landing: { executor: "ramping-vus", exec: "landing", startVUs: 0, stages: etapas(Math.round(TOTAL * 0.7)), gracefulRampDown: "10s" },
    portal: { executor: "ramping-vus", exec: "portal", startVUs: 0, stages: etapas(Math.round(TOTAL * 0.2)), gracefulRampDown: "10s" },
    panel: { executor: "ramping-vus", exec: "panel", startVUs: 0, stages: etapas(Math.round(TOTAL * 0.1)), gracefulRampDown: "10s" },
  },
  thresholds: {
    "http_req_duration{tipo:landing}": ["p(95)<500"],
    "http_req_duration{tipo:portal}": ["p(95)<800"],
    "http_req_duration{tipo:panel}": ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
  },
  summaryTrendStats: ESTADISTICAS,
};

export function setup() {
  return ASESORES.map((a) => ({ cookie: loginAsesor(a), org: a.org }));
}

export function landing() {
  const r = http.get(`${BASE}/${Math.random() < 0.65 ? "es" : "pt"}`, { tags: { tipo: "landing" } });
  check(r, { "landing 200": (x) => x.status === 200 });
  sleep(azar(1, 3));
}

export function portal() {
  const e = ESTUDIANTES[(__VU - 1) % ESTUDIANTES.length];
  const r = entrarPortal(e);
  check(r, { "portal 200": (x) => x.status === 200 });
  sleep(azar(2, 5));
}

export function panel(sesiones) {
  const s = sesiones[(__VU - 1) % sesiones.length];
  const propias = PROPUESTAS.filter((p) => p.org === s.org);
  for (const ruta of ["/panel", "/panel/tesis/propuestas", `/panel/tesis/propuestas/${propias[0].id}`, "/panel/tesis/calendario"]) {
    const r = http.get(`${BASE}${ruta}`, { headers: { Cookie: s.cookie }, tags: { tipo: "panel" }, redirects: 0 });
    check(r, { "panel 200": (x) => x.status === 200 });
    sleep(azar(1, 3));
  }
}
