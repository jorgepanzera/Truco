import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crearEstadoManoCoordinada,
  crearEstadoTemporalMano,
  crearMazo,
  ejecutarAccionTemporal,
  iniciarJuegoCartas,
  obtenerPausasDesconexionPendientes,
  obtenerTemporizadorAccionPendiente,
  prepararMano,
  seleccionarCartaMasDebil,
} from "../dist/index.js";

const c = (palo, valor) => ({ palo, valor });
const identidad = (carta) => `${carta.palo}:${carta.valor}`;
const contexto = { metaPuntos: 40, puntajesIniciales: { A: 0, B: 0 }, esDesempate: false };
const mesa1v1 = {
  modalidad: "1v1",
  jugadores: [
    { id: "a", equipo: "A", posicion: 0 },
    { id: "b", equipo: "B", posicion: 1 },
  ],
};

function temporal1v1(manos, muestra = c("espada", 7)) {
  const reparto = [manos[0][0], manos[1][0], manos[0][1], manos[1][1], manos[0][2], manos[1][2]];
  const usados = [...reparto, muestra];
  const mano = prepararMano(mesa1v1, "b", [
    ...reparto,
    muestra,
    ...crearMazo().filter(
      (carta) => !usados.some((usada) => identidad(carta) === identidad(usada)),
    ),
  ]);
  return crearEstadoTemporalMano(crearEstadoManoCoordinada(iniciarJuegoCartas(mano), contexto));
}

function temporal2v2() {
  const mesa = {
    modalidad: "2v2",
    jugadores: [
      { id: "a", equipo: "A", posicion: 0 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "d", equipo: "B", posicion: 3 },
    ],
  };
  const reparto = [
    c("copa", 3),
    c("oro", 1),
    c("espada", 3),
    c("basto", 1),
    c("copa", 6),
    c("basto", 6),
    c("espada", 6),
    c("oro", 6),
    c("copa", 7),
    c("oro", 5),
    c("espada", 7),
    c("copa", 5),
  ];
  const muestra = c("oro", 2);
  const usados = [...reparto, muestra];
  const mano = prepararMano(mesa, "d", [
    ...reparto,
    muestra,
    ...crearMazo().filter(
      (carta) => !usados.some((usada) => identidad(carta) === identidad(usada)),
    ),
  ]);
  return crearEstadoTemporalMano(crearEstadoManoCoordinada(iniciarJuegoCartas(mano), contexto));
}

function aplicar(estado, accion) {
  const antes = JSON.stringify(estado);
  const resultado = ejecutarAccionTemporal(estado, accion);
  assert.equal(resultado.aceptada, true, resultado.aceptada ? "" : resultado.rechazo.codigo);
  assert.equal(JSON.stringify(estado), antes, "la transición temporal debe ser inmutable");
  return resultado.estado;
}

test("vencimiento de carta usa fuerza real, palo y piezas", () => {
  assert.deepEqual(
    seleccionarCartaMasDebil([c("basto", 4), c("oro", 4), c("espada", 3)], c("copa", 7)),
    c("oro", 4),
  );
  assert.deepEqual(
    seleccionarCartaMasDebil([c("oro", 12), c("espada", 4), c("copa", 5)], c("oro", 2)),
    c("espada", 4),
    "el alcahuete no se confunde con el 12 ordinario",
  );
  let estado = temporal1v1([
    [c("espada", 3), c("oro", 4), c("copa", 4)],
    [c("basto", 1), c("oro", 6), c("copa", 5)],
  ]);
  const pendiente = obtenerTemporizadorAccionPendiente(estado);
  assert.deepEqual(pendiente, {
    clase: "turno-carta",
    jugadores: ["a"],
    duracionMs: 10000,
    version: 1,
  });
  const reproducible = ejecutarAccionTemporal(JSON.parse(JSON.stringify(estado)), {
    tipo: "vencer-accion",
    jugador: "a",
    version: pendiente.version,
  });
  estado = aplicar(estado, { tipo: "vencer-accion", jugador: "a", version: pendiente.version });
  assert.equal(reproducible.aceptada, true);
  assert.deepEqual(reproducible.estado, estado);
  assert.deepEqual(estado.mano.juego.bazaActual.jugadas[0].carta, c("oro", 4));
});

