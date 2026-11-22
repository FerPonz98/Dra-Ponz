import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { organizaciones, roles } from "@/core/db/schema";
import { dbApp, withAdmin, withOrg } from "@/lib/db";
import { crearOrgsDePrueba } from "./ayudas";

describe("RLS: aislamiento entre organizaciones", () => {
  let A: string;
  let B: string;
  let borrar: () => Promise<unknown>;

  beforeAll(async () => {
    const r = await crearOrgsDePrueba(2);
    [A, B] = r.orgs.map((o) => o.id);
    borrar = r.borrar;
    await withAdmin((tx) =>
      tx.insert(roles).values([
        { organizacionId: A, nombre: "Rol secreto A" },
        { organizacionId: B, nombre: "Rol secreto B" },
      ]),
    );
  });
  afterAll(async () => borrar());

  it("la conexión de la app no es superusuario ni omite RLS", async () => {
    const r = await dbApp().execute<{ rolsuper: boolean; rolbypassrls: boolean }>(
      sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("la organización A no puede leer datos de la organización B", async () => {
    const filas = await withOrg(A, (tx) => tx.select().from(roles));
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.every((f) => f.organizacionId === A)).toBe(true);
    expect(filas.some((f) => f.nombre === "Rol secreto B")).toBe(false);

    const orgsVisibles = await withOrg(A, (tx) => tx.select().from(organizaciones));
    expect(orgsVisibles.map((o) => o.id)).toEqual([A]);
  });

  it("la organización A no puede escribir filas para B", async () => {
    await expect(withOrg(A, (tx) => tx.insert(roles).values({ organizacionId: B, nombre: "Intruso" }))).rejects.toThrow();
  });

  it("sin organización en la sesión no se ve nada", async () => {
    const filas = await dbApp().select().from(roles);
    expect(filas).toHaveLength(0);
  });

  it("el valor de app.organizacion_id no se filtra entre transacciones del pool", async () => {
    await withOrg(A, async () => undefined);
    const r = await dbApp().execute<{ v: string | null }>(sql`select nullif(current_setting('app.organizacion_id', true), '') as v`);
    expect(r.rows[0].v).toBeNull();
  });
});
