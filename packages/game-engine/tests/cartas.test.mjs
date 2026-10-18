import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PALOS,
  VALORES_NOMINALES,
  compararCartas,
  crearMazo,
  esCarta,
  esMazoCompleto,
  esMuestra,
  esPieza,
  hayCartasDuplicadas,
  identificarCarta,
  muestraEsPiezaPotencial,
  obtenerJerarquia,
  obtenerPaloMuestra,
  obtenerPieza,
  obtenerValorIndividual,
  sonCartasDisponibles,
} from "../dist/index.js";

const palos = ["oro", "copa", "espada", "basto"];
const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const piezas = [
  [2, 30],
  [4, 29],
  [5, 28],
  [11, 27],
  [10, 27],
];
const carta = (palo, valor) => ({ palo, valor });
const mismo = (a, b) => a.palo === b.palo && a.valor === b.valor;

// Referencia construida a partir de las 19 filas del reglamento, para cada muestra.
function categorias(muestra) {
  const sustituida = piezas.some(([valor]) => valor === muestra.valor);
  const pieza = (valor) => carta(muestra.palo, muestra.valor === valor ? 12 : valor);
  const distintas = (valor) =>
    palos
      .map((palo) => carta(palo, valor))
      .filter((c) => !mismo(c, muestra) && c.palo !== muestra.palo);
  const ordinarios = (valor) =>
    palos.map((palo) => carta(palo, valor)).filter((c) => !mismo(c, muestra));
  return [
    ...piezas.map(([valor]) => [pieza(valor)]),
    [carta("espada", 1)],
    [carta("basto", 1)],
    [carta("espada", 7)],
    [carta("oro", 7)],
    ordinarios(3),
    distintas(2),
    [carta("oro", 1), carta("copa", 1)],
    ordinarios(12).filter((c) => !(sustituida && c.palo === muestra.palo)),
    distintas(11),
    distintas(10),
    [carta("copa", 7), carta("basto", 7)],
    ordinarios(6),
    distintas(5),
    distintas(4),
  ].map((grupo) => grupo.filter((c) => !mismo(c, muestra)));
}

test("§2.2: mazo determinista de 40 combinaciones únicas", () => {
  const mazo = crearMazo();
  assert.equal(mazo.length, 40);
  assert.deepEqual(PALOS, palos);
  assert.deepEqual(VALORES_NOMINALES, valores);
  assert.ok(Object.isFrozen(PALOS) && Object.isFrozen(VALORES_NOMINALES));
  for (const palo of palos)
    assert.deepEqual(
      mazo.filter((c) => c.palo === palo).map((c) => c.valor),
      valores,
    );
  assert.equal(new Set(mazo.map(identificarCarta)).size, 40);
  assert.ok(mazo.every(esCarta));
  assert.ok(esMazoCompleto(mazo));
  assert.equal(hayCartasDuplicadas(mazo), false);
  assert.deepEqual(mazo, crearMazo());
  assert.notStrictEqual(mazo, crearMazo());
  assert.notStrictEqual(mazo[0], crearMazo()[0]);
});

test("valida palos, cartas, mazos inválidos y detecta duplicados", () => {
  for (const palo of palos) assert.ok(esCarta(carta(palo, 1)));
  for (const palo of ["oros", "copas", "espadas", "bastos", "comodin", ""])
    assert.equal(esCarta(carta(palo, 1)), false);
  for (const invalida of [
    null,
    undefined,
    [],
    {},
    carta("oro", 8),
    carta("espada", 9),
    carta("oro", "1"),
    carta("oro", NaN),
  ]) {
    assert.equal(esCarta(invalida), false);
    assert.equal(esMuestra(invalida), false);
    assert.throws(() => identificarCarta(invalida), TypeError);
  }
  const mazo = crearMazo();
  assert.equal(esMazoCompleto(mazo.slice(1)), false);
  assert.equal(esMazoCompleto([...mazo, mazo[0]]), false);
  assert.equal(esMazoCompleto([...mazo.slice(1), mazo[1]]), false);
  assert.equal(esMazoCompleto([...mazo.slice(1), carta("oro", 8)]), false);
  assert.equal(esMazoCompleto(Array(40)), false);
  assert.equal(esMazoCompleto(null), false);
  assert.ok(hayCartasDuplicadas([mazo[0], { valor: mazo[0].valor, palo: mazo[0].palo }]));
  assert.throws(() => hayCartasDuplicadas([mazo[0], mazo[0], carta("oro", 8)]), TypeError);
});

