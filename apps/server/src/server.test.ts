import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import { tieneFlor } from "@truco/game-engine";
import type { Carta } from "@truco/shared";
import { leerConfiguracion } from "./config.js";
import { crearServidor } from "./server.js";
import { proyectarEventoPublico, RepositorioPartidasEnMemoria } from "./matches.js";

function fuenteSemilla(semilla: number) {
  let estado = semilla >>> 0;
  return {
    enteroInclusivo(maximo: number) {
      estado = (estado * 1_664_525 + 1_013_904_223) >>> 0;
      return estado % (maximo + 1);
    },
  };
}

test("la proyección pública conserva el canto exacto de Real Envido", () => {
  assert.deepEqual(
    proyectarEventoPublico({
      tipo: "envido-aumentado",
      cadena: {
        proponente: "maquina",
        cantos: [
          { jugador: "ana", equipo: "A", canto: "envido" },
          { jugador: "maquina", equipo: "B", canto: "real-envido" },
        ],
      },
    }),
    {
      tipo: "envido-aumentado",
      jugador: "maquina",
      canto: "real-envido",
    },
  );
});

test("la proyección pública identifica al respondedor de Envido sin exponer datos privados", () => {
  const evento = proyectarEventoPublico({
    tipo: "envido-aceptado",
    respondedor: "maquina",
    adjudicacion: {
      equipo: "B",
      puntos: 2,
      motivo: "aceptacion",
      historial: [
        { jugador: "jorge", equipo: "A", canto: "envido" },
        { jugador: "maquina", equipo: "B", canto: "real-envido" },
      ],
    },
    tantos: [
      { jugador: "jorge", equipo: "A", tanto: 29 },
      { jugador: "maquina", equipo: "B", tanto: 30 },
    ],
  });
  assert.deepEqual(evento, {
    tipo: "envido-aceptado",
    jugador: "maquina",
    canto: "real-envido",
    equipoGanador: "B",
    adjudicaciones: [{ equipo: "B", puntos: 2, causa: "aceptacion" }],
    tantos: [
      { jugador: "jorge", tanto: 29 },
      { jugador: "maquina", tanto: 30 },
    ],
  });
  assert.equal(JSON.stringify(evento).includes("cartas"), false);
});

test("la proyección pública conserva la escalera completa de Truco", () => {
  assert.deepEqual(
    proyectarEventoPublico({
      tipo: "retruco-propuesto",
      propuesta: { nivel: "retruco", proponente: "jorge" },
      equipoProponente: "A",
    }),
    { tipo: "retruco-propuesto", jugador: "jorge", nivelTruco: "retruco" },
  );
  assert.deepEqual(
    proyectarEventoPublico({
      tipo: "retruco-aceptado",
      propuesta: { nivel: "retruco", proponente: "jorge" },
      respondedor: "maquina",
      equipoRespondedor: "B",
    }),
    { tipo: "retruco-aceptado", jugador: "maquina", nivelTruco: "retruco" },
  );
  assert.deepEqual(
    proyectarEventoPublico({
      tipo: "vale-cuatro-rechazado",
      propuesta: { nivel: "vale-cuatro", proponente: "maquina" },
      respondedor: "jorge",
      adjudicacion: { equipo: "B", puntos: 3, motivo: "rechazo" },
    }),
    {
      tipo: "vale-cuatro-rechazado",
      jugador: "jorge",
      nivelTruco: "vale-cuatro",
      equipoGanador: "B",
      adjudicaciones: [{ equipo: "B", puntos: 3, causa: "rechazo" }],
    },
  );
});

test("la respuesta automática a Retruco conserva propuesta, aceptación y nivel adjudicado", () => {
  const repositorio = new RepositorioPartidasEnMemoria(fuenteSemilla(4), {
    decidir: ({ accionesLegales }) =>
      accionesLegales.find((accion) => accion.tipo === "quiero-retruco") ??
      accionesLegales.find((accion) => accion.tipo === "proponer-truco") ??
      accionesLegales.find((accion) => accion.tipo === "jugar-carta") ??
      null,
  });
  const creada = repositorio.crearSesion("Jorge");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  let retrucoEnviado = false;
  for (let paso = 0; paso < 20; paso++) {
    const snapshot = repositorio.snapshot(partida.id, humano);
    if (snapshot.estado !== "iniciada" || snapshot.continuacion) break;
    const accion = retrucoEnviado
      ? snapshot.accionesDisponibles.find((item) => item.type === "play-card")
      : (snapshot.accionesDisponibles.find((item) => item.type === "accept-truco") ??
        (snapshot.bazasCompletadas.length >= 1 && snapshot.bazaActual.jugadas.length >= 1
          ? snapshot.accionesDisponibles.find((item) => item.type === "retruco")
          : snapshot.accionesDisponibles.find((item) => item.type === "play-card")));
    assert.ok(accion, "La secuencia debía ofrecer una acción humana.");
    if (accion.type === "retruco") retrucoEnviado = true;
    const resultado = repositorio.aplicarAccion(partida.id, humano, {
      actionId: `retruco-${paso}`,
      expectedVersion: snapshot.version,
      action: accion,
    });
    assert.equal(resultado.aceptada, true, resultado.codigo);
  }
  assert.equal(retrucoEnviado, true);
  const final = repositorio.snapshot(partida.id, humano);
  if (final.estado !== "iniciada") throw new Error("La partida debía estar iniciada.");
  const retruco = final.eventosPublicos.filter((evento) => evento.tipo.startsWith("retruco-"));
  assert.deepEqual(
    retruco.map((evento) => [evento.tipo, evento.nivelTruco]),
    [
      ["retruco-propuesto", "retruco"],
      ["retruco-aceptado", "retruco"],
    ],
  );
  const adjudicacion = final.eventosPublicos.find(
    (evento) => evento.tipo === "truco-adjudicado-por-bazas",
  );
  assert.equal(adjudicacion?.nivelTruco, "retruco");
  assert.equal(adjudicacion?.adjudicaciones?.length, 1);
  assert.equal(adjudicacion?.adjudicaciones?.[0]?.puntos, 3);
  assert.equal(adjudicacion?.adjudicaciones?.[0]?.causa, "bazas");
});

