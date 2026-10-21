import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calcularFaltaEnvido,
  calcularTantoEnvido,
  compararTantosEnvido,
  aumentarEnvido,
  iniciarCadenaEnvido,
  rechazarEnvido,
  tieneFlor,
  crearEstadoManoCoordinada,
  crearMazo,
  ejecutarAccionCoordinada,
  iniciarJuegoCartas,
  prepararMano,
} from "../dist/index.js";
const c = (palo, valor) => ({ palo, valor });
function base() {
  const p = [
    c("espada", 1),
    c("basto", 7),
    c("oro", 3),
    c("copa", 4),
    c("oro", 4),
    c("copa", 5),
    c("oro", 7),
  ];
  const m = [
    ...p,
    ...crearMazo().filter((x) => !p.some((y) => y.palo === x.palo && y.valor === x.valor)),
  ];
  const mano = prepararMano(
    {
      modalidad: "1v1",
      jugadores: [
        { id: "a", equipo: "A", posicion: 0 },
        { id: "b", equipo: "B", posicion: 1 },
      ],
    },
    "b",
    m,
  );
  return {
    mano,
    estado: crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
      metaPuntos: 40,
      puntajesIniciales: { A: 0, B: 0 },
      esDesempate: false,
    }),
  };
}
test("coordinador bloquea cartas y conserva turno", () => {
  const { mano, estado } = base();
  const i = ejecutarAccionCoordinada(estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  assert.equal(i.aceptada, true);
  const carta = { tipo: "jugar-carta", jugador: "a", carta: mano.manos[0].cartas[0] };
  assert.equal(ejecutarAccionCoordinada(i.estado, carta).rechazo.codigo, "envido-pendiente");
  const q = ejecutarAccionCoordinada(i.estado, { tipo: "quiero-envido", jugador: "b" });
  assert.equal(q.aceptada, true);
  assert.equal(q.estado.juego.jugadorTurno, "a");
  assert.equal(ejecutarAccionCoordinada(q.estado, carta).aceptada, true);
});
test("coordinador detecta estados adulterados", () => {
  const { estado } = base();
  const i = ejecutarAccionCoordinada(estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const malo = {
    ...i.estado,
    envido: { ...i.estado.envido, pendiente: { ...i.estado.envido.pendiente, valorAceptado: 99 } },
  };
  assert.equal(
    ejecutarAccionCoordinada(malo, { tipo: "no-quiero-envido", jugador: "b" }).rechazo.codigo,
    "estado-invalido",
  );
});
test("§6.2: tanto, Flor y Falta Envido", () => {
  assert.deepEqual(calcularTantoEnvido([c("oro", 6), c("oro", 7), c("basto", 3)], c("copa", 6)), {
    tieneFlor: false,
    tanto: 33,
  });
  assert.deepEqual(calcularTantoEnvido([c("oro", 3), c("oro", 6), c("oro", 7)], c("copa", 6)), {
    tieneFlor: true,
  });
  assert.equal(calcularFaltaEnvido(40, { A: 12, B: 10 }, ["A", "B"], "A", false), 8);
});
test("Envido: determinismo, aumento y No Quiero", () => {
  const { estado } = base();
  const a = ejecutarAccionCoordinada(estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const b = ejecutarAccionCoordinada(JSON.parse(JSON.stringify(estado)), {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  assert.deepEqual(a, b);
  const aumento = ejecutarAccionCoordinada(a.estado, {
    tipo: "aumentar-envido",
    jugador: "b",
    canto: "envido",
  });
  const no = ejecutarAccionCoordinada(aumento.estado, { tipo: "no-quiero-envido", jugador: "a" });
  assert.equal(no.aceptada, true);
  assert.deepEqual(no.estado.envido.resueltos[0].puntos, 2);
  assert.equal(
    ejecutarAccionCoordinada(no.estado, { tipo: "no-quiero-envido", jugador: "a" }).aceptada,
    false,
  );
});
test("historiales, turno y segundo Envido inválidos se rechazan", () => {
  const { estado } = base();
  const i = ejecutarAccionCoordinada(estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const corrupto = {
    ...i.estado,
    envido: {
      ...i.estado.envido,
      pendiente: {
        ...i.estado.envido.pendiente,
        cantos: [
          { jugador: "a", equipo: "A", canto: "real-envido" },
          { jugador: "b", equipo: "B", canto: "real-envido" },
        ],
      },
    },
  };
  assert.equal(
    ejecutarAccionCoordinada(corrupto, { tipo: "no-quiero-envido", jugador: "b" }).aceptada,
    false,
  );
  assert.equal(
    ejecutarAccionCoordinada(estado, { tipo: "iniciar-envido", jugador: "b", canto: "envido" })
      .aceptada,
    false,
  );
  const cerrado = ejecutarAccionCoordinada(i.estado, { tipo: "no-quiero-envido", jugador: "b" });
  assert.equal(
    ejecutarAccionCoordinada(cerrado.estado, {
      tipo: "iniciar-envido",
      jugador: "a",
      canto: "envido",
    }).aceptada,
    false,
  );
});
test("adjudicaciones resueltas adulteradas se rechazan", () => {
  const { estado } = base();
  const i = ejecutarAccionCoordinada(estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const q = ejecutarAccionCoordinada(i.estado, { tipo: "quiero-envido", jugador: "b" });
  assert.equal(q.aceptada, true);
  for (const adjudicacion of [
    { ...q.estado.envido.resueltos[0], equipo: "B" },
    { ...q.estado.envido.resueltos[0], puntos: 99 },
    { ...q.estado.envido.resueltos[0], respuesta: "no-quiero" },
    { ...q.estado.envido.resueltos[0], historial: [] },
  ]) {
    const alterado = { ...q.estado, envido: { ...q.estado.envido, resueltos: [adjudicacion] } };
    assert.equal(
      ejecutarAccionCoordinada(alterado, {
        tipo: "jugar-carta",
        jugador: "a",
        carta: q.estado.juego.cartasDisponibles[0].cartas[0],
      }).aceptada,
      false,
    );
  }
  const duplicado = {
    ...q.estado,
    envido: {
      ...q.estado.envido,
      resueltos: [q.estado.envido.resueltos[0], q.estado.envido.resueltos[0]],
    },
  };
  assert.equal(
    ejecutarAccionCoordinada(duplicado, {
      tipo: "jugar-carta",
      jugador: "a",
      carta: q.estado.juego.cartasDisponibles[0].cartas[0],
    }).aceptada,
    false,
  );
});
test("§6.3: máximo individual y empate por mano", () => {
  const mesa = {
    modalidad: "2v2",
    jugadores: [
      { id: "a", equipo: "A", posicion: 0 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "d", equipo: "B", posicion: 3 },
    ],
  };
  const manos = [
    { jugador: "a", cartas: [c("copa", 6), c("copa", 7), c("basto", 3)] },
    { jugador: "b", cartas: [c("espada", 6), c("espada", 7), c("basto", 3)] },
    { jugador: "c", cartas: [c("oro", 6), c("basto", 4), c("copa", 3)] },
    { jugador: "d", cartas: [c("basto", 6), c("copa", 4), c("espada", 3)] },
  ];
  const r = compararTantosEnvido(mesa, "a", c("oro", 2), manos);
  assert.equal(r.equipoGanador, "A");
  assert.equal(r.jugadorDeterminante, "a");
  assert.equal(r.tantoGanador, 33);
});
test("§6.5: aceptaciones ordinarias conservan puntos reglamentarios", () => {
  for (const [cantos, puntos] of [
    [["envido"], 2],
    [["envido", "envido"], 4],
    [["real-envido"], 3],
    [["envido", "real-envido"], 5],
    [["envido", "envido", "real-envido"], 7],
  ]) {
    let { estado } = base();
    let r = ejecutarAccionCoordinada(estado, {
      tipo: "iniciar-envido",
      jugador: "a",
      canto: cantos[0],
    });
    for (let i = 1; i < cantos.length; i++)
      r = ejecutarAccionCoordinada(r.estado, {
        tipo: "aumentar-envido",
        jugador: i % 2 ? "b" : "a",
        canto: cantos[i],
      });
    const q = ejecutarAccionCoordinada(r.estado, {
      tipo: "quiero-envido",
      jugador: r.estado.envido.pendiente.equipoRespondedor === "A" ? "a" : "b",
    });
    assert.equal(q.aceptada, true);
    assert.equal(q.estado.envido.resueltos[0].puntos, puntos);
    assert.equal(q.estado.envido.resueltos[0].equipo, "A");
  }
});
test("§6.6: Falta Envido aceptada usa contexto inicial", () => {
  for (const [cantos, contexto, esperado] of [
    [
      ["falta-envido"],
      { metaPuntos: 30, puntajesIniciales: { A: 10, B: 12 }, esDesempate: false },
      5,
    ],
    [
      ["envido", "real-envido", "falta-envido"],
      { metaPuntos: 40, puntajesIniciales: { A: 12, B: 25 }, esDesempate: false },
      8,
    ],
    [
      ["falta-envido"],
      { metaPuntos: 30, puntajesIniciales: { A: 30, B: 30 }, esDesempate: true },
      2,
    ],
  ]) {
    const { mano } = base();
    let estado = crearEstadoManoCoordinada(iniciarJuegoCartas(mano), contexto);
    let r = ejecutarAccionCoordinada(estado, {
      tipo: "iniciar-envido",
      jugador: "a",
      canto: cantos[0],
    });
    for (let i = 1; i < cantos.length; i++)
      r = ejecutarAccionCoordinada(r.estado, {
        tipo: "aumentar-envido",
        jugador: i % 2 ? "b" : "a",
        canto: cantos[i],
      });
    const q = ejecutarAccionCoordinada(r.estado, {
      tipo: "quiero-envido",
      jugador: r.estado.envido.pendiente.equipoRespondedor === "A" ? "a" : "b",
    });
    assert.equal(q.aceptada, true);
    assert.equal(q.estado.envido.resueltos[0].puntos, esperado);
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
  for (const [cantos, puntos] of [
    [["envido"], 1],
    [["real-envido"], 1],
    [["falta-envido"], 1],
    [["envido", "envido"], 2],
    [["envido", "envido", "envido"], 4],
    [["envido", "real-envido"], 2],
    [["real-envido", "falta-envido"], 3],
    [["envido", "envido", "real-envido"], 4],
  ]) {
    let cadena = iniciarCadenaEnvido("a", "A", "B", cantos[0]);
    for (let i = 1; i < cantos.length; i++)
      cadena = aumentarEnvido(cadena, i % 2 ? "b" : "a", i % 2 ? "B" : "A", cantos[i]);
    assert.equal(rechazarEnvido(cadena).puntos, puntos);
  }
});
function dosVsDos() {
  const cartas = [
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
    ...cartas,
    ...crearMazo().filter((x) => !cartas.some((y) => y.palo === x.palo && y.valor === x.valor)),
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
  return {
    mano,
    estado: crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
      metaPuntos: 40,
      puntajesIniciales: { A: 0, B: 0 },
      esDesempate: false,
    }),
  };
}
test("§6.1: compañero receptor puede querer o no querer sin turno", () => {
  for (const tipo of ["quiero-envido", "no-quiero-envido"]) {
    const { estado } = dosVsDos();
    const i = ejecutarAccionCoordinada(estado, {
      tipo: "iniciar-envido",
      jugador: "a",
      canto: "envido",
    });
    const antes = JSON.stringify(i.estado);
    assert.equal(
      ejecutarAccionCoordinada(i.estado, { tipo: "quiero-envido", jugador: "c" }).aceptada,
      false,
    );
    const r = ejecutarAccionCoordinada(i.estado, { tipo, jugador: "d" });
    assert.equal(r.aceptada, true);
    assert.equal(r.estado.juego.jugadorTurno, "a");
    assert.equal(r.estado.envido.pendiente, null);
    assert.equal(r.estado.envido.resueltos.length, 1);
    assert.equal(JSON.stringify(i.estado), antes);
  }
});
test("§6.3: empate se desempata desde mano original e ignora orden", () => {
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
test("pendiente corrupta, reinserción y No Quiero no mutan ni duplican", () => {
  const { mano, estado } = base();
  const i = ejecutarAccionCoordinada(estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const carta = { tipo: "jugar-carta", jugador: "a", carta: mano.manos[0].cartas[0] };
  assert.equal(ejecutarAccionCoordinada(i.estado, carta).rechazo.codigo, "envido-pendiente");
  const corrupto = {
    ...i.estado,
    envido: { ...i.estado.envido, pendiente: { ...i.estado.envido.pendiente, valorAceptado: 999 } },
  };
  const antes = JSON.stringify(corrupto);
  assert.equal(ejecutarAccionCoordinada(corrupto, carta).aceptada, false);
  assert.equal(JSON.stringify(corrupto), antes);
  const cerrado = ejecutarAccionCoordinada(i.estado, { tipo: "no-quiero-envido", jugador: "b" });
  assert.equal(ejecutarAccionCoordinada(cerrado.estado, carta).aceptada, true);
  const reinsertado = {
    ...cerrado.estado,
    envido: { ...cerrado.estado.envido, pendiente: i.estado.envido.pendiente },
  };
  assert.equal(ejecutarAccionCoordinada(reinsertado, carta).aceptada, false);
  assert.equal(
    ejecutarAccionCoordinada(cerrado.estado, { tipo: "no-quiero-envido", jugador: "a" }).aceptada,
    false,
  );
});
