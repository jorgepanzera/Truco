import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Tanto src como dist están directamente dentro de apps/server.
const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function obtenerDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const url = env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:") || url.length === 5 || url.includes("?") || url.includes("#")) {
    throw new Error(
      "DATABASE_URL debe ser una ruta SQLite local con prefijo file:, sin parámetros.",
    );
  }
  const ruta = url.slice(5);
  const absoluta = isAbsolute(ruta) ? ruta : resolve(serverDir, ruta);
  return `file:${absoluta.replaceAll("\\", "/")}`;
}
