import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contabilizarManoCerrada,
  crearEstadoManoCoordinada,
  crearEstadoPartida,
  crearMazo,
  ejecutarAccionPartida,
  iniciarJuegoCartas,
  prepararMano,
  siguienteMano,
} from "../dist/index.js";

const c = (palo, valor) => ({ palo, valor });
const identidad = (carta) => `${carta.palo}:${carta.valor}`;
const mesa = {
  modalidad: "2v2",
  jugadores: [
    { id: "a", equipo: "A", posicion: 0 },
    { id: "b", equipo: "B", posicion: 1 },
    { id: "c", equipo: "A", posicion: 2 },
    { id: "d", equipo: "B", posicion: 3 },
  ],
};

const primeras = [
  c("espada", 1),
  c("copa", 4),
  c("basto", 3),
  c("oro", 4),
  c("oro", 2),
  c("espada", 5),
  c("copa", 6),
  c("basto", 7),
  c("espada", 6),
  c("oro", 7),
  c("copa", 5),
  c("basto", 6),
  c("copa", 12),
];
const mazo = () => [
  ...primeras,
  ...crearMazo().filter(
    (carta) => !primeras.some((usada) => identidad(usada) === identidad(carta)),
  ),
];

function accion(partida, entrada) {
  const anterior = JSON.stringify(partida);
  const resultado = ejecutarAccionPartida(partida, entrada);
  assert.equal(resultado.aceptada, true, resultado.aceptada ? "" : resultado.rechazo.codigo);
  assert.equal(JSON.stringify(partida), anterior, "la API pública no muta la partida");
  return resultado.estado;
}

function cerrarValeCuatroPorMazo2v2(partida) {
  const equipo = (jugador) =>
    partida.mano.juego.mano.mesa.jugadores.find((item) => item.id === jugador).equipo;
  const activo = (equipoBuscado) =>
    partida.mano.juego.mano.mesa.jugadores.find((jugador) => jugador.equipo === equipoBuscado).id;
  const a = activo("A");
  const b = activo("B");
  const retiradosB = partida.mano.juego.mano.mesa.jugadores
    .filter((jugador) => jugador.equipo === "B")
    .map((jugador) => jugador.id);
  const mano = partida.mano.juego.jugadorTurno;
  const respondedor = equipo(mano) === "A" ? b : a;
  partida = accion(partida, { tipo: "proponer-truco", jugador: mano });
  partida = accion(partida, { tipo: "quiero-truco", jugador: respondedor });
  partida = accion(partida, { tipo: "proponer-retruco", jugador: respondedor });
  partida = accion(partida, { tipo: "quiero-retruco", jugador: mano });
  partida = accion(partida, { tipo: "proponer-vale-cuatro", jugador: mano });
  partida = accion(partida, { tipo: "quiero-vale-cuatro", jugador: respondedor });
  partida = accion(partida, { tipo: "irse-al-mazo", jugador: retiradosB[0] });
  partida = accion(partida, { tipo: "irse-al-mazo", jugador: retiradosB[1] });
  partida = accion(partida, { tipo: "cerrar-mano-mazo" });
  const contabilizada = contabilizarManoCerrada(partida);
  assert.equal(contabilizada.aceptada, true);
  assert.equal(contabilizarManoCerrada(contabilizada.estado).aceptada, false);
  return contabilizada.estado;
}

test("integración pública: 2v2 alcanza la meta sin doble adjudicación y rota cada mano", () => {
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(iniciarJuegoCartas(prepararMano(mesa, "d", mazo())), {
      metaPuntos: 30,
      puntajesIniciales: { A: 0, B: 0 },
      esDesempate: false,
    }),
  );
  const repartidores = [];
  for (let mano = 0; mano < 8; mano++) {
    repartidores.push(partida.mano.juego.mano.repartidor);
    partida = cerrarValeCuatroPorMazo2v2(partida);
    if (mano < 7) {
      const siguiente = siguienteMano(partida, mazo());
      assert.equal(siguiente.aceptada, true);
      partida = siguiente.estado;
    }
  }
  assert.equal(partida.fase, "partida-finalizada");
  assert.equal(partida.equipoGanador, "A");
  assert.deepEqual(partida.puntajes, { A: 32, B: 0 });
  assert.equal(partida.manosContabilizadas.length, 8);
  assert.equal(new Set(partida.manosContabilizadas.map((mano) => mano.idMano)).size, 8);
  assert.deepEqual(repartidores, ["d", "a", "b", "c", "d", "a", "b", "c"]);
});
