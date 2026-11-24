// Arranque del servidor (solo runtime Node): valida las variables de entorno y que UPLOAD_DIR exista y se pueda
// escribir. Si algo falla, el proceso TERMINA (código 1) con un mensaje claro: Easypanel marca el deploy como
// fallido y el motivo queda en los logs, en vez de un servidor a medias.
import { verificarDirectorioSubidas } from "./core/archivos";
import { validarEntorno } from "./lib/entorno";

export async function arrancar() {
  try {
    validarEntorno("app");
    const dir = await verificarDirectorioSubidas();
    console.log(`✓ Entorno válido · archivos en ${dir}`);
  } catch (e) {
    console.error(`\n✗ No se puede arrancar la app:\n${(e as Error).message}\n`);
    process.exit(1);
  }
}
