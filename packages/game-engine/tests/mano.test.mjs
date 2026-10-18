import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barajarMazo,
  crearMazo,
  esMazoCompleto,
  identificarCarta,
  jugadorAnterior,
  obtenerEquipoManoOriginal,
  obtenerManoOriginal,
  obtenerOrdenReparto,
  obtenerPieza,
  prepararMano,
  seleccionarPrimerRepartidor,
  siguienteJugador,
  siguienteRepartidor,
  validarMesa,
} from "../dist/index.js";

const mesa = (n) => ({
  modalidad: n === 2 ? "1v1" : "2v2",
  jugadores: Array.from({ length: n }, (_, posicion) => ({
    id: `j${posicion}`,
    equipo: `e${posicion % 2}`,
    posicion,
  })),
});
const copia = (valor) => JSON.parse(JSON.stringify(valor));

test("modalidades, posiciones y equipos: valida y rechaza configuraciones incorrectas", () => {
  for (const n of [2, 4]) {
    const valida = mesa(n);
    validarMesa(valida);
    const casos = [
      { ...valida, modalidad: "3v3" },
      { ...valida, jugadores: valida.jugadores.slice(1) },
      { ...valida, jugadores: valida.jugadores.map((j) => ({ ...j, equipo: "e0" })) },
    ];
    for (const cambio of [
      { id: "j0" },
      { posicion: 0 },
      { posicion: n },
      { id: "" },
      { equipo: "" },
    ]) {
      const jugadores = copia(valida.jugadores);
      Object.assign(jugadores[1], cambio);
      casos.push({ ...valida, jugadores });
    }
    for (const caso of casos) assert.throws(() => validarMesa(caso), TypeError);
  }
  const noEnfrentados = mesa(4);
  noEnfrentados.jugadores[1].equipo = "e0";
  noEnfrentados.jugadores[2].equipo = "e1";
  assert.throws(() => validarMesa(noEnfrentados), TypeError);
  assert.throws(() => validarMesa(null), TypeError);
  assert.throws(() => validarMesa({ modalidad: "1v1", jugadores: Array(2) }), TypeError);
});

for (const n of [2, 4]) {
  test(`orden, reparto y rotación para cada repartidor en ${n} jugadores`, () => {
    const original = mesa(n);
    const desordenada = { ...original, jugadores: [...original.jugadores].reverse() };
    const mazo = crearMazo();
    const antes = copia({ desordenada, mazo });
    for (let r = 0; r < n; r++) {
      const id = `j${r}`;
      const esperado = Array.from({ length: n }, (_, i) => `j${(r + i + 1) % n}`);
      assert.equal(siguienteJugador(desordenada, id), esperado[0]);
      assert.equal(siguienteRepartidor(desordenada, id), esperado[0]);
      assert.equal(jugadorAnterior(desordenada, id), `j${(r + n - 1) % n}`);
      assert.equal(obtenerManoOriginal(desordenada, id), esperado[0]);
      assert.equal(obtenerEquipoManoOriginal(desordenada, id), `e${((r + 1) % n) % 2}`);
      assert.deepEqual(obtenerOrdenReparto(desordenada, id), esperado);
      const mano = prepararMano(desordenada, id, mazo);
      assert.deepEqual(mano, prepararMano(original, id, mazo));
      assert.equal(mano.repartidor, id);
      assert.equal(mano.manoOriginal, esperado[0]);
      assert.equal(mano.salidaPrimeraBaza, esperado[0]);
      assert.deepEqual(mano.ordenReparto, esperado);
      assert.deepEqual(
        mano.entregas.map((e) => e.jugador),
        [...esperado, ...esperado, ...esperado],
      );
      assert.deepEqual(
        mano.entregas.map((e) => e.carta),
        mazo.slice(0, 3 * n),
      );
      assert.deepEqual(mano.muestra, mazo[3 * n]);
      assert.deepEqual(mano.restantes, mazo.slice(3 * n + 1));
      assert.equal(mano.restantes.length, n === 2 ? 33 : 27);
      for (const jugador of mano.manos) {
        assert.equal(jugador.cartas.length, 3);
        assert.deepEqual(
          jugador.cartas,
          mano.entregas.filter((e) => e.jugador === jugador.jugador).map((e) => e.carta),
        );
      }
      assert.ok(
        esMazoCompleto([...mano.manos.flatMap((j) => j.cartas), mano.muestra, ...mano.restantes]),
      );
      let actual = id;
      for (let paso = 0; paso < n; paso++) actual = siguienteRepartidor(desordenada, actual);
      assert.equal(actual, id);
    }
    assert.deepEqual({ desordenada, mazo }, antes);
    assert.throws(() => prepararMano(original, "ausente", mazo), TypeError);
    assert.throws(() => prepararMano(original, "j0", [...mazo.slice(1), mazo[1]]), TypeError);
  });
}

