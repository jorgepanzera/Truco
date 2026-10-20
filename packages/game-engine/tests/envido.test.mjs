import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calcularFaltaEnvido,
  calcularTantoEnvido,
  compararTantosEnvido,
  aumentarEnvido,
  aumentarEnvidoEnJuego,
  crearEstadoEnvido,
  crearMazo,
  ejecutarCartaConEnvido,
  iniciarEnvido,
  iniciarCadenaEnvido,
  iniciarJuegoCartas,
  prepararMano,
  rechazarEnvido,
  responderQuiero,
  responderNoQuiero,
  tieneFlor,
} from "../dist/index.js";
const c = (palo, valor) => ({ palo, valor });
test("§6.2: tanto, Flor y Falta Envido", () => {
  assert.deepEqual(calcularTantoEnvido([c("oro", 6), c("oro", 7), c("basto", 3)], c("copa", 6)), {
    tieneFlor: false,
    tanto: 33,
  });
  assert.deepEqual(calcularTantoEnvido([c("oro", 3), c("oro", 6), c("oro", 7)], c("copa", 6)), {
    tieneFlor: true,
  });
  assert.equal(calcularFaltaEnvido(40, { a: 12, b: 10 }, ["a", "b"], "a", false), 8);
});

test("Envido: transiciones puras y deterministas", () => {
  const { mano, estado } = estadoParaAceptacion();
  const antes = JSON.stringify(estado);
  const inicioA = iniciarEnvido(estado, "a", "envido");
  const inicioB = iniciarEnvido(JSON.parse(antes), "a", "envido");
  assert.equal(JSON.stringify(estado), antes);
  assert.deepEqual(inicioA, inicioB);
  const previo = JSON.stringify(inicioA.estado);
  const aumentoA = aumentarEnvidoEnJuego(inicioA.estado, "b", "envido");
  const aumentoB = aumentarEnvidoEnJuego(JSON.parse(previo), "b", "envido");
  assert.equal(JSON.stringify(inicioA.estado), previo);
  assert.deepEqual(aumentoA, aumentoB);
  const pendiente = JSON.stringify(aumentoA.estado);
  const noA = responderNoQuiero(aumentoA.estado, "a");
  const noB = responderNoQuiero(JSON.parse(pendiente), "a");
  assert.equal(JSON.stringify(aumentoA.estado), pendiente);
  assert.deepEqual(noA, noB);
  const carta = { tipo: "jugar-carta", jugador: "a", carta: mano.manos[0].cartas[0] };
  const juegoAntes = JSON.stringify(noA.estado);
  const cartaA = ejecutarCartaConEnvido(noA.estado, carta);
  const cartaB = ejecutarCartaConEnvido(JSON.parse(juegoAntes), carta);
  assert.equal(JSON.stringify(noA.estado), juegoAntes);
  assert.deepEqual(cartaA, cartaB);
});

test("cartas distinguen cadena corrupta, pendiente válida y cadena reinsertada", () => {
  const { mano, estado: base } = estadoParaAceptacion();
  const pendiente = iniciarEnvido(base, "a", "envido").estado;
  const accion = { tipo: "jugar-carta", jugador: "a", carta: mano.manos[0].cartas[0] };
  assert.equal(ejecutarCartaConEnvido(pendiente, accion).rechazo.codigo, "envido-pendiente");
  const corrupto = { ...pendiente, pendiente: { ...pendiente.pendiente, valorAceptado: 999 } };
  const antes = JSON.stringify(corrupto);
  assert.equal(ejecutarCartaConEnvido(corrupto, accion).rechazo.codigo, "estado-invalido");
  assert.equal(JSON.stringify(corrupto), antes);
  const cerrado = responderNoQuiero(pendiente, "b").estado;
  assert.equal(ejecutarCartaConEnvido(cerrado, accion).aceptada, true);
  const reinsertado = { ...cerrado, pendiente: pendiente.pendiente };
  assert.equal(ejecutarCartaConEnvido(reinsertado, accion).rechazo.codigo, "estado-invalido");
});