test("vencimiento canta Flor antes de jugar y prioriza desafíos", () => {
  let estado = temporal1v1([
    [c("copa", 3), c("copa", 6), c("copa", 7)],
    [c("basto", 1), c("oro", 6), c("espada", 5)],
  ]);
  let pendiente = obtenerTemporizadorAccionPendiente(estado);
  estado = aplicar(estado, { tipo: "vencer-accion", jugador: "a", version: pendiente.version });
  assert.deepEqual(
    estado.mano.flor.anuncios.map((anuncio) => anuncio.jugador),
    ["a"],
  );
  assert.equal(
    estado.mano.juego.cartasDisponibles.find((mano) => mano.jugador === "a").cartas.length,
    2,
  );

  estado = temporal1v1([
    [c("espada", 1), c("oro", 6), c("copa", 5)],
    [c("basto", 1), c("oro", 5), c("espada", 6)],
  ]);
  estado = aplicar(estado, { tipo: "accion", accion: { tipo: "proponer-truco", jugador: "a" } });
  estado = aplicar(estado, {
    tipo: "accion",
    accion: { tipo: "iniciar-envido", jugador: "a", canto: "envido" },
  });
  pendiente = obtenerTemporizadorAccionPendiente(estado);
  assert.equal(pendiente.clase, "respuesta-envido", "Envido suspende el Truco pendiente");
  estado = aplicar(estado, {
    tipo: "vencer-accion",
    jugador: "b",
    version: pendiente.version,
  });
  pendiente = obtenerTemporizadorAccionPendiente(estado);
  assert.equal(pendiente.clase, "respuesta-truco");
  const vencido = aplicar(estado, {
    tipo: "vencer-accion",
    jugador: "b",
    version: pendiente.version,
  });
  assert.equal(vencido.mano.juego.motivoFinalizacion, "rechazo-truco");
  assert.equal(
    ejecutarAccionTemporal(vencido, {
      tipo: "vencer-accion",
      jugador: "b",
      version: pendiente.version,
    }).rechazo.codigo,
    "temporizador-obsoleto",
  );
});

test("vencimientos responden No quiero en Flor y Envido", () => {
  let estado = temporal1v1(
    [
      [c("copa", 3), c("copa", 6), c("copa", 7)],
      [c("espada", 3), c("espada", 6), c("espada", 7)],
    ],
    c("oro", 2),
  );
  estado = aplicar(estado, { tipo: "accion", accion: { tipo: "anunciar-flor", jugador: "a" } });
  estado = aplicar(estado, { tipo: "accion", accion: { tipo: "anunciar-flor", jugador: "b" } });
  estado = aplicar(estado, {
    tipo: "accion",
    accion: { tipo: "proponer-contra-flor", jugador: "a" },
  });
  let pendiente = obtenerTemporizadorAccionPendiente(estado);
  assert.equal(pendiente.clase, "respuesta-flor");
  estado = aplicar(estado, { tipo: "vencer-accion", jugador: "b", version: pendiente.version });
  assert.equal(estado.mano.flor.historialDesafios.at(-1).respuesta, "no-quiero");

  estado = temporal1v1([
    [c("espada", 1), c("oro", 6), c("copa", 5)],
    [c("basto", 1), c("oro", 5), c("espada", 6)],
  ]);
  estado = aplicar(estado, {
    tipo: "accion",
    accion: { tipo: "iniciar-envido", jugador: "a", canto: "envido" },
  });
  pendiente = obtenerTemporizadorAccionPendiente(estado);
  assert.equal(pendiente.clase, "respuesta-envido");
  estado = aplicar(estado, { tipo: "vencer-accion", jugador: "b", version: pendiente.version });
  assert.equal(estado.mano.envido.resueltos[0].respuesta, "no-quiero");
});

