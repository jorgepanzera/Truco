// Diagnóstico aislado: el esquema y las migraciones se copian a un directorio temporal propio.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const prismaCli = path.join(
  path.dirname(require.resolve("prisma/package.json")),
  "build",
  "index.js",
);
const prismaConfig = pathToFileURL(require.resolve("prisma/config")).href;
const tempRoot = path.resolve(tmpdir());
const dir = mkdtempSync(path.join(tempRoot, "truco-prisma-diagnostic-"));

try {
  for (const command of ["deploy", "dev"]) {
    for (const level of ["warn", "info"]) {
      const experiment = path.join(dir, `${command}-${level}`);
      cpSync(path.join(root, "apps/server/prisma"), path.join(experiment, "prisma"), {
        recursive: true,
        filter: (source) => !/\.(?:db|sqlite|sqlite3)(?:-.*)?$/i.test(source),
      });
      writeFileSync(
        path.join(experiment, "prisma7.config.ts"),
        `import { defineConfig } from ${JSON.stringify(prismaConfig)};\nexport default defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations" }, datasource: { url: process.env.DATABASE_URL! } });\n`,
      );
      const db = path.join(experiment, "test.sqlite").replaceAll("\\", "/");
      const result = spawnSync(process.execPath, [prismaCli, "migrate", command], {
        cwd: experiment,
        env: { ...process.env, DATABASE_URL: `file:${db}`, RUST_LOG: level },
        encoding: "utf8",
        timeout: 30000,
      });
      console.log(`\n${command} RUST_LOG=${level}: código ${result.status ?? "sin salida"}`);
      console.log(result.stdout.trim());
      if (result.stderr.trim()) console.log(result.stderr.trim());
      if (result.error) console.log(result.error.message);
    }
  }
} finally {
  const relative = path.relative(tempRoot, dir);
  if (!relative.startsWith("truco-prisma-diagnostic-") || relative.includes(path.sep)) {
    console.error("Directorio temporal inesperado: no se elimina");
    process.exitCode = 1;
  } else {
    rmSync(dir, { recursive: true });
  }
}