test("§3: las 40 muestras son válidas y no están disponibles", () => {
  const mazo = crearMazo();
  for (const muestra of mazo) {
    assert.ok(esMuestra(muestra));
    assert.equal(obtenerPaloMuestra(muestra), muestra.palo);
    assert.equal(
      muestraEsPiezaPotencial(muestra),
      piezas.some(([v]) => v === muestra.valor),
    );
    assert.equal(
      identificarCarta(muestra),
      identificarCarta({ valor: muestra.valor, palo: muestra.palo }),
    );
    const disponibles = mazo.filter((c) => !mismo(c, muestra));
    assert.ok(sonCartasDisponibles(muestra, disponibles));
    assert.equal(sonCartasDisponibles(muestra, [...disponibles, muestra]), false);
    assert.equal(sonCartasDisponibles(muestra, [disponibles[0], disponibles[0]]), false);
    assert.equal(sonCartasDisponibles(muestra, Array(1)), false);
    assert.throws(() => obtenerJerarquia(muestra, muestra), TypeError);
  }
  assert.throws(() => obtenerPaloMuestra(carta("oros", 1)), TypeError);
  assert.throws(() => sonCartasDisponibles(carta("oro", 8), []), TypeError);
});

test("§3: piezas y alcahuete en los cuatro palos y las 40 muestras", () => {
  for (const palo of palos) {
    for (const valorMuestra of valores) {
      const muestra = carta(palo, valorMuestra);
      for (const [indice, [valor, valorEspecial]] of piezas.entries()) {
        const sustituida = valor === valorMuestra;
        const actual = carta(palo, sustituida ? 12 : valor);
        assert.deepEqual(obtenerPieza(actual, muestra), {
          valorRepresentado: valor,
          jerarquia: indice + 1,
          valorEspecial,
          alcahuete: sustituida,
        });
        assert.ok(esPieza(actual, muestra));
        assert.equal(obtenerJerarquia(actual, muestra), indice + 1);
        assert.equal(obtenerValorIndividual(actual, muestra), valorEspecial);
        for (const otroPalo of palos.filter((p) => p !== palo))
          assert.equal(esPieza(carta(otroPalo, valor), muestra), false);
      }
      for (const otroPalo of palos.filter((p) => p !== palo))
        assert.equal(obtenerPieza(carta(otroPalo, 12), muestra), null);
      if (!piezas.some(([valor]) => valor === valorMuestra) && valorMuestra !== 12)
        assert.equal(obtenerPieza(carta(palo, 12), muestra), null);
    }
  }
});

test("§4: las 19 categorías y todas sus comparaciones para 40 muestras", () => {
  for (const muestra of crearMazo()) {
    const grupos = categorias(muestra);
    const referencia = new Map();
    for (const [indice, grupo] of grupos.entries())
      for (const c of grupo) {
        const id = identificarCarta(c);
        assert.equal(referencia.has(id), false, `${id} repetida para ${identificarCarta(muestra)}`);
        referencia.set(id, indice + 1);
      }
    assert.equal(referencia.size, 39);
    const disponibles = crearMazo().filter((c) => !mismo(c, muestra));
    for (const a of disponibles) {
      const fuerzaA = referencia.get(identificarCarta(a));
      assert.equal(obtenerJerarquia(a, muestra), fuerzaA);
      assert.equal(compararCartas(a, a, muestra), 0);
      for (const b of disponibles) {
        const fuerzaB = referencia.get(identificarCarta(b));
        const esperado = fuerzaA < fuerzaB ? 1 : fuerzaA > fuerzaB ? -1 : 0;
        assert.equal(compararCartas(a, b, muestra), esperado);
        assert.equal(compararCartas(b, a, muestra), esperado === 0 ? 0 : -esperado);
      }
    }
  }
});