test("la proyección distingue un retiro individual del cierre definitivo por mazo", () => {
  assert.deepEqual(proyectarEventoPublico({ tipo: "jugador-retirado", jugador: "ana" }), {
    tipo: "jugador-retirado",
    jugador: "ana",
  });
  assert.deepEqual(proyectarEventoPublico({ tipo: "mano-decidida-por-mazo", equipo: "B" }), {
    tipo: "mano-decidida-por-mazo",
    equipoGanador: "B",
  });
});

test("abandonar una partida contra la máquina la invalida sin adjudicar puntos", () => {
  const repositorio = new RepositorioPartidasEnMemoria(fuenteSemilla(9));
  const creada = repositorio.crearSesion("Jorge");
  const jugador = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(jugador, 40, true);
  repositorio.abandonar(partida.id, jugador);
  assert.throws(() => repositorio.snapshot(partida.id, jugador));
});

test("el cierre de mano conserva el tanteador autoritativo sin duplicarlo", () => {
  const repositorio = new RepositorioPartidasEnMemoria(fuenteSemilla(4), { decidir: () => null });
  const creada = repositorio.crearSesion("Jorge");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  const inicial = repositorio.snapshot(partida.id, humano);
  if (inicial.estado !== "iniciada") throw new Error("La mano debía iniciar.");
  const cierre = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "cerrar-por-mazo",
    expectedVersion: inicial.version,
    action: { type: "go-to-mazo" },
  });
  assert.equal(cierre.aceptada, true, cierre.codigo);
  const posterior = repositorio.snapshot(partida.id, humano);
  if (posterior.estado !== "iniciada") throw new Error("La partida debía conservar el cierre.");
  const tanteadores = posterior.eventosPublicos.filter(
    (evento) => evento.tipo === "tanteador-cierre",
  );
  assert.equal(tanteadores.length, 1);
  assert.deepEqual(tanteadores[0]?.marcadorCierre, posterior.marcador);
  const accionRepetida = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "cerrar-por-mazo-repetido",
    expectedVersion: posterior.version,
    action: { type: "go-to-mazo" },
  });
  assert.equal(accionRepetida.aceptada, false);
  const repetido = repositorio.snapshot(partida.id, humano);
  if (repetido.estado !== "iniciada") throw new Error("La partida debía conservar el cierre.");
  assert.deepEqual(repetido.eventosPublicos, posterior.eventosPublicos);
  assert.deepEqual(repetido.marcador, posterior.marcador);
});

test("la proyección pública no presenta el cierre técnico de Flor como una adjudicación", () => {
  assert.equal(
    proyectarEventoPublico({
      tipo: "flor-adjudicada",
      adjudicaciones: [
        { equipo: "A", puntos: 0, motivo: "sin-desafio" },
        { equipo: "B", puntos: 0, motivo: "sin-desafio" },
      ],
    }),
    null,
  );
  assert.deepEqual(
    proyectarEventoPublico({
      tipo: "flor-adjudicada",
      adjudicaciones: [
        { equipo: "A", puntos: 0, motivo: "sin-desafio" },
        { equipo: "B", puntos: 3, motivo: "sin-desafio" },
      ],
    }),
    {
      tipo: "flor-adjudicada",
      equipoGanador: "B",
      adjudicaciones: [
        { equipo: "A", puntos: 0, causa: "sin-desafio" },
        { equipo: "B", puntos: 3, causa: "sin-desafio" },
      ],
    },
  );
});

test("la Flor unilateral de la máquina conserva ambas adjudicaciones y suma tres al marcador público", () => {
  const repositorio = new RepositorioPartidasEnMemoria(
    { enteroInclusivo: () => 0 },
    {
      decidir: ({ accionesLegales }) =>
        accionesLegales.find((accion) => accion.tipo === "anunciar-flor") ??
        accionesLegales.find((accion) => accion.tipo === "jugar-carta") ??
        null,
    },
  );
  const creada = repositorio.crearSesion("Jorge");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  const inicial = repositorio.snapshot(partida.id, humano);
  if (inicial.estado !== "iniciada") throw new Error("La partida debía iniciarse.");
  const carta = inicial.cartasPropias[0];
  assert.ok(carta);
  const resultado = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "cerrar-flor-unilateral",
    expectedVersion: inicial.version,
    action: { type: "play-card", card: carta },
  });
  assert.equal(resultado.aceptada, true, resultado.codigo);
  const posterior = repositorio.snapshot(partida.id, humano);
  if (posterior.estado !== "iniciada") throw new Error("La mano debía continuar activa.");
  const flor = posterior.eventosPublicos.find((evento) => evento.tipo === "flor-adjudicada");
  assert.deepEqual(flor?.adjudicaciones, [
    { asientoGanador: 0, puntos: 0, causa: "sin-desafio" },
    { asientoGanador: 1, puntos: 3, causa: "sin-desafio" },
  ]);
  assert.deepEqual(posterior.marcador, [
    { asiento: 0, puntos: 0 },
    { asiento: 1, puntos: 3 },
  ]);
});

test("el cierre por bazas o mazo no atribuye los puntos previos de Flor al Truco", () => {
  const repositorio = new RepositorioPartidasEnMemoria(
    { enteroInclusivo: () => 0 },
    {
      decidir: ({ accionesLegales }) =>
        accionesLegales.find((accion) => accion.tipo === "anunciar-flor") ??
        accionesLegales.find((accion) => accion.tipo === "jugar-carta") ??
        null,
    },
  );
  const creada = repositorio.crearSesion("Jorge");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  const inicial = repositorio.snapshot(partida.id, humano);
  if (inicial.estado !== "iniciada") throw new Error("La partida debía iniciarse.");
  const carta = inicial.cartasPropias[0];
  assert.ok(carta);
  const jugada = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "carta-antes-del-mazo",
    expectedVersion: inicial.version,
    action: { type: "play-card", card: carta },
  });
  assert.equal(jugada.aceptada, true, jugada.codigo);
  const trasFlor = repositorio.snapshot(partida.id, humano);
  if (trasFlor.estado !== "iniciada") throw new Error("La mano debía continuar tras la Flor.");
  assert.ok(trasFlor.eventosPublicos.some((evento) => evento.tipo === "flor-adjudicada"));
  const retiro = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "mazo-despues-de-flor",
    expectedVersion: trasFlor.version,
    action: { type: "go-to-mazo" },
  });
  assert.equal(retiro.aceptada, true, retiro.codigo);
  const cierre = repositorio.snapshot(partida.id, humano);
  if (cierre.estado !== "iniciada") throw new Error("La partida debía conservar el cierre.");
  const manoCerrada = cierre.eventosPublicos.find((evento) => evento.tipo === "mano-cerrada");
  assert.deepEqual(manoCerrada?.adjudicaciones, [{ asientoGanador: 1, puntos: 1, causa: "mazo" }]);
  assert.deepEqual(cierre.marcador, [
    { asiento: 0, puntos: 0 },
    { asiento: 1, puntos: 4 },
  ]);
});