test("selección uniforme por índices y validación de entradas", () => {
  for (const n of [2, 4]) {
    const m = mesa(n);
    assert.deepEqual(
      Array.from({ length: n }, (_, i) => seleccionarPrimerRepartidor(m, i)),
      m.jugadores.map((j) => j.id),
    );
    assert.equal(seleccionarPrimerRepartidor(m, 0), seleccionarPrimerRepartidor(m, 0));
    for (const invalida of [-1, n, 0.5, NaN, Infinity, "0", null])
      assert.throws(() => seleccionarPrimerRepartidor(m, invalida), TypeError);
  }
});

test("Fisher–Yates: elecciones explícitas, permutación y límites", () => {
  const mazo = crearMazo();
  const antes = copia(mazo);
  const identidad = Array.from({ length: 39 }, (_, i) => 39 - i);
  const ceros = Array(39).fill(0);
  assert.deepEqual(barajarMazo(mazo, identidad), mazo);
  const mezclado = barajarMazo(mazo, ceros);
  assert.deepEqual(mezclado, [...mazo.slice(1), mazo[0]]);
  assert.deepEqual(barajarMazo(mazo, ceros), mezclado);
  assert.ok(esMazoCompleto(mezclado));
  assert.deepEqual(new Set(mezclado.map(identificarCarta)), new Set(mazo.map(identificarCarta)));
  assert.deepEqual(mazo, antes);
  assert.notStrictEqual(mezclado[0], mazo[1]);
  // Con las demás elecciones iguales al límite, cada índice posible produce
  // exactamente el intercambio correspondiente en esa etapa.
  for (let i = 39; i > 0; i--) {
    for (let j = 0; j <= i; j++) {
      const elecciones = [...identidad];
      elecciones[39 - i] = j;
      const esperado = [...mazo];
      [esperado[i], esperado[j]] = [esperado[j], esperado[i]];
      assert.deepEqual(barajarMazo(mazo, elecciones), esperado);
    }
  }
  for (let i = 0; i < 39; i++) {
    const elecciones = [...identidad];
    elecciones[i] = 40 - i;
    assert.throws(() => barajarMazo(mazo, elecciones), TypeError);
    elecciones[i] = -1;
    assert.throws(() => barajarMazo(mazo, elecciones), TypeError);
  }
  for (const elecciones of [
    [],
    Array(39),
    [...ceros.slice(1), NaN],
    [...ceros.slice(1), 0.5],
    null,
  ])
    assert.throws(() => barajarMazo(mazo, elecciones), TypeError);
  assert.throws(() => barajarMazo(mazo.slice(1), ceros), TypeError);
});

test("muestra posterior al reparto compatible con piezas y alcahuete", () => {
  const mazo = crearMazo();
  const muestra = mazo.findIndex((c) => c.palo === "oro" && c.valor === 2);
  const alcahuete = mazo.findIndex((c) => c.palo === "oro" && c.valor === 12);
  [mazo[6], mazo[muestra]] = [mazo[muestra], mazo[6]];
  [mazo[0], mazo[alcahuete]] = [mazo[alcahuete], mazo[0]];
  const mano = prepararMano(mesa(2), "j0", mazo);
  assert.deepEqual(obtenerPieza(mano.entregas[0].carta, mano.muestra), {
    valorRepresentado: 2,
    jerarquia: 1,
    valorEspecial: 30,
    alcahuete: true,
  });
});
