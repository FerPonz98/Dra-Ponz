// Utilidades comunes de los escenarios de k6 (k6.exe nativo de Windows; sin WSL ni Docker).
// Datos: .data/carga/credenciales.json (tests/carga/sembrar.ts). Objetivo: BASE_URL (por defecto localhost:3500).
import { parseHTML } from "k6/html";
import http from "k6/http";
import { SharedArray } from "k6/data";

export const BASE = (__ENV.BASE_URL || "http://127.0.0.1:3500").replace(/\/$/, "");
// Seguridad: solo localhost o una URL de pruebas indicada explícitamente. Nunca producción ni terceros.
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE) && __ENV.URL_DE_PRUEBAS_AUTORIZADA !== BASE) {
  throw new Error(`BASE_URL no permitida: ${BASE}. Para el VPS de pruebas define URL_DE_PRUEBAS_AUTORIZADA con la misma URL.`);
}

const datos = () => JSON.parse(open("../../.data/carga/credenciales.json"));
export const ASESORES = new SharedArray("asesores", () => datos().asesores);
export const ESTUDIANTES = new SharedArray("estudiantes", () => datos().estudiantes);
export const PROPUESTAS = new SharedArray("propuestas", () => datos().propuestas);

export const ESTADISTICAS = ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max", "count"];
export const azar = (min, max) => min + Math.random() * (max - min);

/** Inicia sesión de un asesor y devuelve la cabecera Cookie. */
export function loginAsesor(a) {
  const r = http.post(`${BASE}/api/auth/sign-in/email`, JSON.stringify({ email: a.correo, password: a.clave }), {
    headers: { "Content-Type": "application/json", Origin: BASE },
    tags: { tipo: "login" },
  });
  const c = r.cookies["cobros.session_token"];
  if (r.status !== 200 || !c || !c.length) throw new Error(`login ${a.correo}: ${r.status} ${r.body && r.body.slice(0, 120)}`);
  return `cobros.session_token=${c[0].value}`;
}

function multipart(campos) {
  const limite = `----k6${Math.random().toString(36).slice(2)}`;
  let cuerpo = "";
  for (const [k, v] of campos) cuerpo += `--${limite}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  return { cuerpo: `${cuerpo}--${limite}--\r\n`, tipo: `multipart/form-data; boundary=${limite}` };
}

/** Entra al portal como lo haría un navegador sin JS: abre el enlace y envía el formulario con el CI. */
export function entrarPortal(e) {
  const pagina = http.get(`${BASE}/p/${e.token}`, { tags: { tipo: "portal" } });
  if (pagina.body.includes("Ya pagué, subir comprobante")) return pagina; // la cookie del portal sigue vigente
  const campos = [];
  parseHTML(pagina.body)
    .find("form input[type=hidden]")
    .each((_, el) => campos.push([el.attributes().name.value, (el.attributes().value || { value: "" }).value]));
  campos.push(["credencial", e.ci]);
  const m = multipart(campos);
  return http.post(`${BASE}/p/${e.token}`, m.cuerpo, { headers: { "Content-Type": m.tipo, Origin: BASE, Accept: "text/html" }, tags: { tipo: "portal-login" } });
}

/** PDF de 2–5 MB con una marca única (para verificar después que nada se mezcló ni corrompió). */
export function pdfConMarca(marca) {
  const tam = Math.floor(azar(2, 5) * 1024 * 1024);
  const b = new Uint8Array(tam);
  const cab = `%PDF-1.4\n%MARCA:${marca}:${tam}\n`;
  for (let i = 0; i < cab.length; i++) b[i] = cab.charCodeAt(i);
  for (let i = cab.length; i < tam; i++) b[i] = 32 + ((i * 31) % 90);
  return b.buffer;
}