test("la Flor unilateral del jugador no publica Envido y rechaza el envío directo", () => {
  const repositorio = new RepositorioPartidasEnMemoria(fuenteSemilla(4), { decidir: () => null });
  const creada = repositorio.crearSesion("Jorge");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  const inicial = repositorio.snapshot(partida.id, humano);
  if (inicial.estado !== "iniciada") throw new Error("La partida debÃƒÆ’Ã‚Â­a iniciarse.");
  assert.ok(inicial.accionesDisponibles.some((accion) => accion.type === "announce-flor"));
  const flor = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "flor-propia",
    expectedVersion: inicial.version,
    action: { type: "announce-flor" },
  });
  assert.equal(flor.aceptada, true, flor.codigo);
  const posterior = repositorio.snapshot(partida.id, humano);
  if (posterior.estado !== "iniciada") throw new Error("La mano debía continuar activa.");
  assert.equal(
    posterior.accionesDisponibles.some(
      (accion) => accion.type === "envido" || accion.type === "raise-envido",
    ),
    false,
  );
  assert.deepEqual(
    posterior.eventosPublicos.find((evento) => evento.tipo === "flor-adjudicada")?.adjudicaciones,
    [
      { asientoGanador: 0, puntos: 3, causa: "sin-desafio" },
      { asientoGanador: 1, puntos: 0, causa: "sin-desafio" },
    ],
  );
  const marcadorAntesDelRechazo = posterior.marcador;
  const eventosAntesDelRechazo = posterior.eventosPublicos;
  const rechazo = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "envido-despues-de-flor",
    expectedVersion: posterior.version,
    action: { type: "envido", canto: "envido" },
  });
  assert.equal(rechazo.aceptada, false);
  if (rechazo.aceptada) assert.fail("El Envido posterior a Flor no puede confirmarse.");
  assert.equal(rechazo.codigo, "flor-ya-anunciada");
  assert.equal(rechazo.version, posterior.version);
  const trasRechazo = repositorio.snapshot(partida.id, humano);
  if (trasRechazo.estado !== "iniciada") throw new Error("La mano debía continuar activa.");
  assert.deepEqual(trasRechazo.marcador, marcadorAntesDelRechazo);
  assert.deepEqual(trasRechazo.eventosPublicos, eventosAntesDelRechazo);
});

test("Flor rival adjudicada no publica Envido al responder Truco", () => {
  const repositorio = new RepositorioPartidasEnMemoria(fuenteSemilla(8), {
    decidir: ({ accionesLegales }) =>
      accionesLegales.find((accion) => accion.tipo === "anunciar-flor") ??
      accionesLegales.find((accion) => accion.tipo === "proponer-truco") ??
      null,
  });
  const creada = repositorio.crearSesion("Jorge");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  const inicial = repositorio.snapshot(partida.id, humano);
  if (inicial.estado !== "iniciada") throw new Error("La mano debía iniciar.");
  const carta = inicial.cartasPropias[0];
  assert.ok(carta);
  const jugada = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "carta-antes-flor-rival",
    expectedVersion: inicial.version,
    action: { type: "play-card", card: carta },
  });
  assert.equal(jugada.aceptada, true, jugada.codigo);
  const posterior = repositorio.snapshot(partida.id, humano);
  if (posterior.estado !== "iniciada") throw new Error("La mano debía continuar activa.");
  assert.deepEqual(posterior.marcador, [
    { asiento: 0, puntos: 0 },
    { asiento: 1, puntos: 3 },
  ]);
  assert.equal(posterior.desafiosPendientes.truco?.proponente, 1);
  assert.equal(
    posterior.accionesDisponibles.some(
      (accion) => accion.type === "envido" || accion.type === "raise-envido",
    ),
    false,
  );
  assert.ok(posterior.accionesDisponibles.some((accion) => accion.type === "accept-truco"));
  assert.ok(posterior.accionesDisponibles.some((accion) => accion.type === "reject-truco"));
  assert.ok(posterior.accionesDisponibles.some((accion) => accion.type === "retruco"));
  const rechazo = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "envido-despues-de-flor-rival",
    expectedVersion: posterior.version,
    action: { type: "envido", canto: "envido" },
  });
  assert.equal(rechazo.aceptada, false);
  if (rechazo.aceptada) assert.fail("El Envido posterior a Flor rival no puede confirmarse.");
  assert.equal(rechazo.codigo, "flor-ya-anunciada");
  assert.equal(rechazo.version, posterior.version);
  const trasRechazo = repositorio.snapshot(partida.id, humano);
  if (trasRechazo.estado !== "iniciada") throw new Error("La mano debía continuar activa.");
  assert.deepEqual(trasRechazo.marcador, posterior.marcador);
  assert.deepEqual(trasRechazo.eventosPublicos, posterior.eventosPublicos);
  assert.deepEqual(trasRechazo.desafiosPendientes.truco, posterior.desafiosPendientes.truco);
});