test("§6.4-6.5: rechaza valores derivados e historiales adulterados", () => {
  const { mano, estado: base } = estadoParaAceptacion();
  const inicio = iniciarEnvido(base, "a", "envido");
  const aumento = aumentarEnvidoEnJuego(inicio.estado, "b", "envido");
  const casos = [
    [
      "A1 valorAceptado",
      { ...inicio.estado, pendiente: { ...inicio.estado.pendiente, valorAceptado: 999 } },
      "quiero",
    ],
    [
      "A2 valorAnterior",
      { ...aumento.estado, pendiente: { ...aumento.estado.pendiente, valorAnteriorAceptado: 999 } },
      "no",
    ],
    [
      "B1 dos Real",
      {
        ...aumento.estado,
        pendiente: {
          ...aumento.estado.pendiente,
          cantos: [
            { jugador: "a", equipo: "A", canto: "real-envido" },
            { jugador: "b", equipo: "B", canto: "real-envido" },
          ],
        },
      },
      "no",
    ],
    [
      "B2 Envido tras Real",
      {
        ...aumento.estado,
        pendiente: {
          ...aumento.estado.pendiente,
          cantos: [
            { jugador: "a", equipo: "A", canto: "real-envido" },
            { jugador: "b", equipo: "B", canto: "envido" },
          ],
        },
      },
      "no",
    ],
    [
      "B3 tras Falta",
      {
        ...aumento.estado,
        pendiente: {
          ...aumento.estado.pendiente,
          cantos: [
            { jugador: "a", equipo: "A", canto: "falta-envido" },
            { jugador: "b", equipo: "B", canto: "envido" },
          ],
        },
      },
      "no",
    ],
    [
      "B4 alternancia",
      {
        ...aumento.estado,
        pendiente: {
          ...aumento.estado.pendiente,
          cantos: [
            { jugador: "a", equipo: "A", canto: "envido" },
            { jugador: "a", equipo: "A", canto: "envido" },
          ],
        },
      },
      "no",
    ],
    [
      "B5 proponente",
      {
        ...inicio.estado,
        pendiente: { ...inicio.estado.pendiente, proponente: "b", equipoProponente: "B" },
      },
      "no",
    ],
    [
      "B6 receptor",
      { ...inicio.estado, pendiente: { ...inicio.estado.pendiente, equipoRespondedor: "A" } },
      "no",
    ],
  ];
  for (const [nombre, estado, accion] of casos) {
    const antes = JSON.stringify(estado);
    const r =
      accion === "quiero"
        ? responderQuiero(estado, "b", mano.manos)
        : responderNoQuiero(estado, "b");
    assert.equal(r.aceptada, false, nombre);
    assert.equal(JSON.stringify(estado), antes, nombre);
  }
  const control = responderNoQuiero(aumento.estado, "a");
  assert.equal(control.aceptada, true);
  assert.equal(control.estado.resueltos[0].puntos, 2);
});

test("§6.1: Envido rechaza turno de carta falsificado", () => {
  const { estado } = estadoParaAceptacion();
  assert.equal(estado.juego.jugadorTurno, "a");
  const alterado = JSON.parse(JSON.stringify(estado));
  alterado.juego.jugadorTurno = "b";
  const antes = JSON.stringify(alterado);
  const resultado = iniciarEnvido(alterado, "b", "envido");
  assert.equal(resultado.aceptada, false);
  assert.equal(JSON.stringify(alterado), antes);
});

