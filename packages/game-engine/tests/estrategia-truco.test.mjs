import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crearEstadoManoCoordinada,
  crearEstadoPartida,
  crearMazo,
  crearObservacionJugadorAutomatico,
  evaluarManoParaTruco,
  ejecutarAccionPartida,
  iniciarJuegoCartas,
  obtenerAccionesLegalesJugador,
  politicaEstrategicaTruco,
  prepararMano,
  seleccionarAccionTruco,
} from "../dist/index.js";

const c = (palo, valor) => ({ palo, valor });
const mesa = {
  modalidad: "1v1",
  jugadores: [
    { id: "humano", equipo: "H", posicion: 0 },
    { id: "maquina", equipo: "M", posicion: 1 },
  ],
};

function mazoCon(primeras) {
  const usadas = new Set(primeras.map((carta) => `${carta.palo}:${carta.valor}`));
  return [
    ...primeras,
    ...crearMazo().filter((carta) => !usadas.has(`${carta.palo}:${carta.valor}`)),
  ];
}

function partida(repartidor, primeras, muestra) {
  return crearEstadoPartida(
    crearEstadoManoCoordinada(
      iniciarJuegoCartas(prepararMano(mesa, repartidor, mazoCon([...primeras, muestra]))),
      { metaPuntos: 40, puntajesIniciales: { H: 0, M: 0 }, esDesempate: false },
    ),
  );
}

function aplicar(estado, accion) {
  const resultado = ejecutarAccionPartida(estado, accion);
  assert.equal(resultado.aceptada, true, resultado.aceptada ? "" : resultado.rechazo.codigo);
  return resultado.estado;
}

function decision(estado) {
  const observacion = crearObservacionJugadorAutomatico(estado, "maquina");
  const legales = obtenerAccionesLegalesJugador(estado, "maquina");
  const antes = JSON.stringify(observacion);
  const accion = seleccionarAccionTruco(observacion, legales);
  assert.equal(JSON.stringify(observacion), antes, "la evaluación no muta su observación");
  assert.ok(
    accion === null || legales.some((legal) => JSON.stringify(legal) === JSON.stringify(accion)),
  );
  return accion;
}

test("propone Truco con tres cartas competitivas, no sólo por una carta aislada", () => {
  // Repartidor humano: máquina abre; sus cartas son 1 espada, 3 y 2.
  const estado = partida(
    "humano",
    [c("espada", 1), c("copa", 4), c("oro", 3), c("copa", 5), c("basto", 2), c("copa", 6)],
    c("oro", 7),
  );
  assert.equal(decision(estado)?.tipo, "proponer-truco");
});

test("no propone Truco con mano débil y delega en la estrategia de cartas", () => {
  const estado = partida(
    "humano",
    [c("espada", 4), c("espada", 1), c("oro", 5), c("copa", 3), c("copa", 6), c("basto", 2)],
    c("oro", 7),
  );
  const observacion = crearObservacionJugadorAutomatico(estado, "maquina");
  const legales = obtenerAccionesLegalesJugador(estado, "maquina");
  assert.equal(decision(estado), null);
  const accion = politicaEstrategicaTruco.decidir({
    observacion,
    accionesLegales: legales,
    aleatoriedad: { siguiente: () => 0 },
  });
  assert.equal(accion?.tipo, "jugar-carta");
});

test("acepta Truco con dos cartas competitivas y rechaza una mano claramente desfavorable", () => {
  let favorable = partida(
    "maquina",
    [c("copa", 4), c("oro", 3), c("copa", 5), c("basto", 2), c("copa", 6), c("espada", 6)],
    c("oro", 7),
  );
  favorable = aplicar(favorable, { tipo: "proponer-truco", jugador: "humano" });
  assert.equal(
    decision(favorable)?.tipo,
    "quiero-truco",
    JSON.stringify(evaluarManoParaTruco(crearObservacionJugadorAutomatico(favorable, "maquina"))),
  );

  let desfavorable = partida(
    "maquina",
    [c("espada", 1), c("espada", 4), c("copa", 3), c("oro", 5), c("basto", 2), c("copa", 6)],
    c("oro", 7),
  );
  desfavorable = aplicar(desfavorable, { tipo: "proponer-truco", jugador: "humano" });
  assert.equal(
    decision(desfavorable)?.tipo,
    "no-quiero-truco",
    JSON.stringify(
      evaluarManoParaTruco(crearObservacionJugadorAutomatico(desfavorable, "maquina")),
    ),
  );
});

test("propone Retruco sólo con una ventaja alta", () => {
  let fuerte = partida(
    "maquina",
    [c("copa", 4), c("oro", 12), c("copa", 5), c("espada", 1), c("copa", 6), c("basto", 3)],
    c("oro", 2),
  );
  fuerte = aplicar(fuerte, { tipo: "proponer-truco", jugador: "humano" });
  assert.equal(
    decision(fuerte)?.tipo,
    "proponer-retruco",
    JSON.stringify(evaluarManoParaTruco(crearObservacionJugadorAutomatico(fuerte, "maquina"))),
  );

  let moderada = partida(
    "maquina",
    [c("copa", 4), c("oro", 3), c("copa", 5), c("basto", 2), c("copa", 6), c("espada", 6)],
    c("oro", 7),
  );
  moderada = aplicar(moderada, { tipo: "proponer-truco", jugador: "humano" });
  assert.equal(decision(moderada)?.tipo, "quiero-truco");
});

test("reconoce Vale Cuatro como aumento de máximo riesgo", () => {
  let estado = partida(
    "humano",
    [c("oro", 12), c("copa", 4), c("espada", 1), c("copa", 5), c("basto", 3), c("copa", 6)],
    c("oro", 2),
  );
  estado = aplicar(estado, { tipo: "proponer-truco", jugador: "maquina" });
  estado = aplicar(estado, { tipo: "quiero-truco", jugador: "humano" });
  estado = aplicar(estado, { tipo: "proponer-retruco", jugador: "humano" });
  estado = aplicar(estado, { tipo: "quiero-retruco", jugador: "maquina" });
  assert.equal(decision(estado)?.tipo, "proponer-vale-cuatro");
});
