import "dotenv/config";
import { afterAll } from "vitest";
import { cerrarPools } from "@/lib/db";

afterAll(async () => {
  await cerrarPools();
});