function estado2v2() {
  const primeras = [
    c("espada", 1),
    c("copa", 7),
    c("espada", 7),
    c("oro", 6),
    c("copa", 3),
    c("basto", 6),
    c("copa", 6),
    c("espada", 6),
    c("basto", 4),
    c("oro", 3),
    c("basto", 3),
    c("copa", 4),
    c("oro", 7),
  ];
  const mazo = [
    ...primeras,
    ...crearMazo().filter((x) => !primeras.some((y) => x.palo === y.palo && x.valor === y.valor)),
  ];
  const mano = prepararMano(
    {
      modalidad: "2v2",
      jugadores: [
        { id: "a", equipo: "A", posicion: 0 },
        { id: "b", equipo: "B", posicion: 1 },
        { id: "c", equipo: "A", posicion: 2 },
        { id: "d", equipo: "B", posicion: 3 },
      ],
    },
    "d",
    mazo,
  );
  return { mano, estado: crearEstadoEnvido(iniciarJuegoCartas(mano)) };
}
test("§6.1: compañero receptor puede querer o no querer sin turno", () => {
  for (const respuesta of ["quiero", "no-quiero"]) {
    const { mano, estado: inicial } = estado2v2();
    const i = iniciarEnvido(inicial, "a", "envido");
    assert.equal(i.aceptada, true);
    const antes = JSON.stringify(i.estado);
    const mal = responderQuiero(i.estado, "c", mano.manos);
    assert.equal(mal.aceptada, false);
    const r =
      respuesta === "quiero"
        ? responderQuiero(i.estado, "d", mano.manos)
        : responderNoQuiero(i.estado, "d");
    assert.equal(r.aceptada, true);
    assert.equal(r.estado.juego.jugadorTurno, "a");
    assert.equal(r.estado.pendiente, null);
    assert.equal(r.estado.resueltos.length, 1);
    assert.equal(JSON.stringify(i.estado), antes);
  }
});
test("§6.5: No quiero integrado conserva historial y evita doble adjudicación", () => {
  const { estado: inicial } = estadoParaAceptacion();
  const i = iniciarEnvido(inicial, "a", "envido");
  const a = aumentarEnvidoEnJuego(i.estado, "b", "envido");
  const r = responderNoQuiero(a.estado, "a");
  assert.equal(r.aceptada, true);
  assert.equal(r.estado.resueltos[0].equipo, "B");
  assert.equal(r.estado.resueltos[0].puntos, 2);
  assert.equal(r.estado.resueltos[0].historial.length, 2);
  assert.equal(responderNoQuiero(r.estado, "a").aceptada, false);
  assert.equal(aumentarEnvidoEnJuego(r.estado, "b", "envido").aceptada, false);
});

function estadoParaAceptacion() {
  const base = [
    c("espada", 1),
    c("basto", 7),
    c("oro", 3),
    c("copa", 4),
    c("oro", 4),
    c("copa", 5),
    c("oro", 7),
  ];
  for (const palo of ["oro", "copa", "espada", "basto"])
    for (const valor of [1, 2, 3, 4, 5, 6, 7, 10, 11, 12])
      if (!base.some((x) => x.palo === palo && x.valor === valor)) base.push(c(palo, valor));
  const mano = prepararMano(
    {
      modalidad: "1v1",
      jugadores: [
        { id: "a", equipo: "A", posicion: 0 },
        { id: "b", equipo: "B", posicion: 1 },
      ],
    },
    "b",
    base,
  );
  return { mano, estado: crearEstadoEnvido(iniciarJuegoCartas(mano)) };
}
test("§6.5: aceptaciones ordinarias adjudican al ganador de tantos", () => {
  const casos = [
    [["envido"], 2],
    [["envido", "envido"], 4],
    [["real-envido"], 3],
    [["envido", "real-envido"], 5],
    [["envido", "envido", "real-envido"], 7],
  ];
  for (const [cantos, puntos] of casos) {
    const { mano, estado: inicial } = estadoParaAceptacion();
    let r = iniciarEnvido(inicial, "a", cantos[0]);
    assert.equal(r.aceptada, true);
    let estado = r.estado;
    for (let i = 1; i < cantos.length; i++) {
      r = aumentarEnvidoEnJuego(estado, i % 2 ? "b" : "a", cantos[i]);
      assert.equal(r.aceptada, true);
      estado = r.estado;
    }
    const turno = estado.juego.jugadorTurno;
    const q = responderQuiero(
      estado,
      estado.pendiente.equipoRespondedor === "A" ? "a" : "b",
      mano.manos,
    );
    assert.equal(q.aceptada, true);
    assert.equal(q.estado.resueltos[0].puntos, puntos);
    assert.equal(q.estado.resueltos[0].equipo, "A");
    assert.equal(q.estado.juego.jugadorTurno, turno);
    assert.equal(responderQuiero(q.estado, "a", mano.manos).aceptada, false);
  }
});
test("§6.6: Falta Envido aceptada reemplaza apuestas previas", () => {
  for (const [cantos, meta, puntajes, desempate, esperado] of [
    [["falta-envido"], 30, { A: 10, B: 12 }, false, 5],
    [["envido", "real-envido", "falta-envido"], 40, { A: 12, B: 25 }, false, 8],
    [["falta-envido"], 30, { A: 30, B: 30 }, true, 2],
  ]) {
    const { mano, estado: inicial } = estadoParaAceptacion();
    let r = iniciarEnvido(inicial, "a", cantos[0]),
      estado = r.estado;
    for (let i = 1; i < cantos.length; i++) {
      r = aumentarEnvidoEnJuego(estado, i % 2 ? "b" : "a", cantos[i]);
      estado = r.estado;
    }
    const q = responderQuiero(
      estado,
      estado.pendiente.equipoRespondedor === "A" ? "a" : "b",
      mano.manos,
      { meta, puntajesIniciales: puntajes, desempate },
    );
    assert.equal(q.aceptada, true);
    assert.equal(q.estado.resueltos[0].puntos, esperado);
    assert.equal(q.estado.resueltos[0].equipo, "A");
  }
});

