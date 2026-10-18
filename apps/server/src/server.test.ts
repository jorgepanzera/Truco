import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer as createTcpServer } from "node:net";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { leerConfiguracion } from "./config.js";
import { crearServidor } from "./server.js";

test("configuración: valores por defecto y puertos válidos", () => {
  assert.deepEqual(leerConfiguracion({}), { host: "127.0.0.1", puerto: 3000 });
  assert.deepEqual(
    leerConfiguracion({ TRUCO_SERVER_HOST: "localhost", TRUCO_SERVER_PORT: "1234" }),
    { host: "localhost", puerto: 1234 },
  );
  assert.equal(leerConfiguracion({ TRUCO_SERVER_PORT: "0" }).puerto, 0);
  assert.equal(leerConfiguracion({ TRUCO_SERVER_PORT: "65535" }).puerto, 65535);
});

test("configuración: rechaza valores inválidos", () => {
  for (const puerto of ["", "-1", "65536", "1.5", "abc", " 3000", "9007199254740992"]) {
    assert.throws(() => leerConfiguracion({ TRUCO_SERVER_PORT: puerto }), /TRUCO_SERVER_PORT/);
  }
  for (const host of ["", "  ", " localhost"]) {
    assert.throws(() => leerConfiguracion({ TRUCO_SERVER_HOST: host }), /TRUCO_SERVER_HOST/);
  }
});

test("el ejecutable rechaza configuración inválida sin iniciar", () => {
  const resultado = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./main.js", import.meta.url))],
    {
      env: { ...process.env, TRUCO_SERVER_PORT: "invalid" },
      encoding: "utf8",
    },
  );
  assert.notEqual(resultado.status, 0);
  assert.match(resultado.stderr, /Configuración inválida:.*TRUCO_SERVER_PORT/);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  test(`el manejador ${signal} cierra el proceso después de iniciar`, () => {
    const entrada = fileURLToPath(new URL("./main.js", import.meta.url));
    const script = `import { pathToFileURL } from 'node:url'; await import(pathToFileURL(process.argv[1]).href); setTimeout(() => process.emit('${signal}'), 200);`;
    const resultado = spawnSync(process.execPath, ["--input-type=module", "-e", script, entrada], {
      env: { ...process.env, TRUCO_SERVER_HOST: "127.0.0.1", TRUCO_SERVER_PORT: "0" },
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(resultado.status, 0, resultado.stderr);
    assert.match(resultado.stdout, /Servidor escuchando/);
    assert.match(resultado.stdout, /Servidor detenido/);
  });
}

test("servidor HTTP: salud, errores y cierre liberan el puerto", async () => {
  const servidor = crearServidor();
  assert.equal(servidor.listening, false);
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const url = `http://127.0.0.1:${direccion.port}`;
  const databaseUrlAnterior = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "url-invalida-para-verificar-aislamiento";
  try {
    const salud = await fetch(`${url}/health`);
    assert.equal(salud.status, 200);
    assert.equal(salud.headers.get("content-type"), "application/json");
    assert.deepEqual(await salud.json(), { status: "ok", service: "truco-server" });

    const inexistente = await fetch(`${url}/inexistente`);
    assert.equal(inexistente.status, 404);
    await inexistente.arrayBuffer();

    const metodo = await fetch(`${url}/health`, { method: "POST" });
    assert.equal(metodo.status, 405);
    assert.equal(metodo.headers.get("allow"), "GET");
    await metodo.arrayBuffer();
  } finally {
    if (databaseUrlAnterior === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = databaseUrlAnterior;
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve())),
    );
  }
  assert.equal(servidor.listening, false);
  const pruebaPuerto = createTcpServer();
  pruebaPuerto.listen(direccion.port, "127.0.0.1");
  await once(pruebaPuerto, "listening");
  await new Promise<void>((resolve, reject) =>
    pruebaPuerto.close((error) => (error ? reject(error) : resolve())),
  );
});
