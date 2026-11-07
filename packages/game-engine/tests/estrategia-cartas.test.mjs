import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crearEstadoManoCoordinada,
  crearEstadoPartida,
  crearMazo,
  crearObservacionJugadorAutomatico,
  evaluarCartaEstrategica,
  evaluarFuerzaCarta,
  ejecutarAccionPartida,
  ejecutarDecisionAutomatica,
  estimarIncertidumbre,
  identificarCarta,
  iniciarJuegoCartas,
  politicaEstrategicaCartas,
  prepararMano,
} from "../dist/index.js";

const c = (palo, valor) => ({ palo, valor });
const mesa = {
  modalidad: "1v1",
  jugadores: [
    { id: "humano", equipo: "H", posicion: 0 },
    { id: "maquina", equipo: "M", posicion: 1 },
  ],
};
const aleatoriedad = { siguiente: () => 0 };

function mazoCon(primeras) {
  const usadas = new Set(primeras.map(identificarCarta));
  return [...primeras, ...crearMazo().filter((carta) => !usadas.has(identificarCarta(carta)))];
}

// Repartidor máquina: humano recibe las posiciones 0, 2 y 4; máquina 1, 3 y 5.
function partida(primeras, muestra) {
  const mazo = mazoCon([...primeras, muestra]);
  return crearEstadoPartida(
    crearEstadoManoCoordinada(iniciarJuegoCartas(prepararMano(mesa, "maquina", mazo)), {
      metaPuntos: 40,
      puntajesIniciales: { H: 0, M: 0 },
      esDesempate: false,
    }),
  );
}

function jugar(estado, jugador, carta) {
  const resultado = ejecutarAccionPartida(estado, { tipo: "jugar-carta", jugador, carta });
  assert.equal(resultado.aceptada, true, resultado.aceptada ? "" : resultado.rechazo.codigo);
  return resultado.estado;
}

function decidir(estado) {
  const antes = JSON.stringify(estado);
  const resultado = ejecutarDecisionAutomatica(
    estado,
    "maquina",
    politicaEstrategicaCartas,
    aleatoriedad,
  );
  assert.equal(JSON.stringify(estado), antes, "la política no muta el estado canónico");
  assert.equal(resultado.aceptada, true, resultado.aceptada ? "" : resultado.rechazo.codigo);
  const evento = resultado.eventos.find((evento) => evento.tipo === "carta-jugada");
  assert.ok(evento);
  return evento.jugada.carta;
}

test("evalúa piezas y jerarquía con la consulta reglamentaria del motor", () => {
  const muestra = c("oro", 2);
  assert.equal(evaluarFuerzaCarta(c("oro", 12), muestra), 1);
  assert.equal(evaluarFuerzaCarta(c("espada", 1), muestra), 6);
  assert.ok(
    evaluarFuerzaCarta(c("espada", 1), muestra) > evaluarFuerzaCarta(c("oro", 12), muestra),
  );
});

test("al jugar segundo gana con la carta menos costosa y guarda la más fuerte", () => {
  let estado = partida(
    [c("copa", 7), c("espada", 4), c("copa", 6), c("oro", 3), c("copa", 5), c("espada", 1)],
    c("basto", 7),
  );
  estado = jugar(estado, "humano", c("copa", 7));
  assert.deepEqual(decidir(estado), c("oro", 3));
});

test("al jugar segundo sacrifica la más débil si ninguna puede ganar", () => {
  let estado = partida(
    [c("espada", 1), c("espada", 4), c("copa", 6), c("oro", 3), c("copa", 5), c("espada", 7)],
    c("basto", 7),
  );
  estado = jugar(estado, "humano", c("espada", 1));
  assert.deepEqual(decidir(estado), c("espada", 4));
});

test("reconoce la parda como mejor resultado que perder una baza", () => {
  let estado = partida(
    [c("espada", 3), c("oro", 3), c("copa", 6), c("espada", 4), c("copa", 5), c("oro", 2)],
    c("basto", 7),
  );
  estado = jugar(estado, "humano", c("espada", 3));
  assert.deepEqual(decidir(estado), c("oro", 3));
});

test("tras ganar la primera, al salir usa fuerza para buscar la segunda decisiva", () => {
  let estado = partida(
    [c("copa", 4), c("oro", 3), c("copa", 6), c("espada", 4), c("copa", 5), c("espada", 1)],
    c("basto", 7),
  );
  estado = jugar(estado, "humano", c("copa", 4));
  estado = jugar(estado, "maquina", c("oro", 3));
  assert.equal(estado.mano.juego.jugadorTurno, "maquina");
  assert.deepEqual(decidir(estado), c("espada", 1));
});

test("en tercera baza identifica una carta que define la mano", () => {
  let estado = partida(
    [c("copa", 4), c("oro", 3), c("espada", 1), c("espada", 4), c("copa", 5), c("espada", 7)],
    c("basto", 7),
  );
  estado = jugar(estado, "humano", c("copa", 4));
  estado = jugar(estado, "maquina", c("oro", 3));
  estado = jugar(estado, "maquina", c("espada", 4));
  estado = jugar(estado, "humano", c("espada", 1));
  // La salida de la tercera es humana (ganó la segunda); su 5 deja a máquina una victoria decisiva.
  estado = jugar(estado, "humano", c("copa", 5));
  const observacion = crearObservacionJugadorAutomatico(estado, "maquina");
  const evaluacion = evaluarCartaEstrategica(observacion, c("espada", 7));
  assert.equal(evaluacion.decisiva, "ganar-mano");
  assert.deepEqual(decidir(estado), c("espada", 7));
});

test("la incertidumbre sólo descarta hechos legítimos y es reproducible", () => {
  const estado = partida(
    [c("copa", 4), c("oro", 3), c("copa", 6), c("espada", 4), c("copa", 5), c("espada", 1)],
    c("basto", 7),
  );
  const observacion = crearObservacionJugadorAutomatico(estado, "maquina");
  const estimacion = estimarIncertidumbre(observacion, c("oro", 3));
  assert.equal(
    estimacion.cartasPosibles.some((carta) => identificarCarta(carta) === "oro:3"),
    false,
  );
  assert.equal(
    estimacion.cartasPosibles.some((carta) => identificarCarta(carta) === "basto:7"),
    false,
  );
  assert.deepEqual(estimacion, estimarIncertidumbre(observacion, c("oro", 3)));
});