test("§6.3: 2v2 usa el máximo individual, no suma compañeros", () => {
  const mesa = {
    modalidad: "2v2",
    jugadores: [
      { id: "a1", equipo: "A", posicion: 0 },
      { id: "b1", equipo: "B", posicion: 1 },
      { id: "a2", equipo: "A", posicion: 2 },
      { id: "b2", equipo: "B", posicion: 3 },
    ],
  };
  const manos = [
    { jugador: "a1", cartas: [c("copa", 6), c("copa", 7), c("basto", 3)] },
    { jugador: "b1", cartas: [c("espada", 6), c("espada", 5), c("basto", 3)] },
    { jugador: "a2", cartas: [c("oro", 6), c("basto", 4), c("copa", 3)] },
    { jugador: "b2", cartas: [c("basto", 6), c("copa", 5), c("espada", 3)] },
  ];
  const r = compararTantosEnvido(mesa, "a1", c("oro", 2), manos);
  assert.equal(r.equipoGanador, "A");
  assert.equal(r.jugadorDeterminante, "a1");
  assert.equal(r.tantoGanador, 33);
  const noSuma = compararTantosEnvido(mesa, "a1", c("oro", 2), [
    { jugador: "a1", cartas: [c("copa", 7), c("basto", 6), c("espada", 3)] },
    { jugador: "a2", cartas: [c("copa", 6), c("basto", 5), c("espada", 3)] },
    { jugador: "b1", cartas: [c("espada", 6), c("espada", 7), c("copa", 3)] },
    { jugador: "b2", cartas: [c("basto", 7), c("copa", 6), c("oro", 3)] },
  ]);
  assert.equal(noSuma.equipoGanador, "B");
  assert.equal(noSuma.tantoGanador, 33);
});

test("§6.3: empate se desempata desde mano original e ignora orden del arreglo", () => {
  const jugadores = [
    { id: "a", equipo: "A", posicion: 0 },
    { id: "b", equipo: "B", posicion: 1 },
    { id: "c", equipo: "A", posicion: 2 },
    { id: "d", equipo: "B", posicion: 3 },
  ];
  const manos = [
    { jugador: "a", cartas: [c("copa", 6), c("copa", 7), c("basto", 3)] },
    { jugador: "b", cartas: [c("espada", 6), c("espada", 7), c("basto", 3)] },
    { jugador: "c", cartas: [c("basto", 6), c("copa", 4), c("espada", 3)] },
    { jugador: "d", cartas: [c("basto", 6), c("copa", 4), c("espada", 3)] },
  ];
  for (const lista of [jugadores, [...jugadores].reverse()]) {
    const r = compararTantosEnvido({ modalidad: "2v2", jugadores: lista }, "a", c("oro", 2), manos);
    assert.equal(r.jugadorDeterminante, "a");
    assert.equal(r.equipoGanador, "A");
  }
});