test("Flor como respuesta a Envido se publica fuera de turno y cancela sin puntos", () => {
  const repositorio = new RepositorioPartidasEnMemoria(fuenteSemilla(15), {
    decidir: ({ accionesLegales }) =>
      accionesLegales.find(
        (accion) => accion.tipo === "iniciar-envido" && accion.canto === "envido",
      ) ??
      accionesLegales.find((accion) => accion.tipo === "proponer-truco") ??
      null,
  });
  const creada = repositorio.crearSesion("Jorge");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  const pendiente = repositorio.snapshot(partida.id, humano);
  if (pendiente.estado !== "iniciada") throw new Error("La mano debía iniciar.");
  assert.equal(pendiente.turno, 1);
  assert.equal(pendiente.desafiosPendientes.envido?.respondedor, 0);
  assert.equal(pendiente.desafiosPendientes.envido?.canto, "envido");
  assert.ok(pendiente.accionesDisponibles.some((accion) => accion.type === "announce-flor"));
  const turnoAntes = pendiente.turno;
  const respuesta = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "flor-responde-envido",
    expectedVersion: pendiente.version,
    action: { type: "announce-flor" },
  });
  assert.equal(respuesta.aceptada, true, respuesta.codigo);
  const posterior = repositorio.snapshot(partida.id, humano);
  if (posterior.estado !== "iniciada") throw new Error("La mano debía continuar activa.");
  assert.equal(posterior.desafiosPendientes.envido, null);
  assert.deepEqual(posterior.marcador, [
    { asiento: 0, puntos: 3 },
    { asiento: 1, puntos: 0 },
  ]);
  assert.ok(posterior.eventosPublicos.some((evento) => evento.tipo === "flor-anunciada"));
  assert.ok(
    posterior.eventosPublicos.some((evento) => evento.tipo === "envido-cancelado-por-flor"),
  );
  assert.equal(
    posterior.eventosPublicos.some(
      (evento) => evento.tipo === "envido-rechazado" || evento.tipo === "envido-aceptado",
    ),
    false,
  );
  assert.equal(posterior.turno, turnoAntes);
});

test("Flor ordinaria responde Truco pendiente sin aceptarlo y el servidor lo reanuda", () => {
  const repositorio = new RepositorioPartidasEnMemoria(fuenteSemilla(15), {
    decidir: ({ accionesLegales }) =>
      accionesLegales.find((accion) => accion.tipo === "proponer-truco") ?? null,
  });
  const creada = repositorio.crearSesion("Jorge");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  const pendiente = repositorio.snapshot(partida.id, humano);
  if (pendiente.estado !== "iniciada") throw new Error("La mano debía iniciar.");
  assert.deepEqual(pendiente.desafiosPendientes.truco, { nivel: "truco", proponente: 1 });
  assert.ok(pendiente.accionesDisponibles.some((accion) => accion.type === "announce-flor"));
  assert.ok(pendiente.accionesDisponibles.some((accion) => accion.type === "con-flor-quiero"));
  const turnoAntes = pendiente.turno;
  const anuncio = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "flor-suspende-truco",
    expectedVersion: pendiente.version,
    action: { type: "announce-flor" },
  });
  assert.equal(anuncio.aceptada, true, anuncio.codigo);
  const reanudada = repositorio.snapshot(partida.id, humano);
  if (reanudada.estado !== "iniciada") throw new Error("La mano debía continuar activa.");
  assert.deepEqual(reanudada.desafiosPendientes.truco, pendiente.desafiosPendientes.truco);
  assert.equal(reanudada.turno, turnoAntes);
  assert.ok(reanudada.accionesDisponibles.some((accion) => accion.type === "accept-truco"));
  assert.ok(reanudada.accionesDisponibles.some((accion) => accion.type === "reject-truco"));
  assert.equal(
    reanudada.accionesDisponibles.some((accion) => accion.type === "con-flor-quiero"),
    false,
  );
  const rechazo = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "rechazar-truco-reanudado",
    expectedVersion: reanudada.version,
    action: { type: "reject-truco" },
  });
  assert.equal(rechazo.aceptada, true, rechazo.codigo);
  const final = repositorio.snapshot(partida.id, humano);
  if (final.estado !== "iniciada") throw new Error("La mano debía conservar su cierre.");
  assert.equal(
    final.eventosPublicos.filter((evento) => evento.tipo === "flor-adjudicada").length,
    1,
  );
  assert.equal(
    final.eventosPublicos.filter((evento) => evento.tipo === "truco-rechazado").length,
    1,
  );
});

