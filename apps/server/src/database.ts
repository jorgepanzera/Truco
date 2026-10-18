import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client.js";
import { obtenerDatabaseUrl } from "./database-url.js";

/** No conecta hasta que el consumidor realice una consulta o llame a $connect. */
export function crearClientePrisma(env: NodeJS.ProcessEnv = process.env): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: obtenerDatabaseUrl(env) });
  return new PrismaClient({ adapter });
}

export async function cerrarClientePrisma(cliente: PrismaClient): Promise<void> {
  await cliente.$disconnect();
}
