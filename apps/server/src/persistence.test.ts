import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { obtenerDatabaseUrl } from "./database-url.js";
import { cerrarClientePrisma, crearClientePrisma } from "./database.js";

const servidor = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const prismaCli = join(dirname(require.resolve("prisma/package.json")), "build", "index.js");

test("URL SQLite local y resolución estable", () => {
  assert.equal(
    obtenerDatabaseUrl({}),
    `file:${join(servidor, "prisma", "dev.db").replaceAll("\\", "/")}`,
  );
  assert.equal(
    obtenerDatabaseUrl({ DATABASE_URL: "file:./prisma/dev.db" }),
    obtenerDatabaseUrl({}),
  );
  for (const url of ["", "file:", "https://example.com/db", "file:db?mode=memory"]) {
    assert.throws(() => obtenerDatabaseUrl({ DATABASE_URL: url }), /DATABASE_URL/);
  }
  assert.ok(existsSync(join(servidor, "src", "generated", "prisma", "client.ts")));
});

test("migración y persistencia sobre SQLite temporal aislada", async () => {
  const dir = mkdtempSync(join(tmpdir(), "truco-prisma-test-"));
  const db = join(dir, "prueba.sqlite");
  // En Windows Prisma 7 puede devolver un error vacío del motor sin logging activado.
  const env = {
    ...process.env,
    RUST_LOG: "info",
    DATABASE_URL: `file:${db.replaceAll("\\", "/")}`,
  };
  try {
    for (let intento = 0; intento < 2; intento++) {
      const migracion = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
        cwd: servidor,
        env,
        encoding: "utf8",
        timeout: 30000,
      });
      assert.equal(migracion.status, 0, `${migracion.stdout}\n${migracion.stderr}`);
    }
    assert.ok(existsSync(db));
    const primerCliente = crearClientePrisma(env);
    let id: number;
    try {
      const registro = await primerCliente.infrastructureProbe.create({
        data: { value: "verificación temporal" },
      });
      id = registro.id;
    } finally {
      await cerrarClientePrisma(primerCliente);
    }
    const segundoCliente = crearClientePrisma(env);
    try {
      const registro = await segundoCliente.infrastructureProbe.findUniqueOrThrow({
        where: { id },
      });
      assert.equal(registro.value, "verificación temporal");
    } finally {
      await cerrarClientePrisma(segundoCliente);
    }
  } finally {
    // Solo se eliminan archivos con nombres conocidos dentro del directorio creado por esta prueba.
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      const archivo = `${db}${suffix}`;
      if (existsSync(archivo)) unlinkSync(archivo);
    }
    rmdirSync(dir);
  }
});