test("WebSocket rechaza Envido posterior a Flor sin devolver error genérico", async () => {
  const servidor = crearServidor({
    aleatoriedad: fuenteSemilla(4),
    politicaAutomatica: { decidir: () => null },
  });
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const http = `http://127.0.0.1:${direccion.port}`;
  const socket = new WebSocket(`ws://127.0.0.1:${direccion.port}/ws`);
  const recibidos: Record<string, unknown>[] = [];
  socket.on("message", (datos: Buffer) => recibidos.push(JSON.parse(datos.toString("utf8"))));
  const leer = async (): Promise<Record<string, unknown>> => {
    for (let intento = 0; intento < 100; intento++) {
      const mensaje = recibidos.shift();
      if (mensaje) return mensaje;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error("No se recibió respuesta WebSocket.");
  };

  try {
    const sesion = await fetch(`${http}/api/guest-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "Jorge" }),
    });
    const { token } = (await sesion.json()) as { token: string };
    const creada = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "1v1-vs-machine", targetScore: 40 }),
    });
    const { matchId } = (await creada.json()) as { matchId: string };
    if (socket.readyState !== WebSocket.OPEN) await once(socket, "open");
    socket.send(JSON.stringify({ type: "auth", token }));
    assert.equal((await leer()).type, "auth.ok");
    socket.send(JSON.stringify({ type: "subscribe", matchId }));
    const inicial = (await leer()).snapshot as {
      version: number;
      accionesDisponibles: readonly { type: string }[];
    };
    assert.ok(inicial.accionesDisponibles.some((accion) => accion.type === "announce-flor"));

    socket.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "flor-ws",
        expectedVersion: inicial.version,
        action: { type: "announce-flor" },
      }),
    );
    assert.equal((await leer()).type, "game.confirmed");
    const posterior = (await leer()).snapshot as {
      version: number;
      accionesDisponibles: readonly { type: string }[];
    };
    assert.equal(
      posterior.accionesDisponibles.some(
        (accion) => accion.type === "envido" || accion.type === "raise-envido",
      ),
      false,
    );

    socket.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "envido-despues-de-flor-ws",
        expectedVersion: posterior.version,
        action: { type: "envido", canto: "envido" },
      }),
    );
    assert.deepEqual(await leer(), {
      type: "game.rejected",
      actionId: "envido-despues-de-flor-ws",
      code: "flor-ya-anunciada",
      version: posterior.version,
    });
    assert.equal(
      recibidos.some((mensaje) => mensaje.type === "error"),
      false,
    );
  } finally {
    socket.close();
    await once(socket, "close");
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
  }
});

test("6C.7.3a.1: el historial publico es estable, ordenado y no filtra datos privados", () => {
  const repositorio = new RepositorioPartidasEnMemoria(
    { enteroInclusivo: () => 0 },
    {
      decidir: ({ accionesLegales }) =>
        accionesLegales.find((accion) => accion.tipo === "jugar-carta") ??
        accionesLegales[0] ??
        null,
    },
  );
  const creada = repositorio.crearSesion("Ana");
  const humano = repositorio.autenticar(creada.token);
  const partida = repositorio.crearPartida(humano, 40, true);
  const inicial = repositorio.snapshot(partida.id, humano);
  if (inicial.estado !== "iniciada") throw new Error("La partida debía iniciarse.");
  assert.equal(inicial.turno, inicial.asientoPropio);
  const carta = inicial.cartasPropias[0];
  assert.ok(carta);

  const resultado = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "historial-1",
    expectedVersion: inicial.version,
    action: { type: "play-card", card: carta },
  });
  assert.equal(resultado.aceptada, true, resultado.codigo);
  const posterior = repositorio.snapshot(partida.id, humano);
  if (posterior.estado !== "iniciada") throw new Error("La partida debía seguir iniciada.");
  assert.ok(posterior.eventosPublicos.length >= 1);
  assert.deepEqual(
    posterior.eventosPublicos.map((evento) => evento.secuencia),
    [...posterior.eventosPublicos.map((evento) => evento.secuencia)].sort((a, b) => a - b),
  );
  assert.equal(
    new Set(posterior.eventosPublicos.map((evento) => evento.secuencia)).size,
    posterior.eventosPublicos.length,
  );
  assert.ok(posterior.eventosPublicos.every((evento) => evento.idMano === "mano-1"));
  assert.ok(posterior.eventosPublicos.some((evento) => evento.tipo === "carta-jugada"));
  const recuperado = repositorio.snapshot(partida.id, humano);
  if (recuperado.estado !== "iniciada") throw new Error("La partida debía seguir iniciada.");
  assert.deepEqual(recuperado.eventosPublicos, posterior.eventosPublicos);

  const repetida = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "historial-1",
    expectedVersion: inicial.version,
    action: { type: "play-card", card: carta },
  });
  assert.deepEqual(repetida, resultado);
  const trasRepetida = repositorio.snapshot(partida.id, humano);
  if (trasRepetida.estado !== "iniciada") throw new Error("La partida debía seguir iniciada.");
  assert.deepEqual(trasRepetida.eventosPublicos, posterior.eventosPublicos);

  for (let paso = 2; paso < 8; paso++) {
    const actual = repositorio.snapshot(partida.id, humano);
    if (actual.estado !== "iniciada" || actual.turno !== actual.asientoPropio) continue;
    const siguienteCarta = actual.cartasPropias[0];
    if (!siguienteCarta) continue;
    const accion = repositorio.aplicarAccion(partida.id, humano, {
      actionId: `historial-${paso}`,
      expectedVersion: actual.version,
      action: { type: "play-card", card: siguienteCarta },
    });
    assert.equal(accion.aceptada, true, accion.codigo);
  }
  const secuenciaCompleta = repositorio.snapshot(partida.id, humano);
  if (secuenciaCompleta.estado !== "iniciada") throw new Error("La partida debía seguir iniciada.");
  assert.ok(
    secuenciaCompleta.eventosPublicos.filter((evento) => evento.tipo === "carta-jugada").length >=
      4,
  );
  assert.ok(
    secuenciaCompleta.eventosPublicos.some(
      (evento) => evento.tipo === "carta-jugada" && evento.asiento !== inicial.asientoPropio,
    ),
  );
  const serializado = JSON.stringify(posterior.eventosPublicos);
  assert.equal(serializado.includes("__maquina__"), false);
  assert.equal(serializado.includes('"carta":'), false);
  assert.equal(serializado.includes('"tanto":'), false);
});

function cartasPublicas(snapshot: unknown): readonly { asiento: number; carta: Carta }[] {
  const proyeccion = snapshot as {
    bazasCompletadas?: readonly { jugadas: readonly { asiento: number; carta: Carta }[] }[];
    bazaActual?: { jugadas: readonly { asiento: number; carta: Carta }[] };
  };
  return [
    ...(proyeccion.bazasCompletadas?.flatMap((baza) => baza.jugadas) ?? []),
    ...(proyeccion.bazaActual?.jugadas ?? []),
  ];
}

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
  assert.equal(snapshot.cartasRivalesRestantes, 3);
  assert.deepEqual(snapshot.bazasCompletadas, []);
  assert.deepEqual(snapshot.bazaActual, { asientoGanador: null, jugadas: [] });
  assert.equal(JSON.stringify(snapshot).includes("__maquina__"), false);
});

test("6C.7.2b: play-card web contra la máquina confirma y publica el snapshot", async () => {
  const servidor = crearServidor({
    aleatoriedad: { enteroInclusivo: (maximo) => Math.min(1, maximo) },
  });
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const http = `http://127.0.0.1:${direccion.port}`;
  const socket = new WebSocket(`ws://127.0.0.1:${direccion.port}/ws`);
  const recibidos: Record<string, unknown>[] = [];
  socket.on("message", (datos: Buffer) => recibidos.push(JSON.parse(datos.toString("utf8"))));
  const leer = async (): Promise<Record<string, unknown>> => {
    for (let intento = 0; intento < 100; intento++) {
      const mensaje = recibidos.shift();
      if (mensaje) return mensaje;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error("No se recibió respuesta WebSocket.");
  };

  try {
    const sesion = await fetch(`${http}/api/guest-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "Ana" }),
    });
    const { token } = (await sesion.json()) as { token: string };
    const creada = await fetch(`${http}/api/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "1v1-vs-machine", targetScore: 40 }),
    });
    const { matchId } = (await creada.json()) as { matchId: string };
    if (socket.readyState !== WebSocket.OPEN) await once(socket, "open");
    socket.send(JSON.stringify({ type: "auth", token }));
    assert.equal((await leer()).type, "auth.ok");
    socket.send(JSON.stringify({ type: "subscribe", matchId }));
    const inicial = (await leer()).snapshot as {
      version: number;
      cartasPropias: Carta[];
      turno: number;
      asientoPropio: number;
    };
    assert.equal(inicial.turno, inicial.asientoPropio);
    const carta = inicial.cartasPropias[0];
    assert.ok(carta);
    socket.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "play-1",
        expectedVersion: inicial.version,
        action: { type: "play-card", card: carta },
      }),
    );
    const confirmacion = await leer();
    assert.equal(confirmacion.type, "game.confirmed");
    assert.equal(confirmacion.actionId, "play-1");
    assert.ok((confirmacion.version as number) > inicial.version);
    const posterior = (await leer()).snapshot as {
      idMano: string;
      cartasPropias: Carta[];
      cartasRivalesRestantes: number;
      turno: number | null;
      desafiosPendientes: unknown;
      bazaActual: { asientoGanador: number | null; jugadas: readonly { carta: Carta }[] };
      marcador: readonly { asiento: number; puntos: number }[];
      eventosPublicos: readonly { tipo: string }[];
      ultimoCierre: unknown;
    };
    assert.equal(posterior.idMano, "mano-1");
    assert.equal(posterior.ultimoCierre, null);
    assert.equal(posterior.cartasPropias.length, 2);
    assert.equal(posterior.cartasRivalesRestantes, 3);
    assert.equal(posterior.bazaActual.asientoGanador, null);
    assert.equal(posterior.turno, 1);
    assert.deepEqual(posterior.desafiosPendientes, {
      envido: null,
      flor: null,
      truco: { nivel: "truco", proponente: 1 },
      oportunidadFlorPropia: false,
    });
    assert.deepEqual(posterior.marcador, [
      { asiento: 0, puntos: 0 },
      { asiento: 1, puntos: 3 },
    ]);
    assert.deepEqual(
      posterior.eventosPublicos.map((evento) => evento.tipo),
      ["carta-jugada", "flor-anunciada", "flor-adjudicada", "truco-propuesto"],
    );
    assert.deepEqual(
      posterior.bazaActual.jugadas.map((jugada) => jugada.carta),
      [carta],
    );
  } finally {
    socket.close();
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
  }
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
  const inicial = repositorio.snapshot(partida.id, humano);
  assert.equal(inicial.estado, "iniciada");
  const retiro = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "mazo-0",
    expectedVersion: inicial.version,
    action: inicial.desafiosPendientes.oportunidadFlorPropia
      ? { type: "announce-flor" }
      : { type: "go-to-mazo" },
  });
  assert.equal(retiro.aceptada, true, retiro.codigo);
  const cierre = repositorio.snapshot(partida.id, humano);
  if (cierre.estado !== "iniciada") throw new Error("La partida debía conservar el cierre.");
  assert.ok(cierre.continuacion);
  const continuar = repositorio.aplicarAccion(partida.id, humano, {
    actionId: "continuar-mazo-0",
    expectedVersion: cierre.version,
    action: { type: "continue-hand", handId: cierre.continuacion.idMano },
  });
  assert.equal(continuar.aceptada, true, continuar.codigo);
  const siguiente = repositorio.snapshot(partida.id, humano);
  if (siguiente.estado !== "iniciada")
    throw new Error("La partida debía iniciar la mano siguiente.");
  assert.equal(siguiente.idMano, "mano-2");
  assert.equal(siguiente.continuacion, null);
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
    cartasPublicasMaximas = Math.max(cartasPublicasMaximas, cartasPublicas(snapshot).length);
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
  const serializadoFinal = JSON.stringify(final);
  assert.equal(serializadoFinal.includes("__maquina__"), false, serializadoFinal);
  assert.equal(serializadoFinal.includes("comprobacionInterna"), false, serializadoFinal);
  assert.doesNotMatch(serializadoFinal, /jugadorId|token|canonico/i);
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
  assert.match(resultado.stderr, /Configuraci\u00f3n inv\u00e1lida:.*TRUCO_SERVER_PORT/);
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

    const inexistente = await fetch(`${url}/assets/inexistente.js`);
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

