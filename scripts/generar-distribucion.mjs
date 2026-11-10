import { existsSync } from "node:fs";
import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destino = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(raiz, "entregables", "Truco-1.0.0");
const archivos = [
  ".env.example",
  ".gitignore",
  ".nvmrc",
  "package.json",
  "package-lock.json",
  "tsconfig.base.json",
  "tsconfig.json",
  "INSTALAR_TRUCO.bat",
  "JUGAR_TRUCO.bat",
  "INSTRUCCIONES_WINDOWS.md",
  "apps/web/index.html",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
  "apps/web/vite.config.js",
  "apps/server/package.json",
  "apps/server/tsconfig.json",
  "apps/server/prisma7.config.ts",
  "packages/game-engine/package.json",
  "packages/game-engine/tsconfig.json",
  "packages/shared/package.json",
  "packages/shared/tsconfig.json",
  "scripts/lanzar-truco-local.mjs",
];
const directorios = [
  "apps/web/src",
  "apps/server/prisma",
  "apps/server/src",
  "packages/game-engine/src",
  "packages/shared/src",
];
const excluidos = new Set([
  ".git",
  ".local",
  "dist",
  "dist-types",
  "generated",
  "logs",
  "node_modules",
]);

function incluir(origen) {
  const nombre = origen.split(/[\\/]/).at(-1) ?? "";
  return (
    !excluidos.has(nombre) &&
    !nombre.endsWith(".tsbuildinfo") &&
    !/\.(db|sqlite|sqlite3)(?:-|$)/i.test(nombre) &&
    nombre !== "skills-lock.json"
  );
}

async function copiar(relativa) {
  const origen = resolve(raiz, relativa);
  if (!existsSync(origen)) throw new Error(`Falta el archivo requerido: ${relativa}`);
  const salida = resolve(destino, relativa);
  await mkdir(dirname(salida), { recursive: true });
  await cp(origen, salida, { recursive: (await stat(origen)).isDirectory(), filter: incluir });
}

if (existsSync(destino)) {
  throw new Error(`El destino ya existe y no será sobrescrito: ${destino}`);
}
await mkdir(destino, { recursive: true });
for (const archivo of archivos) await copiar(archivo);
for (const directorio of directorios) await copiar(directorio);
console.log(`Distribución preparada en: ${destino}`);
