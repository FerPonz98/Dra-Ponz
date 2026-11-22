import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/core/db/schema.ts", "./src/modules/cobros/schema.ts", "./src/modules/tesis/schema.ts"],
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_ADMIN_URL! },
  strict: true,
  verbose: true,
});
