import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crearEstadoManoCoordinada,
  crearEstadoPartida,
  crearMazo,
  crearObservacionJugadorAutomatico,
  ejecutarAccionPartida,
  ejecutarDecisionAutomatica,
  iniciarJuegoCartas,
  obtenerAccionesLegalesJugador,
  prepararMano,
} from "../dist/index.js";

const mesa = {
  modalidad: "1v1",
  jugadores: [
    { id: "humano", equipo: "H", posicion: 0 },
    { id: "maquina", equipo: "M", posicion: 1 },
  ],
};

function partida() {
  return crearEstadoPartida(
    crearEstadoManoCoordinada(iniciarJuegoCartas(prepararMano(mesa, "humano", crearMazo())), {
      metaPuntos: 40,
      puntajesIniciales: { H: 0, M: 0 },
      esDesempate: false,
    }),
  );
}

const aleatoriedad = (valor) => ({ siguiente: () => valor });

test("observación automática sólo contiene cartas propias y hechos públicos", () => {
  const estado = partida();
  const observacion = crearObservacionJugadorAutomatico(estado, "humano");
  const cartasRival = estado.mano.juego.cartasDisponibles.find(
    (mano) => mano.jugador === "maquina",
  ).cartas;

  assert.deepEqual(observacion.cartasPropias, estado.mano.juego.cartasDisponibles[0].cartas);
  assert.equal(JSON.stringify(observacion).includes(JSON.stringify(cartasRival)), false);
  assert.equal("mano" in observacion, false);
  assert.equal("mazo" in observacion, false);
  assert.equal("entregas" in observacion, false);
});

test("las acciones legales son exactamente transiciones aceptadas por el motor", () => {
  const estado = partida();
  const legales = obtenerAccionesLegalesJugador(estado, "humano");

  assert.ok(legales.length > 0);
  for (const accion of legales) {
    const resultado = ejecutarAccionPartida(estado, { ...accion, jugador: "humano" });
    assert.equal(resultado.aceptada, true, JSON.stringify(accion));
  }
  assert.equal(
    legales.some((accion) => accion.tipo === "flor-y-truco"),
    false,
  );
});

test("el orquestador rechaza una decisión ajena al conjunto legal", () => {
  const resultado = ejecutarDecisionAutomatica(
    partida(),
    "humano",
    { decidir: () => ({ tipo: "proponer-vale-cuatro" }) },
    aleatoriedad(0),
  );

  assert.equal(resultado.aceptada, false);
  assert.equal(resultado.rechazo.codigo, "decision-ilegal");
});

test("políticas intercambiables reciben entradas reproducibles", () => {
  const elegida = [];
  const politica = {
    decidir: ({ accionesLegales, aleatoriedad: fuente }) => {
      const accion =
        accionesLegales[Math.floor(fuente.siguiente() * accionesLegales.length)] ?? null;
      elegida.push(accion);
      return accion;
    },
  };
  const primero = ejecutarDecisionAutomatica(partida(), "humano", politica, aleatoriedad(0));
  const segunda = ejecutarDecisionAutomatica(partida(), "humano", politica, aleatoriedad(0));

  assert.equal(primero.aceptada, true);
  assert.equal(segunda.aceptada, true);
  assert.deepEqual(elegida[0], elegida[1]);
});