test("servidor HTTP: sirve la web compilada, fallback SPA y conserva las rutas API", async () => {
  const directorioWeb = await mkdtemp(join(tmpdir(), "truco-web-estatica-"));
  await mkdir(join(directorioWeb, "assets"));
  await writeFile(join(directorioWeb, "index.html"), "<main>Truco local</main>");
  await writeFile(join(directorioWeb, "assets", "app.js"), "console.log('Truco');");
  const servidor = crearServidor({ directorioWeb });
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion !== "string");
  const url = `http://127.0.0.1:${direccion.port}`;
  try {
    const inicio = await fetch(`${url}/`);
    assert.equal(inicio.status, 200);
    assert.equal(inicio.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(await inicio.text(), "<main>Truco local</main>");

    const rutaAplicacion = await fetch(`${url}/partida/local`);
    assert.equal(rutaAplicacion.status, 200);
    assert.equal(await rutaAplicacion.text(), "<main>Truco local</main>");

    const recurso = await fetch(`${url}/assets/app.js`);
    assert.equal(recurso.status, 200);
    assert.equal(recurso.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.equal(await recurso.text(), "console.log('Truco');");

    const recursoAusente = await fetch(`${url}/assets/ausente.js`);
    assert.equal(recursoAusente.status, 404);

    const apiAusente = await fetch(`${url}/api/inexistente`);
    assert.equal(apiAusente.status, 404);
    assert.notEqual(await apiAusente.text(), "<main>Truco local</main>");
  } finally {
    await new Promise<void>((resolve, reject) =>
      servidor.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directorioWeb, { recursive: true, force: true });
  }
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

    const ana = await crearSesion("Ana\u0020N\u00fa\u00f1ez");
    const beto = await crearSesion("Beto_2");
    const carla = await crearSesion("Carla-3");
    assert.notEqual(ana.token, beto.token);
    assert.equal(ana.apodo, "Ana\u0020N\u00fa\u00f1ez");
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
      bazasCompletadas: unknown[];
      bazaActual: { jugadas: unknown[] };
    };
    assert.equal(snapshotAna.cartasPropias.length, 3);
    assert.notDeepEqual(snapshotAna.cartasPropias, snapshotBeto.cartasPropias);
    assert.equal(snapshotAna.participantes.length, 2);
    assert.equal(cartasPublicas(snapshotAna).length, 0);
    const serializado = JSON.stringify(snapshotAna);
    assert.doesNotMatch(serializado, /canonico|entregas|jugadorId|token/i);
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
    bazasCompletadas: unknown[];
    bazaActual: { jugadas: unknown[] };
    marcador: readonly { asiento: number; puntos: number }[];
    desafiosPendientes: { envido: unknown; flor: unknown; truco: unknown };
    idMano: string;
    continuacion: { idMano: string } | null;
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
        assert.ok(snapshotBeto.continuacion);
        assert.equal(snapshotBeto.continuacion.idMano, snapshotBeto.idMano);
        socketBeto.send(
          JSON.stringify({
            type: "game.action",
            matchId,
            actionId: `continuar-beto-${mano}`,
            expectedVersion: snapshotBeto.version,
            action: { type: "continue-hand", handId: snapshotBeto.continuacion.idMano },
          }),
        );
        assert.equal((await leerBeto()).type, "game.confirmed");
        snapshotBeto = (await leerBeto()).snapshot as SnapshotPartida;
        snapshotAna = (await leerAna()).snapshot as SnapshotPartida;
        assert.ok(snapshotBeto.continuacion);
        socketAna.send(
          JSON.stringify({
            type: "game.action",
            matchId,
            actionId: `continuar-ana-${mano}`,
            expectedVersion: snapshotAna.version,
            action: { type: "continue-hand", handId: snapshotAna.continuacion!.idMano },
          }),
        );
        assert.equal((await leerAna()).type, "game.confirmed");
        snapshotAna = (await leerAna()).snapshot as SnapshotPartida;
        snapshotBeto = (await leerBeto()).snapshot as SnapshotPartida;
        assert.notEqual(snapshotBeto.repartidor, repartidores.at(-1));
        repartidores.push(snapshotBeto.repartidor);
        assert.equal(cartasPublicas(snapshotBeto).length, 0);
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
    // Cada mazo confirmado y cada una de las dos confirmaciones humanas de las
    // manos no terminales son transiciones autoritativas observables.
    assert.equal(snapshotBeto.version, versionInicial + metaPuntos + 2 * (metaPuntos - 1));
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
    bazasCompletadas: unknown[];
    bazaActual: { jugadas: unknown[] };
    marcador: readonly { asiento: number; puntos: number }[];
    desafiosPendientes: { envido: unknown; flor: unknown; truco: unknown };
    idMano: string;
    continuacion: { idMano: string } | null;
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

    while (jugadas.length < 4 && snapshotBeto.repartidor === repartidorInicial) {
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
          cartasPublicas(snapshotAna).some(
            (jugada) =>
              jugada.asiento === asiento && JSON.stringify(jugada.carta) === JSON.stringify(carta),
          ),
        );
        assert.equal(cartasPublicas(snapshotAna).length, jugadas.length);
      }
    }

    assert.equal(jugadas.length, 4);
    assert.equal(jugadas.length / 2, 2);
    assert.ok(snapshotBeto.continuacion);
    assert.equal(snapshotBeto.continuacion.idMano, snapshotBeto.idMano);
    assert.equal(snapshotBeto.repartidor, repartidorInicial);
    socketBeto.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "continuar-beto",
        expectedVersion: snapshotBeto.version,
        action: { type: "continue-hand", handId: snapshotBeto.continuacion.idMano },
      }),
    );
    assert.equal((await leerBeto()).type, "game.confirmed");
    snapshotBeto = (await leerBeto()).snapshot as SnapshotMano;
    snapshotAna = (await leerAna()).snapshot as SnapshotMano;
    assert.ok(snapshotBeto.continuacion);
    assert.equal(snapshotBeto.repartidor, repartidorInicial);
    socketAna.send(
      JSON.stringify({
        type: "game.action",
        matchId,
        actionId: "continuar-ana",
        expectedVersion: snapshotAna.version,
        action: { type: "continue-hand", handId: snapshotAna.continuacion!.idMano },
      }),
    );
    assert.equal((await leerAna()).type, "game.confirmed");
    snapshotAna = (await leerAna()).snapshot as SnapshotMano;
    snapshotBeto = (await leerBeto()).snapshot as SnapshotMano;
    assert.notEqual(snapshotBeto.repartidor, repartidorInicial);
    assert.equal(cartasPublicas(snapshotAna).length, 0);
    assert.equal(cartasPublicas(snapshotBeto).length, 0);
    assert.deepEqual(snapshotAna.marcador, [
      { asiento: 0, puntos: 0 },
      { asiento: 1, puntos: conTruco ? 2 : 1 },
    ]);
    assert.deepEqual(snapshotBeto.marcador, snapshotAna.marcador);
    assert.equal(snapshotBeto.repartidor, 1);
    assert.equal(snapshotBeto.version, versionInicial + jugadas.length + (conTruco ? 2 : 0) + 2);
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
    bazasCompletadas: unknown[];
    bazaActual: { jugadas: unknown[] };
    marcador: readonly { asiento: number; puntos: number }[];
    desafiosPendientes: { envido: unknown; flor: unknown; truco: unknown };
    idMano: string;
    continuacion: { idMano: string } | null;
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
      const manoAntesDeContinuar = snapshotAna.idMano;
      assert.equal(manoAntesDeContinuar, snapshotBeto.idMano);
      const publicas = new Set(
        cartasPublicas(snapshotAna).map((cartaPublica) => JSON.stringify(cartaPublica.carta)),
      );
      const privadasAna = snapshotAna.cartasPropias.filter(
        (cartaAna) => !publicas.has(JSON.stringify(cartaAna)),
      );
      const privadasBeto = snapshotBeto.cartasPropias.filter(
        (cartaBeto) => !publicas.has(JSON.stringify(cartaBeto)),
      );
      for (const cartaAna of privadasAna)
        assert.ok(
          !privadasBeto.some((cartaBeto) => JSON.stringify(cartaBeto) === JSON.stringify(cartaAna)),
        );
      for (const cartaBeto of privadasBeto)
        assert.ok(
          !privadasAna.some((cartaAna) => JSON.stringify(cartaAna) === JSON.stringify(cartaBeto)),
        );
      if (snapshotBeto.continuacion) {
        assert.equal(snapshotBeto.repartidor, repartidorActual);
        socketBeto.send(
          JSON.stringify({
            type: "game.action",
            matchId,
            actionId: `partida-continuar-beto-${manos + 1}`,
            expectedVersion: snapshotBeto.version,
            action: { type: "continue-hand", handId: snapshotBeto.continuacion.idMano },
          }),
        );
        assert.equal((await leerBeto()).type, "game.confirmed");
        snapshotBeto = (await leerBeto()).snapshot as SnapshotPartidaCartas;
        snapshotAna = (await leerAna()).snapshot as SnapshotPartidaCartas;
        assert.ok(snapshotBeto.continuacion);
        socketAna.send(
          JSON.stringify({
            type: "game.action",
            matchId,
            actionId: `partida-continuar-ana-${manos + 1}`,
            expectedVersion: snapshotAna.version,
            action: { type: "continue-hand", handId: snapshotAna.continuacion!.idMano },
          }),
        );
        assert.equal((await leerAna()).type, "game.confirmed");
        snapshotAna = (await leerAna()).snapshot as SnapshotPartidaCartas;
        snapshotBeto = (await leerBeto()).snapshot as SnapshotPartidaCartas;
      }
      assert.equal(snapshotAna.turno, snapshotBeto.turno);
      assert.deepEqual(cartasPublicas(snapshotAna), cartasPublicas(snapshotBeto));
      assert.deepEqual(snapshotAna.desafiosPendientes, snapshotBeto.desafiosPendientes);
      const puntosActuales = snapshotBeto.marcador.reduce((total, item) => total + item.puntos, 0);
      const nuevaMano =
        snapshotAna.cartasPropias.length === 3 &&
        snapshotBeto.cartasPropias.length === 3 &&
        cartasPublicas(snapshotBeto).length === 0;
      if (!nuevaMano && puntosActuales === puntosAnteriores) {
        assert.ok(
          cartasPublicas(snapshotAna).some(
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
          assert.equal(cartasPublicas(snapshotBeto).length, 0);
          assert.equal(cartasPublicas(snapshotAna).length, 0);
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
    assert.equal(
      snapshotBeto.version,
      versionInicial + cartasJugadas + trucosAceptados * 2 + 2 * (manos - 1),
    );
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
    0,
    ...eleccionesSinFlor,
    0,
    ...eleccionesSinFlor,
    0,
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
      bazasCompletadas: unknown[];
      bazaActual: { jugadas: unknown[] };
      cartasPropias: unknown[];
    };
    const actualizacionBeto = (await leerBeto()).snapshot as {
      version: number;
      bazasCompletadas: unknown[];
      bazaActual: { jugadas: unknown[] };
      cartasPropias: unknown[];
    };
    assert.equal(actualizacionAna.version, trasRetrucoBeto.version + 1);
    assert.equal(actualizacionAna.version, actualizacionBeto.version);
    assert.equal(cartasPublicas(actualizacionAna).length, 1);
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
      bazasCompletadas: unknown[];
      bazaActual: { jugadas: unknown[] };
    };
    const reintentoBeto = (await leerBeto()).snapshot as {
      version: number;
      bazasCompletadas: unknown[];
      bazaActual: { jugadas: unknown[] };
    };
    assert.equal(reintentoAna.version, actualizacionAna.version);
    assert.equal(cartasPublicas(reintentoBeto).length, 1);
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
      eventosPublicos: readonly {
        tipo: string;
        tantos?: readonly { asiento: number; tanto: number }[];
      }[];
    };
    const envidoBeto = (await leerBeto()).snapshot as {
      version: number;
      desafiosPendientes: { envido: unknown };
      marcador: readonly { asiento: number; puntos: number }[];
    };
    assert.equal(envidoAna.desafiosPendientes.envido, null);
    assert.equal(envidoAna.version, envidoBeto.version);
    assert.deepEqual(envidoAna.marcador, envidoBeto.marcador);
    const envidoAceptado = envidoAna.eventosPublicos.find(
      (evento) => evento.tipo === "envido-aceptado",
    );
    assert.ok(envidoAceptado?.tantos?.length === 2);
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
      bazasCompletadas: unknown[];
      bazaActual: { jugadas: unknown[] };
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
      bazasCompletadas: unknown[];
      bazaActual: { jugadas: unknown[] };
      desafiosPendientes: { truco: { nivel: string } | null };
    };
    assert.equal(actualizacionConcurrenciaBeto.version, concurrenciaBetoInicial.version + 1);
    assert.equal(actualizacionConcurrenciaAna.version, actualizacionConcurrenciaBeto.version);
    assert.deepEqual(actualizacionConcurrenciaAna.marcador, actualizacionConcurrenciaBeto.marcador);
    assert.ok(actualizacionConcurrenciaAna.marcador.every((item) => item.puntos === 0));
    if (confirmacionConcurrencia.actionId === "concurrencia-truco") {
      assert.equal(cartasPublicas(actualizacionConcurrenciaBeto).length, 0);
      assert.equal(actualizacionConcurrenciaBeto.cartasPropias.length, 3);
      assert.equal(actualizacionConcurrenciaAna.desafiosPendientes.truco?.nivel, "truco");
    } else {
      assert.equal(cartasPublicas(actualizacionConcurrenciaBeto).length, 1);
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
