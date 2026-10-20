import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crearMazo,
  evaluarResultadosBazas,
  ejecutarCarta,
  iniciarJuegoCartas,
  prepararMano,
  resolverBaza,
} from "../dist/index.js";

const c = (palo, valor) => ({ palo, valor });
const id = (x) => `${x.palo}:${x.valor}`;
const mesa = (n) => ({
  modalidad: n === 2 ? "1v1" : "2v2",
  jugadores: Array.from({ length: n }, (_, posicion) => ({
    id: `j${posicion}`,
    equipo: `e${posicion % 2}`,
    posicion,
  })),
});
function mano(n, muestra, manos) {
  const reparto = [];
  for (let v = 0; v < 3; v++) for (let j = 0; j < n; j++) reparto.push(manos[j][v]);
  const usados = [...reparto, muestra];
  return prepararMano(mesa(n), `j${n - 1}`, [
    ...reparto,
    muestra,
    ...crearMazo().filter((x) => !usados.some((y) => id(x) === id(y))),
  ]);
}
function jugar(estado, jugador) {
  const carta = estado.cartasDisponibles.find((m) => m.jugador === jugador).cartas[0];
  const r = ejecutarCarta(estado, { tipo: "jugar-carta", jugador, carta }, undefined);
  assert.equal(r.aceptada, true);
  return r.estado;
}

test("inicializa 1v1 y 2v2 sin mutar la mano", () => {
  for (const n of [2, 4]) {
    const cartas = crearMazo();
    const manos = Array.from({ length: n }, (_, j) => [
      cartas[j],
      cartas[n + j],
      cartas[2 * n + j],
    ]);
    const preparada = mano(n, cartas[3 * n], manos),
      antes = JSON.stringify(preparada),
      estado = iniciarJuegoCartas(preparada);
    assert.equal(estado.jugadorTurno, "j0");
    assert.equal(estado.bazasCompletadas.length, 0);
    assert.ok(estado.cartasDisponibles.every((m) => m.cartas.length === 3));
    assert.equal(JSON.stringify(preparada), antes);
  }
});

test("resuelve piezas, alcahuete, parda y máximo por equipo sin sumar", () => {
  const r = resolverBaza(mesa(4), c("oro", 2), "j0", {
    salida: "j0",
    jugadas: [
      { jugador: "j0", carta: c("oro", 12) },
      { jugador: "j1", carta: c("espada", 1) },
      { jugador: "j2", carta: c("copa", 6) },
      { jugador: "j3", carta: c("basto", 3) },
    ],
  });
  assert.equal(r.equipoGanador, "e0");
  assert.equal(r.jerarquiaMaxima, 1);
  assert.equal(r.salidaSiguiente, "j0");
  const p = resolverBaza(mesa(4), c("copa", 6), "j0", {
    salida: "j1",
    jugadas: [
      { jugador: "j1", carta: c("basto", 3) },
      { jugador: "j2", carta: c("oro", 3) },
      { jugador: "j3", carta: c("basto", 4) },
      { jugador: "j0", carta: c("espada", 4) },
    ],
  });
  assert.equal(p.equipoGanador, null);
  assert.equal(p.salidaSiguiente, "j0");
});

test("tabla exhaustiva §5.2 y rechazo de tercera innecesaria", () => {
  const filas = [
    [["A", "A"], "A"],
    [["B", "B"], "B"],
    [["A", null], "A"],
    [["B", null], "B"],
    [[null, "A"], "A"],
    [[null, "B"], "B"],
    [["A", "B", "A"], "A"],
    [["A", "B", "B"], "B"],
    [["A", "B", null], "A"],
    [["B", "A", "A"], "A"],
    [["B", "A", "B"], "B"],
    [["B", "A", null], "A"],
    [[null, null, "A"], "A"],
    [[null, null, "B"], "B"],
    [[null, null, null], "A"],
  ];
  for (const [bazas, ganador] of filas)
    assert.equal(evaluarResultadosBazas(["A", "B"], "A", bazas).equipoGanador, ganador);
  assert.equal(evaluarResultadosBazas(["A", "B"], "B", ["A", "B"]).debeAbrirBaza, true);
  assert.throws(() => evaluarResultadosBazas(["A", "B"], "A", ["A", null, "B"]));
});

test("turnos y transición rechazan jugadas fuera de turno sin mutar", () => {
  const preparada = mano(2, c("oro", 7), [
    [c("espada", 1), c("oro", 3), c("oro", 4)],
    [c("basto", 7), c("copa", 4), c("copa", 5)],
  ]);
  let estado = iniciarJuegoCartas(preparada),
    antes = JSON.stringify(estado);
  assert.equal(
    ejecutarCarta(estado, { tipo: "jugar-carta", jugador: "j1", carta: c("basto", 7) }, undefined)
      .rechazo.codigo,
    "fuera-de-turno",
  );
  assert.equal(JSON.stringify(estado), antes);
  estado = jugar(estado, "j0");
  assert.equal(estado.jugadorTurno, "j1");
  assert.equal(estado.bazaActual.jugadas.length, 1);
});