test("matriz reglamentaria de tantos, Flor, escalera y Falta", () => {
  const muestra = c("oro", 2);
  for (const [cartas, esperado] of [
    [[c("copa", 6), c("copa", 7), c("basto", 3)], 33],
    [[c("copa", 7), c("basto", 6), c("espada", 3)], 7],
    [[c("copa", 10), c("basto", 11), c("espada", 12)], 0],
    [[c("oro", 12), c("copa", 7), c("basto", 6)], 37],
  ])
    assert.deepEqual(calcularTantoEnvido(cartas, muestra), { tieneFlor: false, tanto: esperado });
  for (const cartas of [
    [c("copa", 3), c("copa", 6), c("copa", 7)],
    [c("oro", 12), c("oro", 4), c("basto", 7)],
    [c("oro", 12), c("copa", 6), c("copa", 7)],
  ])
    assert.equal(tieneFlor(cartas, muestra), true);
  const filas = [
    [["envido"], 1],
    [["real-envido"], 1],
    [["falta-envido"], 1],
    [["envido", "envido"], 2],
    [["envido", "envido", "envido"], 4],
    [["envido", "real-envido"], 2],
    [["real-envido", "falta-envido"], 3],
    [["envido", "envido", "real-envido"], 4],
    [["envido", "envido", "envido", "envido", "envido"], 8],
  ];
  for (const [cantos, puntos] of filas) {
    let cadena = iniciarCadenaEnvido("a", "A", "B", cantos[0]);
    for (let i = 1; i < cantos.length; i++)
      cadena = aumentarEnvido(cadena, i % 2 ? "b" : "a", i % 2 ? "B" : "A", cantos[i]);
    assert.equal(rechazarEnvido(cadena).puntos, puntos);
  }
  assert.equal(calcularFaltaEnvido(30, { A: 10, B: 12 }, ["A", "B"], "A", false), 5);
  assert.equal(calcularFaltaEnvido(40, { A: 12, B: 25 }, ["A", "B"], "A", false), 8);
  assert.equal(calcularFaltaEnvido(40, { A: 12, B: 25 }, ["A", "B"], "B", false), 15);
  assert.equal(calcularFaltaEnvido(40, { A: 42, B: 42 }, ["A", "B"], "A", true), 2);
});
test("Envido integrado suspende cartas y Quiero conserva turno", () => {
  const mazo = [
    c("espada", 1),
    c("basto", 7),
    c("oro", 3),
    c("copa", 4),
    c("oro", 4),
    c("copa", 5),
    c("oro", 7),
  ];
  const palos = ["oro", "copa", "espada", "basto"],
    valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
  for (const palo of palos)
    for (const valor of valores)
      if (!mazo.some((x) => x.palo === palo && x.valor === valor)) mazo.push(c(palo, valor));
  const mano = prepararMano(
    {
      modalidad: "1v1",
      jugadores: [
        { id: "a", equipo: "A", posicion: 0 },
        { id: "b", equipo: "B", posicion: 1 },
      ],
    },
    "b",
    mazo,
  );
  let estado = crearEstadoEnvido(iniciarJuegoCartas(mano));
  const inicio = iniciarEnvido(estado, "a", "envido");
  assert.equal(inicio.aceptada, true);
  estado = inicio.estado;
  assert.equal(
    ejecutarCartaConEnvido(estado, {
      tipo: "jugar-carta",
      jugador: "a",
      carta: mano.manos[0].cartas[0],
    }).aceptada,
    false,
  );
  const quiero = responderQuiero(estado, "b", mano.manos);
  assert.equal(quiero.aceptada, true);
  assert.equal(quiero.estado.resueltos[0].puntos, 2);
  assert.equal(quiero.estado.juego.jugadorTurno, "a");
});
