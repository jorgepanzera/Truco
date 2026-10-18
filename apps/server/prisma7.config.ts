import { defineConfig } from "prisma/config";
import { obtenerDatabaseUrl } from "./src/database-url.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: obtenerDatabaseUrl(process.env) },
});
