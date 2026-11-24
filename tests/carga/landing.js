// Escenario 1 — Landing: de 0 a 500 visitantes simultáneos en 2 minutos y 5 minutos sostenidos (/es y /pt).
//   .herramientas\k6\…\k6.exe run tests/carga/landing.js
import { check, sleep } from "k6";
import http from "k6/http";
import { azar, BASE, ESTADISTICAS } from "./comun.js";

const VUS = Number(__ENV.VUS || 500);
export const options = {
  scenarios: {
    landing: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: __ENV.SUBIDA || "2m", target: VUS },
        { duration: __ENV.SOSTENIDO || "5m", target: VUS },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    "http_req_duration{tipo:landing}": ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ESTADISTICAS,
};

export default function () {
  const idioma = Math.random() < 0.65 ? "es" : "pt";
  const r = http.get(`${BASE}/${idioma}`, { tags: { tipo: "landing" } });
  check(r, { "200": (x) => x.status === 200, "tiene el título": (x) => (x.body || "").includes("<h1") });
  sleep(azar(1, 3)); // lee la página
}
