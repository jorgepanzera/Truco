import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crearMazo,
  cantidadActivosDelEquipo,
  equipoSinParticipantesActivos,
  esEstadoJuegoCartasValido,
  evaluarResultadosBazas,
  estaActivo,
  estaRetirado,
  ejecutarCarta,
  finalizarManoPorMazo,
  iniciarJuegoCartas,
  jugadoresActivos,
  jugadoresActivosDelEquipo,
  perteneceALaMesa,
  prepararMano,
  retirarJugadorDeBazas,
  resolverBaza,
  siguienteJugadorActivo,
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
  assert.equal(r.autorHistorico, "j0");
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
  assert.equal(p.autorHistorico, null);
  assert.equal(p.equipoGanador, null);
  assert.equal(p.salidaSiguiente, "j0");
  const empateCompaneros = resolverBaza(mesa(4), c("copa", 6), "j1", {
    salida: "j1",
    jugadas: [
      { jugador: "j1", carta: c("basto", 4) },
      { jugador: "j2", carta: c("oro", 3) },
      { jugador: "j3", carta: c("espada", 4) },
      { jugador: "j0", carta: c("copa", 3) },
    ],
  });
  assert.equal(empateCompaneros.equipoGanador, "e0");
  assert.equal(empateCompaneros.autorHistorico, "j2");
  assert.equal(empateCompaneros.salidaSiguiente, "j2");
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

test("retiro de bajo nivel conserva bazas históricas y salta al siguiente activo", () => {
  const preparada = mano(4, c("oro", 2), [
    [c("oro", 12), c("copa", 6), c("basto", 3)],
    [c("espada", 1), c("basto", 4), c("copa", 5)],
    [c("espada", 7), c("copa", 4), c("basto", 5)],
    [c("oro", 3), c("espada", 4), c("basto", 7)],
  ]);
  const inicial = iniciarJuegoCartas(preparada);
  const antes = JSON.stringify(inicial);
  const retiro = retirarJugadorDeBazas(inicial, "j1");
  assert.equal(retiro.aceptada, true);
  assert.deepEqual(retiro.estado.retirados, ["j1"]);
  assert.equal(retiro.estado.jugadorTurno, "j0");
  assert.equal(JSON.stringify(inicial), antes);
  let actual = retiro.estado;
  for (const jugador of ["j0", "j2", "j3"]) actual = jugar(actual, jugador);
  assert.equal(actual.bazasCompletadas.length, 1);
  assert.equal(actual.bazasCompletadas[0].resultado.equipoGanador, "e0");
  assert.equal(actual.jugadorTurno, "j0");
  assert.equal(esEstadoJuegoCartasValido(actual), true);
  assert.equal(retirarJugadorDeBazas(actual, "j1").rechazo.codigo, "jugador-retirado");
});

test("participación canónica deriva activos por asiento y valida retirados", () => {
  const cartas = crearMazo();
  const preparada = mano(4, cartas[12], [
    [cartas[0], cartas[4], cartas[8]],
    [cartas[1], cartas[5], cartas[9]],
    [cartas[2], cartas[6], cartas[10]],
    [cartas[3], cartas[7], cartas[11]],
  ]);
  const inicial = iniciarJuegoCartas(preparada);
  assert.deepEqual(jugadoresActivos(inicial), ["j0", "j1", "j2", "j3"]);
  assert.equal(perteneceALaMesa(inicial, "j2"), true);
  assert.equal(estaRetirado(inicial, "j2"), false);
  assert.equal(estaActivo(inicial, "j2"), true);
  const retirados = { ...inicial, retirados: ["j1", "j2"], jugadorTurno: null };
  assert.equal(esEstadoJuegoCartasValido(retirados), true);
  assert.deepEqual(jugadoresActivos(retirados), ["j0", "j3"]);
  assert.deepEqual(jugadoresActivosDelEquipo(retirados, "e0"), ["j0"]);
  assert.equal(cantidadActivosDelEquipo(retirados, "e1"), 1);
  assert.equal(
    equipoSinParticipantesActivos({ ...retirados, retirados: ["j1", "j3"] }, "e1"),
    true,
  );
  assert.equal(siguienteJugadorActivo(retirados, "j0"), "j3");
  assert.equal(siguienteJugadorActivo(retirados, "j3"), "j0");
  assert.equal(
    siguienteJugadorActivo({ ...retirados, retirados: ["j0", "j1", "j2", "j3"] }, "j0"),
    null,
  );
  assert.equal(esEstadoJuegoCartasValido({ ...retirados, retirados: ["j1", "j1"] }), false);
  assert.equal(esEstadoJuegoCartasValido({ ...retirados, retirados: ["nadie"] }), false);
  assert.deepEqual(retirados.mano, inicial.mano);
  assert.deepEqual(retirados.cartasDisponibles, inicial.cartasDisponibles);
});

