// Restaura un backup (ver DEPLOY_EASYPANEL.md → "Restaurar un backup"):
//   npm run backup:restaurar -- --db /data/backups/db_AAAA-MM-DD_HHMM.dump.enc --archivos /data/backups/archivos_….tar.gz.enc --si
// Descifra con BACKUP_ENCRYPTION_KEY, restaura la base (pg_restore --clean sobre DATABASE_URL_OWNER), vuelve a aplicar
// migraciones y permisos del rol de la app, y extrae los archivos en la carpeta padre de UPLOAD_DIR.
// ⚠ Reemplaza los datos actuales: exige --si.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { correr, descifrarArchivo, esperarPostgres, log, urlDueno } from "./comun";
import { migrarProduccion } from "./migraciones";

function arg(nombre: string) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const db = arg("db");
  const archivos = arg("archivos");
  if (!db && !archivos) throw new Error("Indica --db <archivo .dump.enc> y/o --archivos <archivo .tar.gz.enc>");
  if (!process.argv.includes("--si")) throw new Error("Esto REEMPLAZA los datos actuales. Si estás seguro, agrega --si");
  const clave = process.env.BACKUP_ENCRYPTION_KEY ?? "";
  const tmp = await mkdtemp(join(tmpdir(), "restaurar-"));
  try {
    if (db) {
      const url = urlDueno();
      await esperarPostgres(url);
      const plano = join(tmp, "db.dump");
      await descifrarArchivo(db, plano, clave);
      log("Base descifrada; restaurando…");
      await correr(process.env.PG_RESTORE_BIN ?? "pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", `--dbname=${url}`, plano], { ocultar: [url] });
      await migrarProduccion(); // migraciones pendientes + rol de la app + permisos
      log("Base restaurada");
    }
    if (archivos) {
      const destino = dirname(process.env.UPLOAD_DIR ?? "/data/uploads");
      const plano = join(tmp, "archivos.tar.gz");
      await descifrarArchivo(archivos, plano, clave);
      await correr(process.env.TAR_BIN ?? "tar", ["-xzf", plano, "-C", destino]);
      log(`Archivos restaurados en ${destino}`);
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