test("§16.1: ejemplos de alcahuete, jerarquía y empates", () => {
  const oro2 = carta("oro", 2),
    espada11 = carta("espada", 11),
    muestra = carta("copa", 6);
  assert.equal(obtenerValorIndividual(carta("oro", 12), oro2), 30);
  assert.equal(obtenerJerarquia(carta("oro", 12), oro2), 1);
  assert.equal(sonCartasDisponibles(oro2, [oro2]), false);
  assert.equal(obtenerValorIndividual(carta("espada", 12), espada11), 27);
  assert.equal(compararCartas(carta("espada", 12), carta("espada", 10), espada11), 1);
  assert.equal(compararCartas(carta("copa", 11), carta("copa", 10), muestra), 1);
  assert.equal(
    obtenerValorIndividual(carta("copa", 11), muestra),
    obtenerValorIndividual(carta("copa", 10), muestra),
  );
  assert.equal(compararCartas(carta("espada", 1), carta("basto", 1), muestra), 1);
  assert.equal(compararCartas(carta("espada", 7), carta("oro", 7), muestra), 1);
  assert.equal(compararCartas(carta("oro", 3), carta("basto", 3), muestra), 0);
  assert.equal(obtenerValorIndividual(carta("copa", 12), carta("copa", 4)), 29);
  assert.equal(esPieza(carta("basto", 12), carta("basto", 7)), false);
});

test("§6.2: valores individuales ordinarios y dependencia de la muestra", () => {
  for (const muestra of crearMazo())
    for (const c of crearMazo().filter((v) => !mismo(v, muestra))) {
      const pieza = obtenerPieza(c, muestra);
      const esperado = pieza ? pieza.valorEspecial : c.valor <= 7 ? c.valor : 0;
      assert.equal(obtenerValorIndividual(c, muestra), esperado);
    }
  const c = carta("oro", 2);
  assert.equal(obtenerValorIndividual(c, carta("oro", 7)), 30);
  assert.equal(obtenerValorIndividual(c, carta("copa", 7)), 2);
  assert.notEqual(obtenerJerarquia(c, carta("oro", 7)), obtenerJerarquia(c, carta("copa", 7)));
});

test("pureza, validación de entradas y reproducibilidad", () => {
  const muestra = Object.freeze(carta("oro", 4));
  const a = Object.freeze(carta("oro", 12));
  const b = Object.freeze(carta("basto", 3));
  const cartas = Object.freeze([a, b]);
  const antes = JSON.stringify({ muestra, cartas });
  for (let i = 0; i < 2; i++) {
    assert.equal(sonCartasDisponibles(muestra, cartas), true);
    assert.equal(compararCartas(a, b, muestra), 1);
    assert.equal(obtenerPieza(a, muestra).valorEspecial, 29);
    assert.equal(hayCartasDuplicadas(cartas), false);
  }
  assert.equal(JSON.stringify({ muestra, cartas }), antes);
  for (const invalida of [null, carta("oros", 2), carta("oro", 9)]) {
    assert.throws(() => obtenerPieza(invalida, muestra), TypeError);
    assert.throws(() => obtenerJerarquia(a, invalida), TypeError);
    assert.throws(() => compararCartas(a, invalida, muestra), TypeError);
    assert.throws(() => obtenerValorIndividual(invalida, muestra), TypeError);
  }
});