test("retirados no omiten la integridad de cartas ni del historial", () => {
  const cartas = crearMazo();
  const inicial = iniciarJuegoCartas(
    mano(2, cartas[6], [
      [cartas[0], cartas[2], cartas[4]],
      [cartas[1], cartas[3], cartas[5]],
    ]),
  );
  const base = { ...inicial, retirados: ["j1"], jugadorTurno: null };
  assert.equal(esEstadoJuegoCartasValido(base), true);
  assert.equal(esEstadoJuegoCartasValido({ ...base, cartasDisponibles: [] }), false);
  const manoInventada = inicial.cartasDisponibles.map((m) => ({ ...m, cartas: [...m.cartas] }));
  manoInventada[0] = { ...manoInventada[0], cartas: [inicial.mano.muestra] };
  assert.equal(esEstadoJuegoCartasValido({ ...base, cartasDisponibles: manoInventada }), false);
  const manoDuplicada = inicial.cartasDisponibles.map((m) => ({ ...m, cartas: [...m.cartas] }));
  manoDuplicada[0] = {
    ...manoDuplicada[0],
    cartas: [manoDuplicada[0].cartas[0], manoDuplicada[0].cartas[0]],
  };
  assert.equal(esEstadoJuegoCartasValido({ ...base, cartasDisponibles: manoDuplicada }), false);
  const cartaA = inicial.cartasDisponibles[0].cartas[0];
  assert.equal(
    esEstadoJuegoCartasValido({
      ...base,
      bazaActual: { salida: "j0", jugadas: [{ jugador: "j1", carta: cartaA }] },
    }),
    false,
  );
  assert.equal(
    esEstadoJuegoCartasValido({
      ...base,
      bazaActual: { salida: "j0", jugadas: [{ jugador: "j0", carta: inicial.mano.muestra }] },
    }),
    false,
  );
  assert.equal(
    esEstadoJuegoCartasValido({
      ...base,
      bazaActual: { salida: "j0", jugadas: [{ jugador: "j0", carta: cartaA }] },
    }),
    false,
  );
  const sinOriginal = inicial.cartasDisponibles.map((m) => ({ ...m, cartas: [...m.cartas] }));
  sinOriginal[0] = { ...sinOriginal[0], cartas: sinOriginal[0].cartas.slice(1) };
  assert.equal(esEstadoJuegoCartasValido({ ...base, cartasDisponibles: sinOriginal }), false);
  const sinCampo = { ...base };
  delete sinCampo.retirados;
  assert.equal(esEstadoJuegoCartasValido(sinCampo), false);
});

test("finalizar por mazo exige y registra al retirado activo rival", () => {
  const inicial = iniciarJuegoCartas(prepararMano(mesa(2), "j1", crearMazo()));
  assert.equal(finalizarManoPorMazo(inicial, "e1", "j0").aceptada, true);
  const resultado = finalizarManoPorMazo(inicial, "e1", "j0");
  assert.deepEqual(resultado.estado.retirados, ["j0"]);
  assert.equal(finalizarManoPorMazo(inicial, "e0", "j0").aceptada, false);
  assert.equal(finalizarManoPorMazo(inicial, "e1", "nadie").aceptada, false);
});

test("inventario e historial se validan también al cerrar por bazas o mazo", () => {
  let porBazas = iniciarJuegoCartas(prepararMano(mesa(2), "j1", crearMazo()));
  while (!porBazas.finalizada) {
    const manoJugador = porBazas.cartasDisponibles.find((m) => m.jugador === porBazas.jugadorTurno);
    const resultado = ejecutarCarta(
      porBazas,
      { tipo: "jugar-carta", jugador: porBazas.jugadorTurno, carta: manoJugador.cartas[0] },
      undefined,
    );
    assert.equal(resultado.aceptada, true);
    porBazas = resultado.estado;
  }
  assert.equal(porBazas.motivoFinalizacion, "bazas");
  assert.equal(esEstadoJuegoCartasValido(porBazas), true);
  const inventarioAjeno = porBazas.cartasDisponibles.map((m) => ({
    jugador: m.jugador,
    cartas: m.cartas.map(() => porBazas.mano.muestra),
  }));
  assert.equal(
    esEstadoJuegoCartasValido({ ...porBazas, cartasDisponibles: inventarioAjeno }),
    false,
  );
  assert.equal(
    esEstadoJuegoCartasValido({
      ...porBazas,
      retirados: ["j0"],
      cartasDisponibles: inventarioAjeno,
    }),
    false,
  );
  const autorIncorrecto = JSON.parse(JSON.stringify(porBazas));
  autorIncorrecto.bazasCompletadas[0].jugadas[0].jugador = "j1";
  assert.equal(esEstadoJuegoCartasValido(autorIncorrecto), false);
  const cartaDuplicada = JSON.parse(JSON.stringify(porBazas));
  cartaDuplicada.bazasCompletadas[0].jugadas[1].carta =
    cartaDuplicada.bazasCompletadas[0].jugadas[0].carta;
  assert.equal(esEstadoJuegoCartasValido(cartaDuplicada), false);
  const mazoInicial = iniciarJuegoCartas(prepararMano(mesa(2), "j1", crearMazo()));
  const porMazo = finalizarManoPorMazo(mazoInicial, "e1", "j0");
  assert.equal(porMazo.aceptada, true);
  assert.equal(esEstadoJuegoCartasValido(porMazo.estado), true);
  assert.equal(
    esEstadoJuegoCartasValido({ ...porMazo.estado, cartasDisponibles: inventarioAjeno }),
    false,
  );
  assert.equal(
    esEstadoJuegoCartasValido({ ...mazoInicial, cartasDisponibles: inventarioAjeno }),
    false,
  );
});
