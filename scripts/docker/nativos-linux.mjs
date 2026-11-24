// Red de seguridad para el build de Docker (Linux glibc), después de `npm ci`: instala los binarios nativos que falten
// (bug de npm con dependencias opcionales de otra plataforma, npm/cli#4828), con la MISMA versión que pide el
// package-lock.json. Normalmente no instala nada: el lockfile ya los trae como optionalDependencies.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const arch = { x64: "x64", arm64: "arm64" }[process.arch];
if (process.platform !== "linux" || !arch) {
  console.log(`nativos-linux: ${process.platform}/${process.arch}, nada que hacer`);
  process.exit(0);
}

const lock = JSON.parse(readFileSync("package-lock.json", "utf8")).packages;
// [paquete que lo pide, binario nativo para esta arquitectura]
const nativos = [
  ["@tailwindcss/oxide", `@tailwindcss/oxide-linux-${arch}-gnu`],
  ["lightningcss", `lightningcss-linux-${arch}-gnu`],
  ["next", `@next/swc-linux-${arch}-gnu`],
  ["sharp", `@img/sharp-linux-${arch}`],
  ["sharp", `@img/sharp-libvips-linux-${arch}`],
];

const faltan = [];
for (const [padre, binario] of nativos) {
  const version = lock[`node_modules/${padre}`]?.optionalDependencies?.[binario];
  if (!version) throw new Error(`nativos-linux: ${padre} no declara ${binario} en package-lock.json`);
  const instalado = existsSync(`node_modules/${binario}/package.json`)
    ? JSON.parse(readFileSync(`node_modules/${binario}/package.json`, "utf8")).version
    : null;
  if (instalado !== version) faltan.push(`${binario}@${version}`);
}

if (faltan.length === 0) {
  console.log("nativos-linux: todos los binarios nativos están instalados");
} else {
  console.log(`nativos-linux: instalando ${faltan.join(", ")}`);
  execFileSync("npm", ["install", "--no-save", "--no-audit", "--no-fund", ...faltan], { stdio: "inherit" });
}