test("Flor posterior al mazo vence secuencialmente y habilita el cierre 2v2", () => {
  let estado = temporal2v2();
  estado = aplicar(estado, { tipo: "accion", accion: { tipo: "irse-al-mazo", jugador: "b" } });
  estado = aplicar(estado, { tipo: "accion", accion: { tipo: "irse-al-mazo", jugador: "d" } });
  let pendiente = obtenerTemporizadorAccionPendiente(estado);
  assert.deepEqual(pendiente.jugadores, ["a"]);
  estado = aplicar(estado, { tipo: "vencer-accion", jugador: "a", version: pendiente.version });
  pendiente = obtenerTemporizadorAccionPendiente(estado);
  assert.deepEqual(pendiente.jugadores, ["c"]);
  estado = aplicar(estado, { tipo: "vencer-accion", jugador: "c", version: pendiente.version });
  assert.equal(obtenerTemporizadorAccionPendiente(estado), null);
  estado = aplicar(estado, { tipo: "accion", accion: { tipo: "cerrar-mano-mazo" } });
  assert.equal(estado.mano.ciclo.fase, "cierre-definitivo");
});

test("desconexión pausa, reconexión reinicia sólo el reloj de acción y vencimiento retira", () => {
  let estado = temporal1v1([
    [c("espada", 1), c("oro", 6), c("copa", 5)],
    [c("basto", 1), c("oro", 5), c("espada", 6)],
  ]);
  const original = JSON.parse(JSON.stringify(estado));
  estado = aplicar(estado, { tipo: "desconectar", jugador: "a" });
  const pausa = obtenerPausasDesconexionPendientes(estado)[0];
  assert.deepEqual(pausa, { jugador: "a", id: 1, duracionMs: 30000 });
  assert.equal(
    ejecutarAccionTemporal(estado, {
      tipo: "accion",
      accion: { tipo: "proponer-truco", jugador: "a" },
    }).rechazo.codigo,
    "partida-pausada",
  );
  estado = aplicar(estado, { tipo: "reconectar", jugador: "a" });
  assert.equal(obtenerTemporizadorAccionPendiente(estado).version, 3);
  assert.equal(
    ejecutarAccionTemporal(estado, { tipo: "vencer-desconexion", jugador: "a", pausaId: pausa.id })
      .rechazo.codigo,
    "vencimiento-desconexion-obsoleto",
  );

  estado = aplicar(estado, { tipo: "desconectar", jugador: "a" });
  const vencimiento = obtenerPausasDesconexionPendientes(estado)[0];
  estado = aplicar(estado, { tipo: "vencer-desconexion", jugador: "a", pausaId: vencimiento.id });
  assert.deepEqual(estado.mano.juego.retirados, ["a"]);
  assert.equal(estado.mano.juego.finalizada, true);
  assert.deepEqual(original, crearEstadoTemporalMano(original.mano));
});

test("vencimiento de desconexión es individual en 2v2 y conserva al compañero", () => {
  let estado = temporal2v2();
  estado = aplicar(estado, { tipo: "desconectar", jugador: "c" });
  const pausa = obtenerPausasDesconexionPendientes(estado)[0];
  estado = aplicar(estado, { tipo: "vencer-desconexion", jugador: "c", pausaId: pausa.id });
  assert.deepEqual(estado.mano.juego.retirados, ["c"]);
  assert.equal(estado.mano.juego.finalizada, false);
  assert.equal(estado.mano.juego.jugadorTurno, "a");
});

test("desconexiones simultáneas vencen secuencialmente y conservan la primera victoria", () => {
  let estado = temporal1v1([
    [c("espada", 1), c("oro", 6), c("copa", 5)],
    [c("basto", 1), c("oro", 5), c("espada", 6)],
  ]);
  estado = aplicar(estado, { tipo: "desconectar", jugador: "a" });
  const pausaA = obtenerPausasDesconexionPendientes(estado)[0];
  estado = aplicar(estado, { tipo: "desconectar", jugador: "b" });
  const pausaB = obtenerPausasDesconexionPendientes(estado).find((pausa) => pausa.jugador === "b");
  estado = aplicar(estado, { tipo: "vencer-desconexion", jugador: "a", pausaId: pausaA.id });
  assert.equal(estado.mano.juego.equipoGanador, "B");
  estado = aplicar(estado, { tipo: "vencer-desconexion", jugador: "b", pausaId: pausaB.id });
  assert.equal(estado.mano.juego.equipoGanador, "B");
  assert.deepEqual(estado.mano.juego.retirados, ["a"]);
  assert.deepEqual(obtenerPausasDesconexionPendientes(estado), []);
});
