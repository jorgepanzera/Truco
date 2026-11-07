import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer as createTcpServer } from "node:net";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import { tieneFlor } from "@truco/game-engine";
import type { Carta } from "@truco/shared";
import { leerConfiguracion } from "./config.js";
import { crearServidor } from "./server.js";
import { RepositorioPartidasEnMemoria } from "./matches.js";

test("6C.6: partida contra máquina inicia sin espera y no expone su mano", () => {
  const repositorio = new RepositorioPartidasEnMemoria({ enteroInclusivo: () => 0 });
  const sesionCreada = repositorio.crearSesion("Ana");
  const humano = repositorio.autenticar(sesionCreada.token);
  const partida = repositorio.crearPartida(humano, 30, true);
  const snapshot = repositorio.snapshot(partida.id, humano);
  assert.equal(snapshot.estado, "iniciada");
  assert.equal(snapshot.metaPuntos, 30);
  assert.equal(snapshot.participantes.length, 2);
  assert.equal(snapshot.participantes[1]?.automatico, true);
  assert.equal(snapshot.cartasPropias.length, 3);
  assert.equal(JSON.stringify(snapshot).includes("__maquina__"), false);
});

test("6C.6: el servidor invoca una política inyectada sólo con acciones legales", () => {
  let llamadas = 0;
  const repositorio = new RepositorioPartidasEnMemoria(
    { enteroInclusivo: () => 0 },
    {
      decidir: ({ accionesLegales }) => {
        llamadas += 1;
        return (
          accionesLegales.find((accion) => accion.tipo === "anunciar-flor") ??
          accionesLegales.find((accion) => accion.tipo === "jugar-carta") ??
          accionesLegales[0] ??
          null
        );
      },
    },
  );
  const creada = repositorio.crearSesion("Ana");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  const snapshot = repositorio.snapshot(partida.id, humano);
  assert.ok(llamadas > 0);
  assert.equal(snapshot.estado, "iniciada");
  assert.equal(JSON.stringify(snapshot).includes("__maquina__"), false);
});

test("6C.6: retiro conserva oportunidad de Flor y no bloquea el avance", () => {
  const repositorio = new RepositorioPartidasEnMemoria(
    { enteroInclusivo: () => 0 },
    {
      decidir: ({ accionesLegales }) =>
        accionesLegales.find((a) => a.tipo === "irse-al-mazo") ?? accionesLegales[0] ?? null,
    },
  );
  const creada = repositorio.crearSesion("Ana");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 30, true);
  let version = repositorio.snapshot(partida.id, humano).version;
  let cierres = 0;
  for (let intento = 0; intento < 2; intento++) {
    const snapshot = repositorio.snapshot(partida.id, humano);
    assert.equal(snapshot.estado, "iniciada");
    const resultado = repositorio.aplicarAccion(partida.id, humano, {
      actionId: `mazo-${intento}`,
      expectedVersion: snapshot.version,
      action: snapshot.desafiosPendientes.oportunidadFlorPropia
        ? { type: "announce-flor" }
        : { type: "go-to-mazo" },
    });
    assert.equal(resultado.aceptada, true, resultado.codigo);
    assert.ok(resultado.version > version);
    version = resultado.version;
    cierres += 1;
  }
  assert.ok(cierres > 0);
});

test("6C.6-R2: humano y máquina juegan cartas reglamentarias mediante bazas", () => {
  const repositorio = new RepositorioPartidasEnMemoria(
    { enteroInclusivo: () => 0 },
    {
      decidir: ({ accionesLegales }) =>
        accionesLegales.find((a) => a.tipo === "anunciar-flor") ??
        accionesLegales.find((a) => a.tipo === "jugar-carta") ??
        accionesLegales.find((a) => a.tipo.startsWith("no-quiero")) ??
        null,
    },
  );
  const creada = repositorio.crearSesion("Ana");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  let jugadasHumanas = 0;
  let cartasPublicasMaximas = 0;
  let versionAnterior = 0;
  for (let paso = 0; paso < 8; paso++) {
    const snapshot = repositorio.snapshot(partida.id, humano);
    assert.equal(snapshot.estado, "iniciada");
    cartasPublicasMaximas = Math.max(cartasPublicasMaximas, snapshot.cartasJugadas.length);
    assert.ok(snapshot.version >= versionAnterior);
    versionAnterior = snapshot.version;
    if (snapshot.turno !== snapshot.asientoPropio) continue;
    const carta = snapshot.cartasPropias[0];
    assert.ok(carta);
    const resultado = repositorio.aplicarAccion(partida.id, humano, {
      actionId: `carta-${paso}`,
      expectedVersion: snapshot.version,
      action: { type: "play-card", card: carta },
    });
    assert.equal(resultado.aceptada, true, resultado.codigo);
    jugadasHumanas += 1;
  }
  const final = repositorio.snapshot(partida.id, humano);
  assert.equal(final.estado, "iniciada");
  assert.ok(jugadasHumanas > 0);
  assert.ok(repositorio.metricasPrueba(partida.id, humano).cartas >= jugadasHumanas);
  assert.equal(JSON.stringify(final).includes("__maquina__"), false);
});

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

