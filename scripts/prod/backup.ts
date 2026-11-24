// Backup (lo corre el worker a las 02:00 America/La_Paz, o a mano: npm run worker -- --una-vez backup):
// 1) pg_dump (formato custom) de la base con el rol dueño   2) tar.gz de UPLOAD_DIR
// 3) cifra ambos con BACKUP_ENCRYPTION_KEY (AES-256-GCM) y borra los temporales   4) rota a BACKUP_DIAS en BACKUP_DIR
// 5) copia fuera del servidor con rclone (RCLONE_REMOTE + variables RCLONE_CONFIG_*); si falta, solo local y avisa.
import { chmod, mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { aviso, cifrarArchivo, correr, log, urlDueno } from "./comun";

const PG_DUMP = () => process.env.PG_DUMP_BIN ?? "pg_dump";
const TAR = () => process.env.TAR_BIN ?? "tar";

/** Fecha y hora de La Paz para el nombre del archivo: 2026-11-24_0200 */
function sello(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}_${p.hour === "24" ? "00" : p.hour}${p.minute}`;
}

export async function hacerBackup() {
  const clave = process.env.BACKUP_ENCRYPTION_KEY ?? "";
  const dir = process.env.BACKUP_DIR ?? "/data/backups";
  const uploads = process.env.UPLOAD_DIR ?? "/data/uploads";
  const dias = Number(process.env.BACKUP_DIAS ?? 14);
  const f = sello();
  await mkdir(dir, { recursive: true });
  const db = join(dir, `db_${f}.dump`);
  const tar = join(dir, `archivos_${f}.tar.gz`);
  const resultado: { archivos: string[]; borradosPorRotacion: number; copiaExterna: string } = { archivos: [], borradosPorRotacion: 0, copiaExterna: "no" };
  try {
    // 1) Base de datos (la contraseña va en la URL: se oculta en los mensajes de error)
    const url = urlDueno();
    await correr(PG_DUMP(), ["--format=custom", "--no-owner", "--no-privileges", `--file=${db}`, `--dbname=${url}`], { ocultar: [url] });
    // 2) Archivos subidos
    await correr(TAR(), ["-czf", tar, "-C", dirname(uploads), basename(uploads)]);
    // 3) Cifrado
    for (const plano of [db, tar]) {
      await cifrarArchivo(plano, `${plano}.enc`, clave);
      await chmod(`${plano}.enc`, 0o600).catch(() => undefined);
      resultado.archivos.push(`${basename(plano)}.enc (${Math.round((await stat(`${plano}.enc`)).size / 1024)} KB)`);
    }
  } finally {
    await rm(db, { force: true });
    await rm(tar, { force: true });
  }
  // 4) Rotación local
  const limite = Date.now() - dias * 86_400_000;
  for (const nombre of await readdir(dir)) {
    if (!/^(db|archivos)_\d{4}-\d{2}-\d{2}_\d{4}\.(dump|tar\.gz)\.enc$/.test(nombre)) continue;
    if ((await stat(join(dir, nombre))).mtimeMs < limite) {
      await rm(join(dir, nombre));
      resultado.borradosPorRotacion++;
    }
  }
  // 5) Copia fuera del servidor
  const remoto = process.env.RCLONE_REMOTE;
  if (remoto) {
    await correr(process.env.RCLONE_BIN ?? "rclone", ["copy", dir, remoto, "--include", `*_${f}.*`, "--transfers", "2"]);
    await correr(process.env.RCLONE_BIN ?? "rclone", ["delete", remoto, "--min-age", `${dias}d`, "--include", "*.enc"]);
    resultado.copiaExterna = remoto;
  } else {
    aviso("RCLONE_REMOTE vacío: el backup quedó SOLO en este servidor. Configura un remoto (ver DEPLOY_EASYPANEL.md).");
  }
  log("Backup listo", resultado);
  return resultado;
}