test("API 6A: sesiones, asientos, inicio canónico y snapshots privados", async () => {
  const servidor = crearServidor({ aleatoriedad: { enteroInclusivo: () => 0 } });
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const url = `http://127.0.0.1:${direccion.port}`;
  const json = async (ruta: string, init?: RequestInit): Promise<Response> =>
    fetch(`${url}${ruta}`, init);
  const crearSesion = async (nickname: string): Promise<{ token: string; apodo: string }> => {
    const respuesta = await json("/api/guest-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    assert.equal(respuesta.status, 201);
    return (await respuesta.json()) as { token: string; apodo: string };
  };
  const autenticado = (token: string) => ({ Authorization: `Bearer ${token}` });
  try {
    const apodoInvalido = await json("/api/guest-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "x!" }),
    });
    assert.equal(apodoInvalido.status, 400);
    assert.equal(
      (
        await json("/api/guest-sessions", {
          method: "POST",
          body: "{",
        })
      ).status,
      400,
    );
    assert.equal((await json("/api/guest-sessions")).status, 405);

    const ana = await crearSesion("Ana Ñandú");
    const beto = await crearSesion("Beto_2");
    const carla = await crearSesion("Carla-3");
    assert.notEqual(ana.token, beto.token);
    assert.equal(ana.apodo, "Ana Ñandú");
    assert.equal(
      (
        await json("/api/matches", {
          method: "POST",
          body: JSON.stringify({}),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await json("/api/matches", {
          method: "POST",
          headers: { Authorization: "Bearer no-existe", "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      ).status,
      401,
    );

    const creada = await json("/api/matches", {
      method: "POST",
      headers: { ...autenticado(ana.token), "Content-Type": "application/json" },
      body: JSON.stringify({ targetScore: 30 }),
    });
    assert.equal(creada.status, 201);
    const partido = (await creada.json()) as {
      matchId: string;
      asiento: number;
      snapshot: { estado: string; metaPuntos: number; participantes: unknown[] };
    };
    assert.equal(partido.asiento, 0);
    assert.equal(partido.snapshot.estado, "esperando");
    assert.equal(partido.snapshot.metaPuntos, 30);
    assert.equal(partido.snapshot.participantes.length, 1);
    assert.equal(
      (
        await json("/api/matches", {
          method: "POST",
          headers: { ...autenticado(ana.token), "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: "suplantado" }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await json(`/api/matches/${partido.matchId}/start`, {
          method: "POST",
          headers: autenticado(ana.token),
        })
      ).status,
      409,
    );
    const reingreso = await json(`/api/matches/${partido.matchId}/join`, {
      method: "POST",
      headers: autenticado(ana.token),
    });
    assert.equal(reingreso.status, 200);
    assert.equal(((await reingreso.json()) as { asiento: number }).asiento, 0);

    const ingreso = await json(`/api/matches/${partido.matchId}/join`, {
      method: "POST",
      headers: autenticado(beto.token),
    });
    assert.equal(ingreso.status, 200);
    assert.equal(((await ingreso.json()) as { asiento: number }).asiento, 1);
    assert.equal(
      (
        await json(`/api/matches/${partido.matchId}/join`, {
          method: "POST",
          headers: autenticado(carla.token),
        })
      ).status,
      409,
    );
    assert.equal(
      (await json(`/api/matches/${partido.matchId}`, { headers: autenticado(carla.token) })).status,
      403,
    );
    assert.equal((await json(`/api/matches/${partido.matchId}`)).status, 401);

    const inicio = await json(`/api/matches/${partido.matchId}/start`, {
      method: "POST",
      headers: autenticado(beto.token),
    });
    assert.equal(inicio.status, 200);
    const snapshotBeto = (await inicio.json()) as {
      estado: string;
      repartidor: number;
      cartasPropias: unknown[];
      muestra: unknown;
      marcador: unknown[];
    };
    assert.equal(snapshotBeto.estado, "iniciada");
    assert.equal(snapshotBeto.repartidor, 0);
    assert.equal(snapshotBeto.cartasPropias.length, 3);
    assert.ok(snapshotBeto.muestra);
    assert.equal(snapshotBeto.marcador.length, 2);

    const respuestaAna = await json(`/api/matches/${partido.matchId}`, {
      headers: autenticado(ana.token),
    });
    assert.equal(respuestaAna.status, 200);
    const snapshotAna = (await respuestaAna.json()) as {
      cartasPropias: readonly unknown[];
      participantes: readonly unknown[];
      cartasJugadas: readonly unknown[];
    };
    assert.equal(snapshotAna.cartasPropias.length, 3);
    assert.notDeepEqual(snapshotAna.cartasPropias, snapshotBeto.cartasPropias);
    assert.equal(snapshotAna.participantes.length, 2);
    assert.equal(snapshotAna.cartasJugadas.length, 0);
    const serializado = JSON.stringify(snapshotAna);
    assert.doesNotMatch(serializado, /canonico|restantes|entregas|jugadorId|token/i);
    for (const carta of snapshotBeto.cartasPropias)
      assert.ok(!serializado.includes(JSON.stringify(carta)));
    const accesoAjenoTrasInicio = await json(`/api/matches/${partido.matchId}`, {
      headers: autenticado(carla.token),
    });
    assert.equal(accesoAjenoTrasInicio.status, 403);
    const errorAjeno = await accesoAjenoTrasInicio.text();
    assert.doesNotMatch(errorAjeno, /cartasPropias|canonico|restantes|token/i);
    assert.equal(
      (
        await json(`/api/matches/${partido.matchId}/start`, {
          method: "POST",
          headers: autenticado(ana.token),
        })
      ).status,
      409,
    );
    const repetido = await json(`/api/matches/${partido.matchId}`, {
      headers: autenticado(ana.token),
    });
    assert.deepEqual(
      ((await repetido.json()) as { cartasPropias: readonly unknown[] }).cartasPropias,
      snapshotAna.cartasPropias,
    );

    const segunda = await json("/api/matches", {
      method: "POST",
      headers: { ...autenticado(ana.token), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const segundoId = ((await segunda.json()) as { matchId: string }).matchId;
    const simultaneos = await Promise.all([
      json(`/api/matches/${segundoId}/join`, { method: "POST", headers: autenticado(beto.token) }),
      json(`/api/matches/${segundoId}/join`, { method: "POST", headers: autenticado(carla.token) }),
    ]);
    assert.deepEqual(simultaneos.map((respuesta) => respuesta.status).sort(), [200, 409]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("API 6A: inicio concurrente y fallido no duplica ni deja estado parcial", async () => {
  let fallaInicial = true;
  const servidor = crearServidor({
    aleatoriedad: {
      enteroInclusivo: (maximo) => {
        if (fallaInicial) {
          fallaInicial = false;
          return maximo + 1;
        }
        return 0;
      },
    },
  });
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const url = `http://127.0.0.1:${direccion.port}`;
  const solicitud = (ruta: string, init?: RequestInit) => fetch(`${url}${ruta}`, init);
  const crearSesion = async (nickname: string): Promise<string> => {
    const respuesta = await solicitud("/api/guest-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    assert.equal(respuesta.status, 201);
    return ((await respuesta.json()) as { token: string }).token;
  };
  const cabecera = (token: string) => ({ Authorization: `Bearer ${token}` });
  try {
    const ana = await crearSesion("Ana");
    const beto = await crearSesion("Beto");
    const carla = await crearSesion("Carla");
    const creada = await solicitud("/api/matches", { method: "POST", headers: cabecera(ana) });
    assert.equal(creada.status, 201);
    const matchId = ((await creada.json()) as { matchId: string }).matchId;
    assert.equal(
      (await solicitud(`/api/matches/${matchId}/join`, { method: "POST", headers: cabecera(beto) }))
        .status,
      200,
    );
    assert.equal(
      (
        await solicitud(`/api/matches/${matchId}/start`, {
          method: "POST",
          headers: cabecera(carla),
        })
      ).status,
      403,
    );
    assert.equal(
      (await solicitud(`/api/matches/${matchId}/start`, { method: "POST", headers: cabecera(ana) }))
        .status,
      500,
    );
    const trasFallo = await solicitud(`/api/matches/${matchId}`, { headers: cabecera(ana) });
    assert.equal(trasFallo.status, 200);
    assert.equal(((await trasFallo.json()) as { estado: string }).estado, "esperando");

    const inicios = await Promise.all([
      solicitud(`/api/matches/${matchId}/start`, { method: "POST", headers: cabecera(ana) }),
      solicitud(`/api/matches/${matchId}/start`, { method: "POST", headers: cabecera(beto) }),
    ]);
    assert.deepEqual(inicios.map((respuesta) => respuesta.status).sort(), [200, 409]);
    const exitoso = inicios.find((respuesta) => respuesta.status === 200);
    assert.ok(exitoso);
    assert.equal(((await exitoso.json()) as { estado: string }).estado, "iniciada");
  } finally {
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

async function disputarPartidaAlMazo(metaPuntos: 30 | 40): Promise<void> {
  const eleccionesSinFlor = [
    33, 25, 7, 11, 17, 22, 25, 0, 1, 28, 3, 16, 9, 12, 21, 3, 17, 17, 15, 4, 13, 4, 3, 6, 1, 11, 7,
    0, 1, 6, 7, 6, 1, 6, 5, 0, 1, 2, 1,
  ];
  const aleatoriedadPrueba = [
    0,
    ...eleccionesSinFlor,
    ...Array.from({ length: metaPuntos - 1 }, () => eleccionesSinFlor).flat(),
  ];
  let llamadaAleatoria = 0;
  const servidor = crearServidor({
    aleatoriedad: { enteroInclusivo: () => aleatoriedadPrueba[llamadaAleatoria++] ?? 0 },
  });
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const http = `http://127.0.0.1:${direccion.port}`;
  const wsUrl = `ws://127.0.0.1:${direccion.port}/ws`;
  const buzon = (socket: WebSocket) => {
    const cola: Record<string, unknown>[] = [];
    const esperas: ((mensaje: Record<string, unknown>) => void)[] = [];
    socket.on("message", (datos: Buffer) => {
      const mensaje = JSON.parse(datos.toString("utf8")) as Record<string, unknown>;
      const espera = esperas.shift();
      if (espera) espera(mensaje);
      else cola.push(mensaje);
    });
    return (): Promise<Record<string, unknown>> =>
      cola.length
        ? Promise.resolve(cola.shift()!)
        : new Promise((resolve) => esperas.push(resolve));
  };
  const crearSesion = async (nickname: string): Promise<string> => {
    const respuesta = await fetch(`${http}/api/guest-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    assert.equal(respuesta.status, 201);
    return ((await respuesta.json()) as { token: string }).token;
  };
  type SnapshotPartida = {
    version: number;
    repartidor: number;
    muestra: Carta;
    cartasPropias: Carta[];
    cartasJugadas: unknown[];
    marcador: readonly { asiento: number; puntos: number }[];
    desafiosPendientes: { envido: unknown; flor: unknown; truco: unknown };
  };
  const sockets: WebSocket[] = [];
  try {
    const ana = await crearSesion("Ana");
    const beto = await crearSesion("Beto");
    const creada = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}`, "Content-Type": "application/json" },
      body: JSON.stringify({ targetScore: metaPuntos, mode: "1v1" }),
    });
    assert.equal(creada.status, 201);
    const matchId = ((await creada.json()) as { matchId: string }).matchId;
    assert.equal(
      (
        await fetch(`${http}/api/matches/${matchId}/join`, {
          method: "POST",
          headers: { Authorization: `Bearer ${beto}` },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${http}/api/matches/${matchId}/start`, {
          method: "POST",
          headers: { Authorization: `Bearer ${ana}` },
        })
      ).status,
      200,
    );

    const socketAna = new WebSocket(wsUrl);
    const socketBeto = new WebSocket(wsUrl);
    sockets.push(socketAna, socketBeto);
    await Promise.all([once(socketAna, "open"), once(socketBeto, "open")]);
    const leerAna = buzon(socketAna);
    const leerBeto = buzon(socketBeto);
    socketAna.send(JSON.stringify({ type: "auth", token: ana }));
    socketBeto.send(JSON.stringify({ type: "auth", token: beto }));
    assert.equal((await leerAna()).type, "auth.ok");
    assert.equal((await leerBeto()).type, "auth.ok");
    socketAna.send(JSON.stringify({ type: "subscribe", matchId }));
    let snapshotAna = (await leerAna()).snapshot as SnapshotPartida;
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId }));
    let snapshotBeto = (await leerBeto()).snapshot as SnapshotPartida;
    const versionInicial = snapshotBeto.version;
    const repartidores = [snapshotBeto.repartidor];
    assert.equal(tieneFlor(snapshotAna.cartasPropias, snapshotAna.muestra), false);
    assert.equal(tieneFlor(snapshotBeto.cartasPropias, snapshotBeto.muestra), false);
    assert.deepEqual(snapshotAna.marcador, snapshotBeto.marcador);

    for (let mano = 1; mano <= metaPuntos; mano += 1) {
      const versionAnterior = snapshotBeto.version;
      socketBeto.send(
        JSON.stringify({
          type: "game.action",
          matchId,
          actionId: `mazo-${mano}`,
          expectedVersion: versionAnterior,
          action: { type: "go-to-mazo" },
        }),
      );
      const confirmacion = await leerBeto();
      assert.deepEqual(
        { type: confirmacion.type, actionId: confirmacion.actionId, version: confirmacion.version },
        { type: "game.confirmed", actionId: `mazo-${mano}`, version: versionAnterior + 1 },
      );
      snapshotBeto = (await leerBeto()).snapshot as SnapshotPartida;
      snapshotAna = (await leerAna()).snapshot as SnapshotPartida;
      assert.equal(snapshotBeto.version, versionAnterior + 1);
      assert.equal(snapshotAna.version, snapshotBeto.version);
      assert.deepEqual(snapshotAna.marcador, snapshotBeto.marcador);
      assert.equal(
        snapshotAna.marcador.reduce((total, item) => total + item.puntos, 0),
        mano,
      );
      assert.equal(snapshotBeto.desafiosPendientes.envido, null);
      assert.equal(snapshotBeto.desafiosPendientes.flor, null);
      assert.equal(snapshotBeto.desafiosPendientes.truco, null);
      for (const carta of snapshotBeto.cartasPropias)
        assert.ok(!JSON.stringify(snapshotAna).includes(JSON.stringify(carta)));

      if (mano < metaPuntos) {
        assert.notEqual(snapshotBeto.repartidor, repartidores.at(-1));
        repartidores.push(snapshotBeto.repartidor);
        assert.equal(snapshotBeto.cartasJugadas.length, 0);
        assert.equal(snapshotBeto.cartasPropias.length, 3);
        assert.equal(tieneFlor(snapshotAna.cartasPropias, snapshotAna.muestra), false);
        assert.equal(tieneFlor(snapshotBeto.cartasPropias, snapshotBeto.muestra), false);
      }
    }

    assert.equal(Math.max(...snapshotBeto.marcador.map((item) => item.puntos)), metaPuntos);
    assert.equal(snapshotBeto.repartidor, repartidores.at(-1));
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "mazo-despues-del-final",
        expectedVersion: snapshotBeto.version,
        action: { type: "go-to-mazo" },
      }),
    );
    const rechazoFinal = await leerBeto();
    assert.deepEqual(
      {
        type: rechazoFinal.type,
        actionId: rechazoFinal.actionId,
        code: rechazoFinal.code,
        version: rechazoFinal.version,
      },
      {
        type: "game.rejected",
        actionId: "mazo-despues-del-final",
        code: "partida-finalizada",
        version: snapshotBeto.version,
      },
    );
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId }));
    const trasRechazoFinal = (await leerBeto()).snapshot as SnapshotPartida;
    assert.deepEqual(
      {
        version: trasRechazoFinal.version,
        marcador: trasRechazoFinal.marcador,
        repartidor: trasRechazoFinal.repartidor,
      },
      {
        version: snapshotBeto.version,
        marcador: snapshotBeto.marcador,
        repartidor: snapshotBeto.repartidor,
      },
    );
    assert.equal(snapshotBeto.version, versionInicial + metaPuntos);
  } finally {
    await Promise.all(
      sockets
        .filter(
          (socket) =>
            socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING,
        )
        .map(
          (socket) =>
            new Promise<void>((resolve) => {
              socket.once("close", () => resolve());
              socket.close();
            }),
        ),
    );
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("WebSocket 6B.3.1: completa una partida a 30 puntos", async () => {
  await disputarPartidaAlMazo(30);
});

test("WebSocket 6B.3.2: completa una partida a 40 puntos", async () => {
  await disputarPartidaAlMazo(40);
});

async function disputarManoPorCartas(conTruco: boolean): Promise<void> {
  const eleccionesSinFlor = [
    33, 25, 7, 11, 17, 22, 25, 0, 1, 28, 3, 16, 9, 12, 21, 3, 17, 17, 15, 4, 13, 4, 3, 6, 1, 11, 7,
    0, 1, 6, 7, 6, 1, 6, 5, 0, 1, 2, 1,
  ];
  const aleatoriedadPrueba = [0, ...eleccionesSinFlor, ...eleccionesSinFlor];
  let llamadaAleatoria = 0;
  const servidor = crearServidor({
    aleatoriedad: { enteroInclusivo: () => aleatoriedadPrueba[llamadaAleatoria++] ?? 0 },
  });
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const http = `http://127.0.0.1:${direccion.port}`;
  const wsUrl = `ws://127.0.0.1:${direccion.port}/ws`;
  const buzon = (socket: WebSocket) => {
    const cola: Record<string, unknown>[] = [];
    const esperas: ((mensaje: Record<string, unknown>) => void)[] = [];
    socket.on("message", (datos: Buffer) => {
      const mensaje = JSON.parse(datos.toString("utf8")) as Record<string, unknown>;
      const espera = esperas.shift();
      if (espera) espera(mensaje);
      else cola.push(mensaje);
    });
    return (): Promise<Record<string, unknown>> =>
      cola.length
        ? Promise.resolve(cola.shift()!)
        : new Promise((resolve) => esperas.push(resolve));
  };
  const crearSesion = async (nickname: string): Promise<string> => {
    const respuesta = await fetch(`${http}/api/guest-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    return ((await respuesta.json()) as { token: string }).token;
  };
  type SnapshotMano = {
    version: number;
    repartidor: number;
    turno: number | null;
    muestra: Carta;
    cartasPropias: Carta[];
    cartasJugadas: readonly { asiento: number; carta: Carta }[];
    marcador: readonly { asiento: number; puntos: number }[];
    desafiosPendientes: { envido: unknown; flor: unknown; truco: unknown };
  };
  const sockets: WebSocket[] = [];
  try {
    const ana = await crearSesion("Ana");
    const beto = await crearSesion("Beto");
    const creada = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}`, "Content-Type": "application/json" },
      body: JSON.stringify({ targetScore: 30, mode: "1v1" }),
    });
    const matchId = ((await creada.json()) as { matchId: string }).matchId;
    await fetch(`${http}/api/matches/${matchId}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${beto}` },
    });
    await fetch(`${http}/api/matches/${matchId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    const socketAna = new WebSocket(wsUrl);
    const socketBeto = new WebSocket(wsUrl);
    sockets.push(socketAna, socketBeto);
    await Promise.all([once(socketAna, "open"), once(socketBeto, "open")]);
    const leerAna = buzon(socketAna);
    const leerBeto = buzon(socketBeto);
    socketAna.send(JSON.stringify({ type: "auth", token: ana }));
    socketBeto.send(JSON.stringify({ type: "auth", token: beto }));
    assert.equal((await leerAna()).type, "auth.ok");
    assert.equal((await leerBeto()).type, "auth.ok");
    socketAna.send(JSON.stringify({ type: "subscribe", matchId }));
    let snapshotAna = (await leerAna()).snapshot as SnapshotMano;
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId }));
    let snapshotBeto = (await leerBeto()).snapshot as SnapshotMano;
    const versionInicial = snapshotBeto.version;
    const repartidorInicial = snapshotBeto.repartidor;
    const marcadorInicial = snapshotBeto.marcador;
    const jugadas: { asiento: number; carta: Carta }[] = [];
    assert.equal(tieneFlor(snapshotAna.cartasPropias, snapshotAna.muestra), false);
    assert.equal(tieneFlor(snapshotBeto.cartasPropias, snapshotBeto.muestra), false);

    if (conTruco) {
      assert.equal(snapshotBeto.turno, 1);
      socketBeto.send(
        JSON.stringify({
          type: "game.action",
          matchId,
          actionId: "truco-antes-de-cartas",
          expectedVersion: snapshotBeto.version,
          action: { type: "truco" },
        }),
      );
      assert.equal((await leerBeto()).type, "game.confirmed");
      snapshotAna = (await leerAna()).snapshot as SnapshotMano;
      snapshotBeto = (await leerBeto()).snapshot as SnapshotMano;
      assert.ok(snapshotAna.desafiosPendientes.truco);
      assert.deepEqual(snapshotAna.desafiosPendientes.truco, snapshotBeto.desafiosPendientes.truco);
      socketAna.send(
        JSON.stringify({
          type: "game.action",
          matchId,
          actionId: "truco-aceptado-antes-de-cartas",
          expectedVersion: snapshotAna.version,
          action: { type: "accept-truco" },
        }),
      );
      assert.equal((await leerAna()).type, "game.confirmed");
      snapshotAna = (await leerAna()).snapshot as SnapshotMano;
      snapshotBeto = (await leerBeto()).snapshot as SnapshotMano;
      assert.equal(snapshotAna.desafiosPendientes.truco, null);
      assert.equal(snapshotBeto.desafiosPendientes.truco, null);
      assert.equal(snapshotAna.version, versionInicial + 2);
      assert.equal(snapshotBeto.version, snapshotAna.version);
    }

    while (jugadas.length < 6 && snapshotBeto.repartidor === repartidorInicial) {
      const asiento = snapshotBeto.turno;
      assert.ok(asiento === 0 || asiento === 1);
      const snapshotDelTurno = asiento === 0 ? snapshotAna : snapshotBeto;
      const carta = snapshotDelTurno.cartasPropias[0];
      assert.ok(carta);
      const socketDelTurno = asiento === 0 ? socketAna : socketBeto;
      const leerDelTurno = asiento === 0 ? leerAna : leerBeto;
      const versionAnterior = snapshotBeto.version;
      socketDelTurno.send(
        JSON.stringify({
          type: "game.action",
          matchId,
          actionId: `carta-${jugadas.length + 1}`,
          expectedVersion: versionAnterior,
          action: { type: "play-card", card: carta },
        }),
      );
      assert.equal((await leerDelTurno()).type, "game.confirmed");
      jugadas.push({ asiento, carta });
      snapshotAna = (await leerAna()).snapshot as SnapshotMano;
      snapshotBeto = (await leerBeto()).snapshot as SnapshotMano;
      assert.equal(snapshotAna.version, versionAnterior + 1);
      assert.equal(snapshotBeto.version, snapshotAna.version);
      assert.deepEqual(snapshotAna.marcador, snapshotBeto.marcador);
      for (const cartaAna of snapshotAna.cartasPropias)
        assert.ok(!JSON.stringify(snapshotBeto).includes(JSON.stringify(cartaAna)));
      for (const cartaBeto of snapshotBeto.cartasPropias)
        assert.ok(!JSON.stringify(snapshotAna).includes(JSON.stringify(cartaBeto)));

      if (snapshotBeto.repartidor === repartidorInicial) {
        assert.ok(
          snapshotAna.cartasJugadas.some(
            (jugada) =>
              jugada.asiento === asiento && JSON.stringify(jugada.carta) === JSON.stringify(carta),
          ),
        );
        assert.equal(snapshotAna.cartasJugadas.length, jugadas.length);
      }
    }

    assert.equal(jugadas.length, 4);
    assert.equal(jugadas.length / 2, 2);
    assert.notEqual(snapshotBeto.repartidor, repartidorInicial);
    assert.equal(snapshotAna.cartasJugadas.length, 0);
    assert.equal(snapshotBeto.cartasJugadas.length, 0);
    assert.deepEqual(snapshotAna.marcador, [
      { asiento: 0, puntos: 0 },
      { asiento: 1, puntos: conTruco ? 2 : 1 },
    ]);
    assert.deepEqual(snapshotBeto.marcador, snapshotAna.marcador);
    assert.equal(snapshotBeto.repartidor, 1);
    assert.equal(snapshotBeto.version, versionInicial + jugadas.length + (conTruco ? 2 : 0));
    assert.equal(snapshotBeto.cartasPropias.length, 3);
    assert.equal(snapshotAna.cartasPropias.length, 3);
    assert.notDeepEqual(snapshotBeto.marcador, marcadorInicial);
  } finally {
    await Promise.all(
      sockets
        .filter(
          (socket) =>
            socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING,
        )
        .map(
          (socket) =>
            new Promise<void>((resolve) => {
              socket.once("close", () => resolve());
              socket.close();
            }),
        ),
    );
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("WebSocket 6B.4.1: disputa una mano completa mediante cartas", async () => {
  await disputarManoPorCartas(false);
});

test("WebSocket 6B.4.2: disputa una mano con Truco aceptado y cartas", async () => {
  await disputarManoPorCartas(true);
});

async function disputarPartidaPorCartas(conTrucosAceptados: boolean): Promise<void> {
  const eleccionesSinFlor = [
    33, 25, 7, 11, 17, 22, 25, 0, 1, 28, 3, 16, 9, 12, 21, 3, 17, 17, 15, 4, 13, 4, 3, 6, 1, 11, 7,
    0, 1, 6, 7, 6, 1, 6, 5, 0, 1, 2, 1,
  ];
  const aleatoriedadPrueba = [0, ...Array.from({ length: 60 }, () => eleccionesSinFlor).flat()];
  let llamadaAleatoria = 0;
  const servidor = crearServidor({
    aleatoriedad: { enteroInclusivo: () => aleatoriedadPrueba[llamadaAleatoria++] ?? 0 },
  });
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const http = `http://127.0.0.1:${direccion.port}`;
  const wsUrl = `ws://127.0.0.1:${direccion.port}/ws`;
  const buzon = (socket: WebSocket) => {
    const cola: Record<string, unknown>[] = [];
    const esperas: ((mensaje: Record<string, unknown>) => void)[] = [];
    socket.on("message", (datos: Buffer) => {
      const mensaje = JSON.parse(datos.toString("utf8")) as Record<string, unknown>;
      const espera = esperas.shift();
      if (espera) espera(mensaje);
      else cola.push(mensaje);
    });
    return (): Promise<Record<string, unknown>> =>
      cola.length
        ? Promise.resolve(cola.shift()!)
        : new Promise((resolve) => esperas.push(resolve));
  };
  const crearSesion = async (nickname: string): Promise<string> => {
    const respuesta = await fetch(`${http}/api/guest-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    return ((await respuesta.json()) as { token: string }).token;
  };
  type SnapshotPartidaCartas = {
    version: number;
    repartidor: number;
    turno: number | null;
    muestra: Carta;
    cartasPropias: Carta[];
    cartasJugadas: readonly { asiento: number; carta: Carta }[];
    marcador: readonly { asiento: number; puntos: number }[];
    desafiosPendientes: { envido: unknown; flor: unknown; truco: unknown };
  };
  const sockets: WebSocket[] = [];
  try {
    const ana = await crearSesion("Ana");
    const beto = await crearSesion("Beto");
    const creada = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}`, "Content-Type": "application/json" },
      body: JSON.stringify({ targetScore: 30, mode: "1v1" }),
    });
    const matchId = ((await creada.json()) as { matchId: string }).matchId;
    await fetch(`${http}/api/matches/${matchId}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${beto}` },
    });
    await fetch(`${http}/api/matches/${matchId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    const socketAna = new WebSocket(wsUrl);
    const socketBeto = new WebSocket(wsUrl);
    sockets.push(socketAna, socketBeto);
    await Promise.all([once(socketAna, "open"), once(socketBeto, "open")]);
    const leerAna = buzon(socketAna);
    const leerBeto = buzon(socketBeto);
    socketAna.send(JSON.stringify({ type: "auth", token: ana }));
    socketBeto.send(JSON.stringify({ type: "auth", token: beto }));
    assert.equal((await leerAna()).type, "auth.ok");
    assert.equal((await leerBeto()).type, "auth.ok");
    socketAna.send(JSON.stringify({ type: "subscribe", matchId }));
    let snapshotAna = (await leerAna()).snapshot as SnapshotPartidaCartas;
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId }));
    let snapshotBeto = (await leerBeto()).snapshot as SnapshotPartidaCartas;
    const versionInicial = snapshotBeto.version;
    let manos = 0;
    let cartasJugadas = 0;
    const floresAnunciadas = 0;
    let trucosPropuestos = 0;
    let trucosAceptados = 0;
    let trucoAceptadoEnMano = false;
    let repartidorActual = snapshotBeto.repartidor;
    const rotaciones: number[] = [repartidorActual];

    while (Math.max(...snapshotBeto.marcador.map((item) => item.puntos)) < 30) {
      if (snapshotAna.cartasPropias.length === 3 && snapshotBeto.cartasPropias.length === 3) {
        assert.equal(tieneFlor(snapshotAna.cartasPropias, snapshotAna.muestra), false);
        assert.equal(tieneFlor(snapshotBeto.cartasPropias, snapshotBeto.muestra), false);
      }
      if (
        conTrucosAceptados &&
        trucosAceptados < 3 &&
        !trucoAceptadoEnMano &&
        snapshotAna.cartasPropias.length === 3 &&
        snapshotBeto.cartasPropias.length === 3
      ) {
        const asientoProponente = snapshotBeto.turno;
        assert.ok(asientoProponente === 0 || asientoProponente === 1);
        const socketProponente = asientoProponente === 0 ? socketAna : socketBeto;
        const leerProponente = asientoProponente === 0 ? leerAna : leerBeto;
        const socketRespondedor = asientoProponente === 0 ? socketBeto : socketAna;
        const leerRespondedor = asientoProponente === 0 ? leerBeto : leerAna;
        const versionTruco = snapshotBeto.version;
        socketProponente.send(
          JSON.stringify({
            type: "game.action",
            matchId,
            actionId: `partida-truco-${trucosPropuestos + 1}`,
            expectedVersion: versionTruco,
            action: { type: "truco" },
          }),
        );
        assert.equal((await leerProponente()).type, "game.confirmed");
        snapshotAna = (await leerAna()).snapshot as SnapshotPartidaCartas;
        snapshotBeto = (await leerBeto()).snapshot as SnapshotPartidaCartas;
        assert.ok(snapshotAna.desafiosPendientes.truco);
        assert.deepEqual(
          snapshotAna.desafiosPendientes.truco,
          snapshotBeto.desafiosPendientes.truco,
        );
        socketRespondedor.send(
          JSON.stringify({
            type: "game.action",
            matchId,
            actionId: `partida-truco-aceptado-${trucosPropuestos + 1}`,
            expectedVersion: snapshotBeto.version,
            action: { type: "accept-truco" },
          }),
        );
        assert.equal((await leerRespondedor()).type, "game.confirmed");
        snapshotAna = (await leerAna()).snapshot as SnapshotPartidaCartas;
        snapshotBeto = (await leerBeto()).snapshot as SnapshotPartidaCartas;
        assert.equal(snapshotAna.desafiosPendientes.truco, null);
        assert.equal(snapshotBeto.desafiosPendientes.truco, null);
        assert.equal(snapshotBeto.version, versionTruco + 2);
        trucosPropuestos += 1;
        trucosAceptados += 1;
        trucoAceptadoEnMano = true;
      }
      const asiento = snapshotBeto.turno;
      assert.ok(asiento === 0 || asiento === 1);
      const snapshotDelTurno = asiento === 0 ? snapshotAna : snapshotBeto;
      const carta = snapshotDelTurno.cartasPropias[0];
      assert.ok(carta);
      const socketDelTurno = asiento === 0 ? socketAna : socketBeto;
      const leerDelTurno = asiento === 0 ? leerAna : leerBeto;
      const versionAnterior = snapshotBeto.version;
      const puntosAnteriores = snapshotBeto.marcador.reduce(
        (total, item) => total + item.puntos,
        0,
      );
      socketDelTurno.send(
        JSON.stringify({
          type: "game.action",
          matchId,
          actionId: `partida-carta-${cartasJugadas + 1}`,
          expectedVersion: versionAnterior,
          action: { type: "play-card", card: carta },
        }),
      );
      assert.equal((await leerDelTurno()).type, "game.confirmed");
      cartasJugadas += 1;
      snapshotAna = (await leerAna()).snapshot as SnapshotPartidaCartas;
      snapshotBeto = (await leerBeto()).snapshot as SnapshotPartidaCartas;
      assert.equal(snapshotAna.version, versionAnterior + 1);
      assert.equal(snapshotBeto.version, snapshotAna.version);
      assert.deepEqual(snapshotAna.marcador, snapshotBeto.marcador);
      assert.equal(snapshotAna.repartidor, snapshotBeto.repartidor);
      assert.equal(snapshotAna.turno, snapshotBeto.turno);
      assert.deepEqual(snapshotAna.cartasJugadas, snapshotBeto.cartasJugadas);
      assert.deepEqual(snapshotAna.desafiosPendientes, snapshotBeto.desafiosPendientes);
      for (const cartaAna of snapshotAna.cartasPropias)
        assert.ok(!JSON.stringify(snapshotBeto).includes(JSON.stringify(cartaAna)));
      for (const cartaBeto of snapshotBeto.cartasPropias)
        assert.ok(!JSON.stringify(snapshotAna).includes(JSON.stringify(cartaBeto)));

      const puntosActuales = snapshotBeto.marcador.reduce((total, item) => total + item.puntos, 0);
      const nuevaMano =
        snapshotAna.cartasPropias.length === 3 &&
        snapshotBeto.cartasPropias.length === 3 &&
        snapshotBeto.cartasJugadas.length === 0;
      if (!nuevaMano && puntosActuales === puntosAnteriores) {
        assert.ok(
          snapshotAna.cartasJugadas.some(
            (jugada) =>
              jugada.asiento === asiento && JSON.stringify(jugada.carta) === JSON.stringify(carta),
          ),
        );
      } else {
        manos += 1;
        assert.ok(
          puntosActuales === puntosAnteriores ||
            puntosActuales === puntosAnteriores + (trucoAceptadoEnMano ? 2 : 1),
        );
        assert.ok(puntosActuales <= manos + trucosAceptados);
        assert.equal(puntosActuales - puntosAnteriores, trucoAceptadoEnMano ? 2 : 1);
        if (nuevaMano) {
          assert.notEqual(snapshotBeto.repartidor, repartidorActual);
          repartidorActual = snapshotBeto.repartidor;
          rotaciones.push(repartidorActual);
          assert.equal(snapshotBeto.cartasJugadas.length, 0);
          assert.equal(snapshotAna.cartasJugadas.length, 0);
          assert.equal(snapshotBeto.cartasPropias.length, 3);
          assert.equal(snapshotAna.cartasPropias.length, 3);
          trucoAceptadoEnMano = false;
        } else {
          assert.equal(Math.max(...snapshotBeto.marcador.map((item) => item.puntos)), 30);
        }
      }
    }

    if (conTrucosAceptados) {
      assert.ok(manos < 59);
      assert.ok(cartasJugadas < 236);
    } else {
      assert.equal(manos, 59);
      assert.equal(cartasJugadas, 236);
    }
    assert.equal(floresAnunciadas, 0);
    assert.equal(trucosPropuestos, conTrucosAceptados ? 3 : 0);
    assert.equal(trucosAceptados, conTrucosAceptados ? 3 : 0);
    assert.equal(Math.max(...snapshotBeto.marcador.map((item) => item.puntos)), 30);
    assert.ok(snapshotBeto.marcador.every((item) => item.puntos <= 30));
    assert.equal(snapshotBeto.version, versionInicial + cartasJugadas + trucosAceptados * 2);
    assert.equal(rotaciones.length, manos);
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "partida-cartas-despues-del-final",
        expectedVersion: snapshotBeto.version,
        action: { type: "play-card", card: { palo: "oro", valor: 1 } },
      }),
    );
    const rechazoFinal = await leerBeto();
    assert.deepEqual(
      {
        type: rechazoFinal.type,
        actionId: rechazoFinal.actionId,
        code: rechazoFinal.code,
        version: rechazoFinal.version,
      },
      {
        type: "game.rejected",
        actionId: "partida-cartas-despues-del-final",
        code: "partida-finalizada",
        version: snapshotBeto.version,
      },
    );
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId }));
    const trasRechazoFinal = (await leerBeto()).snapshot as SnapshotPartidaCartas;
    assert.deepEqual(
      {
        version: trasRechazoFinal.version,
        marcador: trasRechazoFinal.marcador,
        repartidor: trasRechazoFinal.repartidor,
      },
      {
        version: snapshotBeto.version,
        marcador: snapshotBeto.marcador,
        repartidor: snapshotBeto.repartidor,
      },
    );
  } finally {
    await Promise.all(
      sockets
        .filter(
          (socket) =>
            socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING,
        )
        .map(
          (socket) =>
            new Promise<void>((resolve) => {
              socket.once("close", () => resolve());
              socket.close();
            }),
        ),
    );
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("WebSocket 6B.4.3: completa una partida a 30 puntos mediante cartas", async () => {
  await disputarPartidaPorCartas(false);
});

test("WebSocket 6B.4.4: completa una partida con Truco aceptado y cartas", async () => {
  await disputarPartidaPorCartas(true);
});

test("WebSocket 6B: autentica, sincroniza snapshots privados y aplica una acción", async () => {
  const eleccionesSinFlor = [
    33, 25, 7, 11, 17, 22, 25, 0, 1, 28, 3, 16, 9, 12, 21, 3, 17, 17, 15, 4, 13, 4, 3, 6, 1, 11, 7,
    0, 1, 6, 7, 6, 1, 6, 5, 0, 1, 2, 1,
  ];
  const eleccionesFlor = [
    28, 33, 8, 9, 28, 22, 22, 32, 20, 12, 2, 18, 4, 4, 24, 4, 12, 9, 0, 15, 16, 4, 10, 0, 4, 13, 6,
    12, 0, 3, 4, 7, 4, 0, 4, 4, 0, 0, 0,
  ];
  const aleatoriedadPrueba = [
    ...Array<number>(120).fill(0),
    ...eleccionesSinFlor,
    0,
    ...eleccionesSinFlor,
    0,
    ...eleccionesFlor,
    0,
    ...eleccionesSinFlor,
  ];
  let llamadaAleatoria = 0;
  const servidor = crearServidor({
    aleatoriedad: {
      enteroInclusivo: () => {
        const valor = aleatoriedadPrueba[llamadaAleatoria];
        llamadaAleatoria += 1;
        return valor ?? 0;
      },
    },
  });
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const http = `http://127.0.0.1:${direccion.port}`;
  const wsUrl = `ws://127.0.0.1:${direccion.port}/ws`;
  const buzon = (socket: WebSocket) => {
    const cola: Record<string, unknown>[] = [];
    const esperas: ((mensaje: Record<string, unknown>) => void)[] = [];
    socket.on("message", (datos: Buffer) => {
      const entrada = JSON.parse(datos.toString("utf8")) as Record<string, unknown>;
      const siguiente = esperas.shift();
      if (siguiente) siguiente(entrada);
      else cola.push(entrada);
    });
    return (): Promise<Record<string, unknown>> =>
      cola.length
        ? Promise.resolve(cola.shift()!)
        : new Promise((resolve) => esperas.push(resolve));
  };
  const conectar = async (): Promise<WebSocket> => {
    const socket = new WebSocket(wsUrl);
    await once(socket, "open");
    return socket;
  };
  const crearSesion = async (nickname: string): Promise<string> => {
    const respuesta = await fetch(`${http}/api/guest-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    return ((await respuesta.json()) as { token: string }).token;
  };
  const sockets: WebSocket[] = [];
  try {
    const ana = await crearSesion("Ana");
    const beto = await crearSesion("Beto");
    const creada = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    const matchId = ((await creada.json()) as { matchId: string }).matchId;
    await fetch(`${http}/api/matches/${matchId}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${beto}` },
    });
    await fetch(`${http}/api/matches/${matchId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });

    const invalido = await conectar();
    sockets.push(invalido);
    const leerInvalido = buzon(invalido);
    const cierreInvalido = once(invalido, "close");
    invalido.send(JSON.stringify({ type: "auth", token: "invalido" }));
    assert.equal((await leerInvalido()).type, "error");
    const [codigo] = (await cierreInvalido) as [number];
    assert.equal(codigo, 1008);

    const socketAna = await conectar();
    const socketBeto = await conectar();
    sockets.push(socketAna, socketBeto);
    const leerAna = buzon(socketAna);
    const leerBeto = buzon(socketBeto);
    socketAna.send(JSON.stringify({ type: "auth", token: ana }));
    assert.equal((await leerAna()).type, "auth.ok");
    socketBeto.send(JSON.stringify({ type: "auth", token: beto }));
    assert.equal((await leerBeto()).type, "auth.ok");
    socketAna.send(JSON.stringify({ type: "subscribe", matchId }));
    const snapshotAna = (await leerAna()).snapshot as {
      cartasPropias: unknown[];
      version: number;
    };
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId }));
    const snapshotBeto = (await leerBeto()).snapshot as {
      cartasPropias: unknown[];
      version: number;
      turno: number;
    };
    assert.notDeepEqual(snapshotAna.cartasPropias, snapshotBeto.cartasPropias);
    assert.equal(snapshotBeto.turno, 1);
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "truco-propuesto",
        expectedVersion: snapshotBeto.version,
        action: { type: "truco" },
      }),
    );
    assert.equal((await leerBeto()).type, "game.confirmed");
    const trasTrucoAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
    };
    const trasTrucoBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
    };
    assert.ok(trasTrucoAna.desafiosPendientes.truco);
    assert.equal(trasTrucoAna.version, trasTrucoBeto.version);
    socketAna.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "truco-aceptado",
        expectedVersion: trasTrucoAna.version,
        action: { type: "accept-truco" },
      }),
    );
    assert.equal((await leerAna()).type, "game.confirmed");
    const trasAceptacionAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
    };
    const trasAceptacionBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
      cartasPropias: unknown[];
    };
    assert.equal(trasAceptacionAna.desafiosPendientes.truco, null);
    assert.equal(trasAceptacionAna.version, trasAceptacionBeto.version);
    socketAna.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "retruco-propuesto",
        expectedVersion: trasAceptacionAna.version,
        action: { type: "retruco" },
      }),
    );
    assert.equal((await leerAna()).type, "game.confirmed");
    const retrucoPendienteAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { truco: { nivel: string; proponente: number } | null };
    };
    const retrucoPendienteBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { truco: { nivel: string; proponente: number } | null };
    };
    assert.deepEqual(retrucoPendienteAna.desafiosPendientes.truco, {
      nivel: "retruco",
      proponente: 0,
    });
    assert.deepEqual(
      retrucoPendienteAna.desafiosPendientes.truco,
      retrucoPendienteBeto.desafiosPendientes.truco,
    );
    for (const carta of trasAceptacionBeto.cartasPropias)
      assert.ok(!JSON.stringify(retrucoPendienteAna).includes(JSON.stringify(carta)));
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "retruco-aceptado",
        expectedVersion: retrucoPendienteBeto.version,
        action: { type: "accept-retruco" },
      }),
    );
    assert.equal((await leerBeto()).type, "game.confirmed");
    const trasRetrucoAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
    };
    const trasRetrucoBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
      cartasPropias: unknown[];
    };
    assert.equal(trasRetrucoAna.desafiosPendientes.truco, null);
    assert.equal(trasRetrucoAna.version, trasRetrucoBeto.version);
    assert.equal(trasRetrucoAna.version, trasAceptacionAna.version + 2);
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "a1",
        expectedVersion: trasRetrucoBeto.version,
        action: { type: "play-card", card: trasRetrucoBeto.cartasPropias[0] },
      }),
    );
    assert.equal((await leerBeto()).type, "game.confirmed");
    const actualizacionAna = (await leerAna()).snapshot as {
      version: number;
      cartasJugadas: unknown[];
      cartasPropias: unknown[];
    };
    const actualizacionBeto = (await leerBeto()).snapshot as {
      version: number;
      cartasJugadas: unknown[];
      cartasPropias: unknown[];
    };
    assert.equal(actualizacionAna.version, trasRetrucoBeto.version + 1);
    assert.equal(actualizacionAna.version, actualizacionBeto.version);
    assert.equal(actualizacionAna.cartasJugadas.length, 1);
    assert.equal(actualizacionBeto.cartasPropias.length, 2);
    assert.equal(actualizacionAna.cartasPropias.length, 3);

    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "obsoleta",
        expectedVersion: snapshotBeto.version,
        action: { type: "play-card", card: actualizacionBeto.cartasPropias[0] },
      }),
    );
    const obsoleta = await leerBeto();
    assert.deepEqual(
      { type: obsoleta.type, code: obsoleta.code, version: obsoleta.version },
      { type: "game.rejected", code: "version-obsoleta", version: actualizacionBeto.version },
    );
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "a1",
        expectedVersion: trasRetrucoBeto.version,
        action: { type: "play-card", card: trasRetrucoBeto.cartasPropias[0] },
      }),
    );
    assert.equal((await leerBeto()).type, "game.confirmed");
    const reintentoAna = (await leerAna()).snapshot as {
      version: number;
      cartasJugadas: unknown[];
    };
    const reintentoBeto = (await leerBeto()).snapshot as {
      version: number;
      cartasJugadas: unknown[];
    };
    assert.equal(reintentoAna.version, actualizacionAna.version);
    assert.equal(reintentoBeto.cartasJugadas.length, 1);
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "a1",
        expectedVersion: trasRetrucoBeto.version,
        action: { type: "play-card", card: actualizacionBeto.cartasPropias[0] },
      }),
    );
    assert.equal((await leerBeto()).type, "error");

    const creadaRechazo = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    const matchRechazo = ((await creadaRechazo.json()) as { matchId: string }).matchId;
    await fetch(`${http}/api/matches/${matchRechazo}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${beto}` },
    });
    await fetch(`${http}/api/matches/${matchRechazo}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId: matchRechazo }));
    const rechazoBetoInicial = (await leerBeto()).snapshot as {
      version: number;
      turno: number;
      cartasPropias: unknown[];
    };
    socketAna.send(JSON.stringify({ type: "subscribe", matchId: matchRechazo }));
    const rechazoAnaInicial = (await leerAna()).snapshot as { cartasPropias: unknown[] };
    assert.equal(rechazoBetoInicial.turno, 1);
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchRechazo,
        actionId: "truco-rechazado-propuesta",
        expectedVersion: rechazoBetoInicial.version,
        action: { type: "truco" },
      }),
    );
    assert.equal((await leerBeto()).type, "game.confirmed");
    const pendienteAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
      cartasPropias: unknown[];
    };
    const pendienteBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
    };
    assert.ok(pendienteAna.desafiosPendientes.truco);
    assert.equal(pendienteAna.version, pendienteBeto.version);
    for (const carta of rechazoBetoInicial.cartasPropias)
      assert.ok(!JSON.stringify(pendienteAna).includes(JSON.stringify(carta)));
    socketAna.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchRechazo,
        actionId: "truco-rechazado-respuesta",
        expectedVersion: pendienteAna.version,
        action: { type: "reject-truco" },
      }),
    );
    assert.equal((await leerAna()).type, "game.confirmed");
    const rechazoAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
      marcador: readonly { asiento: number; puntos: number }[];
      cartasPropias: unknown[];
    };
    const rechazoBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { truco: unknown };
    };
    assert.equal(rechazoAna.desafiosPendientes.truco, null);
    assert.equal(rechazoAna.version, rechazoBeto.version);
    assert.equal(rechazoAna.marcador.find((item) => item.asiento === 1)?.puntos, 1);
    assert.notDeepEqual(rechazoAnaInicial.cartasPropias, rechazoBetoInicial.cartasPropias);

    const creadaEnvido = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    const matchEnvido = ((await creadaEnvido.json()) as { matchId: string }).matchId;
    await fetch(`${http}/api/matches/${matchEnvido}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${beto}` },
    });
    await fetch(`${http}/api/matches/${matchEnvido}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId: matchEnvido }));
    const envidoBetoInicial = (await leerBeto()).snapshot as {
      version: number;
      turno: number;
      cartasPropias: unknown[];
    };
    socketAna.send(JSON.stringify({ type: "subscribe", matchId: matchEnvido }));
    const envidoAnaInicial = (await leerAna()).snapshot as { cartasPropias: unknown[] };
    assert.equal(envidoBetoInicial.turno, 1);
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchEnvido,
        actionId: "envido-propuesto",
        expectedVersion: envidoBetoInicial.version,
        action: { type: "envido", canto: "envido" },
      }),
    );
    const confirmacionEnvido = await leerBeto();
    assert.equal(
      confirmacionEnvido.type,
      "game.confirmed",
      `Envido rechazado: ${String(confirmacionEnvido.code)}`,
    );
    const envidoPendienteAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { envido: unknown };
    };
    const envidoPendienteBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { envido: unknown };
    };
    assert.ok(envidoPendienteAna.desafiosPendientes.envido);
    assert.equal(envidoPendienteAna.version, envidoPendienteBeto.version);
    for (const carta of envidoBetoInicial.cartasPropias)
      assert.ok(!JSON.stringify(envidoPendienteAna).includes(JSON.stringify(carta)));
    socketAna.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchEnvido,
        actionId: "envido-aceptado",
        expectedVersion: envidoPendienteAna.version,
        action: { type: "accept-envido" },
      }),
    );
    assert.equal((await leerAna()).type, "game.confirmed");
    const envidoAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { envido: unknown };
      marcador: readonly { asiento: number; puntos: number }[];
    };
    const envidoBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { envido: unknown };
      marcador: readonly { asiento: number; puntos: number }[];
    };
    assert.equal(envidoAna.desafiosPendientes.envido, null);
    assert.equal(envidoAna.version, envidoBeto.version);
    assert.deepEqual(envidoAna.marcador, envidoBeto.marcador);
    assert.notDeepEqual(envidoAnaInicial.cartasPropias, envidoBetoInicial.cartasPropias);

    const creadaEnvidoRechazado = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    const matchEnvidoRechazado = ((await creadaEnvidoRechazado.json()) as { matchId: string })
      .matchId;
    await fetch(`${http}/api/matches/${matchEnvidoRechazado}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${beto}` },
    });
    await fetch(`${http}/api/matches/${matchEnvidoRechazado}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId: matchEnvidoRechazado }));
    const rechazoEnvidoBetoInicial = (await leerBeto()).snapshot as {
      version: number;
      turno: number;
      cartasPropias: unknown[];
    };
    socketAna.send(JSON.stringify({ type: "subscribe", matchId: matchEnvidoRechazado }));
    const rechazoEnvidoAnaInicial = (await leerAna()).snapshot as { cartasPropias: unknown[] };
    assert.equal(rechazoEnvidoBetoInicial.turno, 1);
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchEnvidoRechazado,
        actionId: "envido-rechazado-propuesta",
        expectedVersion: rechazoEnvidoBetoInicial.version,
        action: { type: "envido", canto: "envido" },
      }),
    );
    assert.equal((await leerBeto()).type, "game.confirmed");
    const envidoRechazoPendienteAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { envido: unknown };
    };
    const envidoRechazoPendienteBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { envido: unknown };
    };
    assert.ok(envidoRechazoPendienteAna.desafiosPendientes.envido);
    assert.equal(envidoRechazoPendienteAna.version, envidoRechazoPendienteBeto.version);
    for (const carta of rechazoEnvidoBetoInicial.cartasPropias)
      assert.ok(!JSON.stringify(envidoRechazoPendienteAna).includes(JSON.stringify(carta)));
    socketAna.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchEnvidoRechazado,
        actionId: "envido-rechazado-respuesta",
        expectedVersion: envidoRechazoPendienteAna.version,
        action: { type: "reject-envido" },
      }),
    );
    assert.equal((await leerAna()).type, "game.confirmed");
    const envidoRechazadoAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { envido: unknown };
    };
    const envidoRechazadoBeto = (await leerBeto()).snapshot as { version: number };
    assert.equal(envidoRechazadoAna.desafiosPendientes.envido, null);
    assert.equal(envidoRechazadoAna.version, envidoRechazadoBeto.version);
    socketAna.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchEnvidoRechazado,
        actionId: "envido-rechazado-tardio",
        expectedVersion: envidoRechazadoAna.version,
        action: { type: "accept-envido" },
      }),
    );
    const respuestaTardia = await leerAna();
    assert.equal(respuestaTardia.type, "game.rejected");
    assert.equal(respuestaTardia.version, envidoRechazadoAna.version);
    assert.notDeepEqual(
      rechazoEnvidoAnaInicial.cartasPropias,
      rechazoEnvidoBetoInicial.cartasPropias,
    );

    const creadaFlor = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    const matchFlor = ((await creadaFlor.json()) as { matchId: string }).matchId;
    await fetch(`${http}/api/matches/${matchFlor}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${beto}` },
    });
    await fetch(`${http}/api/matches/${matchFlor}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId: matchFlor }));
    const florBetoInicial = (await leerBeto()).snapshot as {
      version: number;
      turno: number;
      cartasPropias: Carta[];
      muestra: Carta;
    };
    socketAna.send(JSON.stringify({ type: "subscribe", matchId: matchFlor }));
    const florAnaInicial = (await leerAna()).snapshot as {
      cartasPropias: Carta[];
      muestra: Carta;
    };
    assert.equal(florBetoInicial.turno, 1);
    assert.equal(tieneFlor(florBetoInicial.cartasPropias, florBetoInicial.muestra), true);
    assert.equal(tieneFlor(florAnaInicial.cartasPropias, florAnaInicial.muestra), false);
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchFlor,
        actionId: "flor-anunciada",
        expectedVersion: florBetoInicial.version,
        action: { type: "announce-flor" },
      }),
    );
    assert.equal((await leerBeto()).type, "game.confirmed");
    const florAna = (await leerAna()).snapshot as {
      version: number;
      desafiosPendientes: { flor: unknown };
    };
    const florBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { flor: unknown };
    };
    assert.equal(florAna.desafiosPendientes.flor, null);
    assert.equal(florAna.version, florBeto.version);
    assert.equal(florAna.version, florBetoInicial.version + 1);
    for (const carta of florBetoInicial.cartasPropias)
      assert.ok(!JSON.stringify(florAna).includes(JSON.stringify(carta)));

    const creadaConcurrencia = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    const matchConcurrencia = ((await creadaConcurrencia.json()) as { matchId: string }).matchId;
    await fetch(`${http}/api/matches/${matchConcurrencia}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${beto}` },
    });
    await fetch(`${http}/api/matches/${matchConcurrencia}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ana}` },
    });
    socketBeto.send(JSON.stringify({ type: "subscribe", matchId: matchConcurrencia }));
    const concurrenciaBetoInicial = (await leerBeto()).snapshot as {
      version: number;
      turno: number;
      muestra: Carta;
      cartasPropias: Carta[];
    };
    socketAna.send(JSON.stringify({ type: "subscribe", matchId: matchConcurrencia }));
    const concurrenciaAnaInicial = (await leerAna()).snapshot as {
      muestra: Carta;
      cartasPropias: Carta[];
    };
    assert.equal(concurrenciaBetoInicial.turno, 1);
    assert.equal(
      tieneFlor(concurrenciaBetoInicial.cartasPropias, concurrenciaBetoInicial.muestra),
      false,
    );
    assert.equal(
      tieneFlor(concurrenciaAnaInicial.cartasPropias, concurrenciaAnaInicial.muestra),
      false,
    );
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchConcurrencia,
        actionId: "concurrencia-truco",
        expectedVersion: concurrenciaBetoInicial.version,
        action: { type: "truco" },
      }),
    );
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId: matchConcurrencia,
        actionId: "concurrencia-carta",
        expectedVersion: concurrenciaBetoInicial.version,
        action: { type: "play-card", card: concurrenciaBetoInicial.cartasPropias[0] },
      }),
    );
    const mensajesConcurrenciaBeto = [await leerBeto(), await leerBeto(), await leerBeto()];
    const confirmacionConcurrencia = mensajesConcurrenciaBeto.find(
      (mensaje) => mensaje.type === "game.confirmed",
    );
    const rechazoConcurrencia = mensajesConcurrenciaBeto.find(
      (mensaje) => mensaje.type === "game.rejected",
    );
    const actualizacionConcurrenciaBeto = mensajesConcurrenciaBeto.find(
      (mensaje) => mensaje.type === "game.snapshot",
    )?.snapshot as {
      version: number;
      marcador: readonly { asiento: number; puntos: number }[];
      cartasPropias: Carta[];
      cartasJugadas: unknown[];
      desafiosPendientes: { truco: { nivel: string } | null };
    };
    assert.ok(confirmacionConcurrencia);
    assert.ok(rechazoConcurrencia);
    assert.ok(actualizacionConcurrenciaBeto);
    assert.equal(rechazoConcurrencia.code, "version-obsoleta");
    assert.equal(rechazoConcurrencia.version, concurrenciaBetoInicial.version + 1);
    assert.ok(
      ["concurrencia-truco", "concurrencia-carta"].includes(
        confirmacionConcurrencia.actionId as string,
      ),
    );
    const actualizacionConcurrenciaAna = (await leerAna()).snapshot as {
      version: number;
      marcador: readonly { asiento: number; puntos: number }[];
      cartasJugadas: unknown[];
      desafiosPendientes: { truco: { nivel: string } | null };
    };
    assert.equal(actualizacionConcurrenciaBeto.version, concurrenciaBetoInicial.version + 1);
    assert.equal(actualizacionConcurrenciaAna.version, actualizacionConcurrenciaBeto.version);
    assert.deepEqual(actualizacionConcurrenciaAna.marcador, actualizacionConcurrenciaBeto.marcador);
    assert.ok(actualizacionConcurrenciaAna.marcador.every((item) => item.puntos === 0));
    if (confirmacionConcurrencia.actionId === "concurrencia-truco") {
      assert.equal(actualizacionConcurrenciaBeto.cartasJugadas.length, 0);
      assert.equal(actualizacionConcurrenciaBeto.cartasPropias.length, 3);
      assert.equal(actualizacionConcurrenciaAna.desafiosPendientes.truco?.nivel, "truco");
    } else {
      assert.equal(actualizacionConcurrenciaBeto.cartasJugadas.length, 1);
      assert.equal(actualizacionConcurrenciaBeto.cartasPropias.length, 2);
      assert.equal(actualizacionConcurrenciaAna.desafiosPendientes.truco, null);
    }
    for (const carta of actualizacionConcurrenciaBeto.cartasPropias)
      assert.ok(!JSON.stringify(actualizacionConcurrenciaAna).includes(JSON.stringify(carta)));
  } finally {
    await Promise.all(
      sockets
        .filter(
          (socket) =>
            socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING,
        )
        .map(
          (socket) =>
            new Promise<void>((resolve) => {
              socket.once("close", () => resolve());
              socket.close();
            }),
        ),
    );
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
