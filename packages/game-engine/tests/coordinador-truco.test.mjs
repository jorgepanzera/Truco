import assert from "node:assert/strict";
import { test } from "node:test";
import * as motor from "../dist/index.js";
import {
  crearEstadoManoCoordinada,
  crearEstadoTruco,
  crearMazo,
  esCicloCoherenteConEstado,
  esEstadoCicloManoValido,
  ejecutarAccionCoordinada,
  iniciarJuegoCartas,
  prepararMano,
} from "../dist/index.js";

const c = (palo, valor) => ({ palo, valor });
const identidad = (carta) => `${carta.palo}:${carta.valor}`;
const mesa = {
  modalidad: "1v1",
  jugadores: [
    { id: "a", equipo: "A", posicion: 0 },
    { id: "b", equipo: "B", posicion: 1 },
  ],
};

function estadoConManos(manos, muestra) {
  const reparto = [manos[0][0], manos[1][0], manos[0][1], manos[1][1], manos[0][2], manos[1][2]];
  const usados = [...reparto, muestra];
  const mano = prepararMano(mesa, "b", [
    ...reparto,
    muestra,
    ...crearMazo().filter(
      (carta) => !usados.some((usada) => identidad(carta) === identidad(usada)),
    ),
  ]);
  return {
    mano,
    estado: crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
      metaPuntos: 40,
      puntajesIniciales: { A: 0, B: 0 },
      esDesempate: false,
    }),
  };
}

function base() {
  return estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("oro", 4), c("copa", 5)],
    ],
    c("oro", 7),
  );
}

function baseGanadorA() {
  return estadoConManos(
    [
      [c("espada", 1), c("basto", 3), c("oro", 2)],
      [c("copa", 4), c("oro", 4), c("espada", 5)],
    ],
    c("basto", 7),
  );
}

function baseSinFlor() {
  return estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("espada", 5), c("basto", 6)],
    ],
    c("oro", 7),
  );
}

test("mazo registra oportunidad excepcional solo para ganador con Flor pendiente", () => {
  const conFlor = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  ).estado;
  const antes = JSON.stringify(conFlor);
  const conOportunidad = ejecutarAccionCoordinada(conFlor, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(conOportunidad.aceptada, true);
  assert.equal(motor.obtenerElegibleFlorExcepcional(conOportunidad.estado), "b");
  assert.deepEqual(conOportunidad.estado.liquidacionMazo.oportunidadFlor, {
    jugador: "b",
    estado: "pendiente",
    duracionMs: 10000,
  });
  assert.equal(JSON.stringify(conFlor), antes);
  const sinFlorEstado = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("espada", 5), c("basto", 6)],
    ],
    c("oro", 7),
  ).estado;
  const sinFlor = ejecutarAccionCoordinada(sinFlorEstado, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(sinFlor.aceptada, true);
  assert.equal(motor.obtenerElegibleFlorExcepcional(sinFlor.estado), null);
  assert.equal(sinFlor.estado.liquidacionMazo.oportunidadFlor, null);
});

test("ganador anuncia Flor excepcional y consume solo su oportunidad", () => {
  const estado = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  ).estado;
  const mazo = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "a" });
  const turno = mazo.estado.juego.jugadorTurno;
  const anuncio = ejecutarAccionCoordinada(mazo.estado, { tipo: "anunciar-flor", jugador: "b" });
  assert.equal(anuncio.aceptada, true);
  assert.equal(
    anuncio.estado.flor.anuncios.some((item) => item.jugador === "b"),
    true,
  );
  assert.equal(anuncio.estado.liquidacionMazo.oportunidadFlor.estado, "consumida");
  assert.equal(anuncio.estado.juego.equipoGanador, "B");
  assert.equal(anuncio.estado.juego.finalizada, true);
  assert.equal(anuncio.estado.juego.jugadorTurno, turno);
  assert.equal(anuncio.estado.flor.adjudicaciones.length, 0);
  assert.equal(
    ejecutarAccionCoordinada(anuncio.estado, { tipo: "anunciar-flor", jugador: "b" }).aceptada,
    false,
  );
  assert.equal(
    ejecutarAccionCoordinada(mazo.estado, { tipo: "anunciar-flor", jugador: "a" }).aceptada,
    false,
  );
});

test("vencimiento externo anuncia Flor excepcional una sola vez", () => {
  const estado = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  ).estado;
  const mazo = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "a" }).estado;
  const vence = ejecutarAccionCoordinada(mazo, { tipo: "vencer-oportunidad-flor", jugador: "b" });
  assert.equal(vence.aceptada, true);
  assert.equal(
    vence.estado.flor.anuncios.some((item) => item.jugador === "b"),
    true,
  );
  assert.equal(vence.estado.liquidacionMazo.oportunidadFlor.estado, "consumida");
  assert.equal(
    ejecutarAccionCoordinada(vence.estado, { tipo: "vencer-oportunidad-flor", jugador: "b" })
      .aceptada,
    false,
  );
  assert.equal(
    ejecutarAccionCoordinada(mazo, { tipo: "vencer-oportunidad-flor", jugador: "a" }).aceptada,
    false,
  );
});

test("Flor excepcional consumida se liquida antes de Truco", () => {
  const crearMazoConOportunidad = () =>
    ejecutarAccionCoordinada(
      estadoConManos(
        [
          [c("espada", 1), c("basto", 7), c("oro", 3)],
          [c("copa", 4), c("copa", 5), c("copa", 6)],
        ],
        c("oro", 7),
      ).estado,
      { tipo: "irse-al-mazo", jugador: "a" },
    ).estado;
  for (const accion of [
    { tipo: "anunciar-flor", jugador: "b" },
    { tipo: "vencer-oportunidad-flor", jugador: "b" },
  ]) {
    const anuncio = ejecutarAccionCoordinada(crearMazoConOportunidad(), accion);
    assert.equal(anuncio.aceptada, true);
    const liquidado = ejecutarAccionCoordinada(anuncio.estado, { tipo: "liquidar-puntos-mazo" });
    assert.equal(liquidado.aceptada, true);
    assert.deepEqual(liquidado.estado.flor.adjudicaciones, [
      { equipo: "A", puntos: 0, motivo: "sin-desafio" },
      { equipo: "B", puntos: 3, motivo: "sin-desafio" },
    ]);
    assert.deepEqual(liquidado.eventos, [
      { tipo: "flor-adjudicada", adjudicaciones: liquidado.estado.flor.adjudicaciones },
      {
        tipo: "mazo-adjudicado",
        jugadorRetirado: "a",
        adjudicacion: { equipo: "B", puntos: 1, motivo: "mazo", nivel: null },
      },
    ]);
    assert.deepEqual(
      liquidado.estado.liquidacionMazo.oportunidadFlor,
      anuncio.estado.liquidacionMazo.oportunidadFlor,
    );
    const antesSegundoIntento = JSON.stringify(liquidado.estado);
    assert.equal(
      ejecutarAccionCoordinada(liquidado.estado, { tipo: "liquidar-puntos-mazo" }).aceptada,
      false,
    );
    assert.equal(JSON.stringify(liquidado.estado), antesSegundoIntento);
  }
});

test("liquidación rechaza oportunidad excepcional pendiente o consumida adulterada", () => {
  const crearMazoConOportunidad = () =>
    ejecutarAccionCoordinada(
      estadoConManos(
        [
          [c("espada", 1), c("basto", 7), c("oro", 3)],
          [c("copa", 4), c("copa", 5), c("copa", 6)],
        ],
        c("oro", 7),
      ).estado,
      { tipo: "irse-al-mazo", jugador: "a" },
    ).estado;
  const pendiente = crearMazoConOportunidad();
  assert.equal(
    ejecutarAccionCoordinada(pendiente, { tipo: "liquidar-puntos-mazo" }).aceptada,
    false,
  );
  const sinAnuncio = {
    ...pendiente,
    liquidacionMazo: {
      ...pendiente.liquidacionMazo,
      oportunidadFlor: { ...pendiente.liquidacionMazo.oportunidadFlor, estado: "consumida" },
    },
  };
  const antesSinAnuncio = JSON.stringify(sinAnuncio);
  assert.equal(
    ejecutarAccionCoordinada(sinAnuncio, { tipo: "liquidar-puntos-mazo" }).aceptada,
    false,
  );
  assert.equal(JSON.stringify(sinAnuncio), antesSinAnuncio);

  const ambas = estadoConManos(
    [
      [c("copa", 1), c("copa", 3), c("copa", 6)],
      [c("espada", 1), c("espada", 3), c("espada", 6)],
    ],
    c("oro", 7),
  ).estado;
  const florA = ejecutarAccionCoordinada(ambas, { tipo: "anunciar-flor", jugador: "a" });
  const mazo = ejecutarAccionCoordinada(florA.estado, { tipo: "irse-al-mazo", jugador: "a" });
  const florB = ejecutarAccionCoordinada(mazo.estado, { tipo: "anunciar-flor", jugador: "b" });
  const jugadorEquivocado = {
    ...florB.estado,
    liquidacionMazo: {
      ...florB.estado.liquidacionMazo,
      oportunidadFlor: { ...florB.estado.liquidacionMazo.oportunidadFlor, jugador: "a" },
    },
  };
  const antesJugadorEquivocado = JSON.stringify(jugadorEquivocado);
  assert.equal(
    ejecutarAccionCoordinada(jugadorEquivocado, { tipo: "liquidar-puntos-mazo" }).aceptada,
    false,
  );
  assert.equal(JSON.stringify(jugadorEquivocado), antesJugadorEquivocado);
});

test("liquidación por mazo bloquea acciones competitivas y estados consumidos adulterados", () => {
  const estado = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  ).estado;
  const mazo = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "a" }).estado;
  for (const accion of [
    { tipo: "proponer-truco", jugador: "b" },
    { tipo: "iniciar-envido", jugador: "b", canto: "envido" },
    { tipo: "proponer-contra-flor", jugador: "b" },
    { tipo: "jugar-carta", jugador: "b", carta: mazo.juego.mano.manos[1].cartas[0] },
  ]) {
    const antes = JSON.stringify(mazo);
    assert.equal(ejecutarAccionCoordinada(mazo, accion).aceptada, false);
    assert.equal(JSON.stringify(mazo), antes);
  }
  const adulterado = {
    ...mazo,
    liquidacionMazo: {
      ...mazo.liquidacionMazo,
      oportunidadFlor: { ...mazo.liquidacionMazo.oportunidadFlor, estado: "consumida" },
    },
  };
  assert.equal(
    ejecutarAccionCoordinada(adulterado, { tipo: "proponer-truco", jugador: "b" }).aceptada,
    false,
  );
});

test("validador rechaza oportunidad excepcional adulterada sin mutar", () => {
  const estado = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  ).estado;
  const valido = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "a" }).estado;
  for (const oportunidadFlor of [
    { jugador: "a", estado: "pendiente", duracionMs: 10000 },
    { jugador: "b", estado: "pendiente", duracionMs: 9999 },
    null,
  ]) {
    const adulterado = {
      ...valido,
      liquidacionMazo: { ...valido.liquidacionMazo, oportunidadFlor },
    };
    const antes = JSON.stringify(adulterado);
    assert.equal(
      ejecutarAccionCoordinada(adulterado, { tipo: "proponer-truco", jugador: "b" }).aceptada,
      false,
    );
    assert.equal(JSON.stringify(adulterado), antes);
  }
});

test("Flor anunciada del ganador no crea segunda oportunidad tras mazo", () => {
  const { mano, estado } = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  );
  const carta = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[0],
  });
  const anuncio = ejecutarAccionCoordinada(carta.estado, { tipo: "anunciar-flor", jugador: "b" });
  const mazo = ejecutarAccionCoordinada(anuncio.estado, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(mazo.aceptada, true);
  assert.equal(motor.obtenerElegibleFlorExcepcional(mazo.estado), null);
  assert.equal(mazo.estado.liquidacionMazo.oportunidadFlor, null);
  assert.equal(
    mazo.estado.flor.anuncios.some((a) => a.jugador === "b"),
    true,
  );
});

test("retirado con Flor no recibe oportunidad excepcional", () => {
  const estado = estadoConManos(
    [
      [c("copa", 4), c("copa", 5), c("copa", 6)],
      [c("espada", 1), c("basto", 7), c("oro", 3)],
    ],
    c("oro", 7),
  ).estado;
  const mazo = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(mazo.aceptada, true);
  assert.equal(mazo.estado.juego.equipoGanador, "B");
  assert.equal(motor.obtenerElegibleFlorExcepcional(mazo.estado), null);
  assert.equal(mazo.estado.liquidacionMazo.oportunidadFlor, null);
});

function finalizarPorBazas(estado, mano) {
  let resultado = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[0],
  });
  assert.equal(resultado.aceptada, true);
  resultado = ejecutarAccionCoordinada(resultado.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos[1].cartas[0],
  });
  assert.equal(resultado.aceptada, true);
  resultado = ejecutarAccionCoordinada(resultado.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[1],
  });
  assert.equal(resultado.aceptada, true);
  return ejecutarAccionCoordinada(resultado.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos[1].cartas[1],
  });
}

test("coordinador inicializa una única instancia de Truco vacía y válida", () => {
  const { estado } = base();
  assert.deepEqual(estado.truco, crearEstadoTruco());
  assert.equal(estado.truco.apuestaActiva, null);
  assert.equal(estado.truco.propuestaPendiente, null);
  assert.notEqual(estado.truco, crearEstadoTruco());
});

test("ciclo coordinado distingue competencia, liquidación y cierre válido", () => {
  const { estado } = base();
  assert.deepEqual(estado.ciclo, { fase: "competencia-activa" });
  assert.equal(esEstadoCicloManoValido(estado.ciclo, ["A", "B"]), true);
  assert.equal(
    esEstadoCicloManoValido({ fase: "liquidacion", equipoGanador: "A", causa: "mazo" }, ["A", "B"]),
    true,
  );
  assert.equal(
    esEstadoCicloManoValido(
      { fase: "cierre-definitivo", equipoGanador: "inexistente", causa: "bazas" },
      ["A", "B"],
    ),
    false,
  );
  assert.equal(
    esEstadoCicloManoValido(
      { fase: "cierre-definitivo", equipoGanador: "A", causa: "bazas", liquidacion: true },
      ["A", "B"],
    ),
    false,
  );
});

test("ciclo coordinado se valida contra cartas y bloquea fases futuras inventadas", () => {
  const { estado, mano } = base();
  assert.equal(
    esCicloCoherenteConEstado(estado.ciclo, estado.juego, estado.resultadoPartida),
    true,
  );
  for (const ciclo of [
    { fase: "victoria-competitiva-determinada", equipoGanador: "A", causa: "mazo" },
    { fase: "liquidacion", equipoGanador: "A", causa: "mazo" },
    { fase: "cierre-definitivo", equipoGanador: "A", causa: "mazo" },
  ]) {
    const adulterado = { ...estado, ciclo };
    const antes = JSON.stringify(adulterado);
    const resultado = ejecutarAccionCoordinada(adulterado, {
      tipo: "jugar-carta",
      jugador: "a",
      carta: mano.manos[0].cartas[0],
    });
    assert.equal(resultado.aceptada, false);
    assert.equal(JSON.stringify(adulterado), antes);
  }
  const mazo = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "a" });
  assert.deepEqual(mazo.estado.ciclo, {
    fase: "victoria-competitiva-determinada",
    equipoGanador: "B",
    causa: "mazo",
  });
  assert.deepEqual(mazo.estado.liquidacionMazo, {
    equipoGanador: "B",
    causa: "mazo",
    puntos: "pendiente",
    oportunidadFlor: { jugador: "b", estado: "pendiente", duracionMs: 10000 },
  });
  assert.equal(
    esCicloCoherenteConEstado(
      { ...mazo.estado.ciclo, equipoGanador: "A" },
      mazo.estado.juego,
      mazo.estado.resultadoPartida,
    ),
    false,
  );
  assert.equal(
    esCicloCoherenteConEstado(
      { ...mazo.estado.ciclo, causa: "bazas" },
      mazo.estado.juego,
      mazo.estado.resultadoPartida,
    ),
    false,
  );
  assert.equal(
    ejecutarAccionCoordinada(mazo.estado, {
      tipo: "jugar-carta",
      jugador: "b",
      carta: mano.manos[1].cartas[0],
    }).rechazo.codigo,
    "mano-finalizada",
  );
});

test("coordinador rechaza Truco ausente o adulterado contra participantes canónicos", () => {
  const { estado, mano } = base();
  const accion = { tipo: "jugar-carta", jugador: "a", carta: mano.manos[0].cartas[0] };
  assert.equal(
    ejecutarAccionCoordinada({ ...estado, truco: undefined }, accion).rechazo.codigo,
    "estado-invalido",
  );
  assert.equal(
    ejecutarAccionCoordinada(
      {
        ...estado,
        truco: {
          apuestaActiva: { nivel: "truco", equipoAceptante: "X" },
          propuestaPendiente: null,
        },
      },
      accion,
    ).rechazo.codigo,
    "estado-invalido",
  );
  assert.equal(
    ejecutarAccionCoordinada(
      {
        ...estado,
        truco: { apuestaActiva: null, propuestaPendiente: { nivel: "retruco", proponente: "a" } },
      },
      accion,
    ).rechazo.codigo,
    "estado-invalido",
  );
});

test("acciones actuales conservan Truco y no emiten eventos de Truco", () => {
  const { estado, mano } = base();
  const antes = estado.truco;
  const carta = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[0],
  });
  assert.equal(carta.aceptada, true);
  assert.equal(carta.estado.truco, antes);
  assert.equal(
    carta.eventos.some((evento) => evento.tipo.includes("truco")),
    false,
  );

  const envido = ejecutarAccionCoordinada(base().estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  assert.equal(envido.aceptada, true);
  assert.deepEqual(envido.estado.truco, crearEstadoTruco());
  assert.equal(
    envido.eventos.some((evento) => evento.tipo.includes("truco")),
    false,
  );
});

test("Flor válida conserva Truco, es determinista y no produce eventos de Truco", () => {
  const { estado } = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("espada", 7), c("basto", 4), c("copa", 5)],
    ],
    c("copa", 7),
  );
  const accion = { tipo: "anunciar-flor", jugador: "a" };
  const r = ejecutarAccionCoordinada(estado, accion);
  const duplicada = ejecutarAccionCoordinada(JSON.parse(JSON.stringify(estado)), accion);
  assert.equal(r.aceptada, true);
  assert.deepEqual(r, duplicada);
  assert.deepEqual(r.estado.truco, crearEstadoTruco());
  assert.equal(
    r.eventos.some((evento) => evento.tipo.includes("truco")),
    false,
  );
  assert.deepEqual(estado.truco, crearEstadoTruco());
});

test("coordinador despacha la secuencia aceptada completa de Truco y conserva los otros dominios", () => {
  const { estado } = base();
  const propuesto = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  const truco = ejecutarAccionCoordinada(propuesto.estado, { tipo: "quiero-truco", jugador: "b" });
  const retruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const retrucoAceptado = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "quiero-retruco",
    jugador: "a",
  });
  const vale = ejecutarAccionCoordinada(retrucoAceptado.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  const valeAceptado = ejecutarAccionCoordinada(vale.estado, {
    tipo: "quiero-vale-cuatro",
    jugador: "b",
  });

  assert.equal(propuesto.eventos[0].tipo, "truco-propuesto");
  assert.equal(truco.eventos[0].tipo, "truco-aceptado");
  assert.equal(retruco.eventos[0].tipo, "retruco-propuesto");
  assert.equal(retrucoAceptado.eventos[0].tipo, "retruco-aceptado");
  assert.equal(vale.eventos[0].tipo, "vale-cuatro-propuesto");
  assert.equal(valeAceptado.eventos[0].tipo, "vale-cuatro-aceptado");
  assert.deepEqual(valeAceptado.estado.truco, {
    apuestaActiva: { nivel: "vale-cuatro", equipoAceptante: "B" },
    propuestaPendiente: null,
    historialPropuestas: [
      {
        orden: 1,
        nivel: "truco",
        proponente: "a",
        equipoProponente: "A",
        nivelAceptadoAnterior: null,
        respuesta: "quiero",
      },
      {
        orden: 2,
        nivel: "retruco",
        proponente: "b",
        equipoProponente: "B",
        nivelAceptadoAnterior: "truco",
        respuesta: "quiero",
      },
      {
        orden: 3,
        nivel: "vale-cuatro",
        proponente: "a",
        equipoProponente: "A",
        nivelAceptadoAnterior: "retruco",
        respuesta: "quiero",
      },
    ],
  });
  assert.equal(valeAceptado.estado.juego, estado.juego);
  assert.equal(valeAceptado.estado.flor, estado.flor);
  assert.equal(valeAceptado.estado.envido, estado.envido);
  assert.deepEqual(estado.truco, crearEstadoTruco());
});

test("aumentos directos coordinados conservan el nivel aceptado y el orden semantico", () => {
  const { estado } = base();
  const truco = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  const retruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const vale = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });

  assert.deepEqual(
    retruco.eventos.map((evento) => evento.tipo),
    ["truco-aceptado", "retruco-propuesto"],
  );
  assert.deepEqual(retruco.estado.truco.apuestaActiva, { nivel: "truco", equipoAceptante: "B" });
  assert.deepEqual(
    vale.eventos.map((evento) => evento.tipo),
    ["retruco-aceptado", "vale-cuatro-propuesto"],
  );
  assert.deepEqual(vale.estado.truco.apuestaActiva, { nivel: "retruco", equipoAceptante: "A" });
});

test("coordinador rechaza Truco por legitimacion, bloqueos y mano finalizada", () => {
  const { estado, mano } = base();
  const propuesta = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  const equipoIncorrecto = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "quiero-truco",
    jugador: "a",
  });
  assert.equal(equipoIncorrecto.rechazo.codigo, "respondedor-invalido");

  const envido = ejecutarAccionCoordinada(base().estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  assert.equal(
    ejecutarAccionCoordinada(envido.estado, { tipo: "proponer-truco", jugador: "a" }).rechazo
      .codigo,
    "envido-pendiente",
  );

  const conFlores = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  ).estado;
  const florA = ejecutarAccionCoordinada(conFlores, { tipo: "anunciar-flor", jugador: "a" });
  const florB = ejecutarAccionCoordinada(florA.estado, { tipo: "anunciar-flor", jugador: "b" });
  const pendiente = ejecutarAccionCoordinada(florB.estado, {
    tipo: "proponer-contra-flor",
    jugador: "a",
  });
  assert.equal(
    ejecutarAccionCoordinada(pendiente.estado, { tipo: "proponer-truco", jugador: "a" }).rechazo
      .codigo,
    "flor-pendiente",
  );

  const primera = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[0],
  });
  const segunda = ejecutarAccionCoordinada(primera.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos[1].cartas[0],
  });
  const tercera = ejecutarAccionCoordinada(segunda.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[2],
  });
  const finalizada = ejecutarAccionCoordinada(tercera.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos[1].cartas[1],
  });
  const quinta = ejecutarAccionCoordinada(finalizada.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos[1].cartas[2],
  });
  const manoFinalizada = ejecutarAccionCoordinada(quinta.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[1],
  });
  assert.equal(manoFinalizada.estado.juego.finalizada, true);
  assert.equal(
    ejecutarAccionCoordinada(manoFinalizada.estado, { tipo: "proponer-truco", jugador: "a" })
      .rechazo.codigo,
    "mano-finalizada",
  );
});

test("acciones coordinadas de Truco son deterministas, inmutables y validan el estado de entrada", () => {
  const { estado } = base();
  const antes = JSON.stringify(estado);
  const accion = { tipo: "proponer-truco", jugador: "a" };
  const resultado = ejecutarAccionCoordinada(estado, accion);
  const duplicado = ejecutarAccionCoordinada(JSON.parse(JSON.stringify(estado)), accion);
  assert.equal(resultado.aceptada, true);
  assert.deepEqual(resultado, duplicado);
  assert.equal(JSON.stringify(estado), antes);
  assert.equal(
    ejecutarAccionCoordinada(
      {
        ...estado,
        truco: {
          apuestaActiva: null,
          propuestaPendiente: { nivel: "vale-cuatro", proponente: "a" },
        },
      },
      accion,
    ).rechazo.codigo,
    "estado-invalido",
  );
});

test("un desafio de Truco pendiente bloquea cartas y una apuesta aceptada las permite", () => {
  const { estado, mano } = base();
  const propuesta = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  const antes = JSON.stringify(propuesta.estado);
  const bloqueada = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[0],
  });
  assert.equal(bloqueada.rechazo.codigo, "truco-pendiente");
  assert.equal(JSON.stringify(propuesta.estado), antes);

  const aceptada = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "quiero-truco",
    jugador: "b",
  });
  const carta = ejecutarAccionCoordinada(aceptada.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[0],
  });
  assert.equal(carta.aceptada, true);
  assert.equal(carta.estado.truco, aceptada.estado.truco);
});

test("Envido y Flor suspenden Truco pendiente, lo preservan y permiten reanudarlo", () => {
  const { estado } = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("oro", 4), c("espada", 5)],
    ],
    c("oro", 7),
  );
  const truco = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  const envido = ejecutarAccionCoordinada(truco.estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  assert.equal(envido.aceptada, true);
  assert.deepEqual(envido.estado.truco, truco.estado.truco);
  assert.equal(
    ejecutarAccionCoordinada(envido.estado, { tipo: "quiero-truco", jugador: "b" }).rechazo.codigo,
    "envido-pendiente",
  );
  const envidoResuelto = ejecutarAccionCoordinada(envido.estado, {
    tipo: "quiero-envido",
    jugador: "b",
  });
  const retrucoDirecto = ejecutarAccionCoordinada(envidoResuelto.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  assert.deepEqual(
    retrucoDirecto.eventos.map((evento) => evento.tipo),
    ["truco-aceptado", "retruco-propuesto"],
  );

  const conFlores = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  ).estado;
  const propuesta = ejecutarAccionCoordinada(conFlores, { tipo: "proponer-truco", jugador: "a" });
  const florA = ejecutarAccionCoordinada(propuesta.estado, { tipo: "anunciar-flor", jugador: "a" });
  const florB = ejecutarAccionCoordinada(florA.estado, { tipo: "anunciar-flor", jugador: "b" });
  const desafio = ejecutarAccionCoordinada(florB.estado, {
    tipo: "proponer-contra-flor",
    jugador: "a",
  });
  assert.deepEqual(desafio.estado.truco, propuesta.estado.truco);
  assert.equal(
    ejecutarAccionCoordinada(desafio.estado, { tipo: "quiero-truco", jugador: "b" }).rechazo.codigo,
    "flor-pendiente",
  );
  const florResuelta = ejecutarAccionCoordinada(desafio.estado, {
    tipo: "no-quiero-contra-flor",
    jugador: "b",
  });
  assert.equal(
    ejecutarAccionCoordinada(florResuelta.estado, { tipo: "quiero-truco", jugador: "b" }).aceptada,
    true,
  );
});

test("terminacion excepcional de Flor impide Truco y cartas sin alterar el desafio suspendido", () => {
  const { estado, mano } = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  );
  const truco = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  const florA = ejecutarAccionCoordinada(truco.estado, { tipo: "anunciar-flor", jugador: "a" });
  const florB = ejecutarAccionCoordinada(florA.estado, { tipo: "anunciar-flor", jugador: "b" });
  const contra = ejecutarAccionCoordinada(florB.estado, {
    tipo: "proponer-contra-flor-al-resto",
    jugador: "a",
  });
  const terminal = ejecutarAccionCoordinada(contra.estado, {
    tipo: "quiero-contra-flor-al-resto",
    jugador: "b",
  });
  assert.equal(terminal.estado.resultadoPartida?.motivo, "contra-flor-al-resto");
  assert.deepEqual(terminal.estado.ciclo, {
    fase: "cierre-definitivo",
    equipoGanador: "A",
    causa: "contra-flor-al-resto",
  });
  assert.deepEqual(terminal.estado.truco, truco.estado.truco);
  assert.equal(
    ejecutarAccionCoordinada(terminal.estado, { tipo: "quiero-truco", jugador: "b" }).rechazo
      .codigo,
    "partida-finalizada",
  );
  assert.equal(
    ejecutarAccionCoordinada(terminal.estado, {
      tipo: "jugar-carta",
      jugador: "a",
      carta: mano.manos[0].cartas[0],
    }).rechazo.codigo,
    "partida-finalizada",
  );
});

test("No quiero coordinado adjudica uno, dos y tres puntos y finaliza la mano canonicamente", () => {
  const { estado } = base();
  const truco = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  const rechazoTruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "no-quiero-truco",
    jugador: "b",
  });
  assert.deepEqual(rechazoTruco.eventos, [
    {
      tipo: "truco-rechazado",
      propuesta: { nivel: "truco", proponente: "a" },
      respondedor: "b",
      adjudicacion: { equipo: "A", puntos: 1, motivo: "rechazo" },
      manoFinalizada: true,
    },
    { tipo: "mano-decidida-por-rechazo-truco", equipo: "A" },
  ]);
  assert.deepEqual(rechazoTruco.estado.juego, {
    ...estado.juego,
    jugadorTurno: null,
    finalizada: true,
    equipoGanador: "A",
    motivoFinalizacion: "rechazo-truco",
  });
  assert.deepEqual(rechazoTruco.estado.ciclo, {
    fase: "cierre-definitivo",
    equipoGanador: "A",
    causa: "rechazo-truco",
  });

  const aceptado = ejecutarAccionCoordinada(truco.estado, { tipo: "quiero-truco", jugador: "b" });
  const retruco = ejecutarAccionCoordinada(aceptado.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const rechazoRetruco = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "no-quiero-retruco",
    jugador: "a",
  });
  assert.deepEqual(rechazoRetruco.eventos[0].adjudicacion, {
    equipo: "B",
    puntos: 2,
    motivo: "rechazo",
  });
  assert.equal(rechazoRetruco.estado.juego.equipoGanador, "B");

  const retrucoDirecto = ejecutarAccionCoordinada(truco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const valeDirecto = ejecutarAccionCoordinada(retrucoDirecto.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  const rechazoVale = ejecutarAccionCoordinada(valeDirecto.estado, {
    tipo: "no-quiero-vale-cuatro",
    jugador: "b",
  });
  assert.deepEqual(rechazoVale.eventos[0].adjudicacion, {
    equipo: "A",
    puntos: 3,
    motivo: "rechazo",
  });
  assert.equal(rechazoVale.estado.juego.equipoGanador, "A");
});

test("rechazos voluntarios persisten una adjudicaciÃ³n canÃ³nica Ãºnica para cada nivel", () => {
  const rechazar = (nivel) => {
    const inicial = base().estado;
    const truco = ejecutarAccionCoordinada(inicial, { tipo: "proponer-truco", jugador: "a" });
    if (nivel === "truco")
      return ejecutarAccionCoordinada(truco.estado, { tipo: "no-quiero-truco", jugador: "b" });
    const querido = ejecutarAccionCoordinada(truco.estado, { tipo: "quiero-truco", jugador: "b" });
    const retruco = ejecutarAccionCoordinada(querido.estado, {
      tipo: "proponer-retruco",
      jugador: "b",
    });
    if (nivel === "retruco")
      return ejecutarAccionCoordinada(retruco.estado, { tipo: "no-quiero-retruco", jugador: "a" });
    const retrucoQuerido = ejecutarAccionCoordinada(retruco.estado, {
      tipo: "quiero-retruco",
      jugador: "a",
    });
    const vale = ejecutarAccionCoordinada(retrucoQuerido.estado, {
      tipo: "proponer-vale-cuatro",
      jugador: "a",
    });
    return ejecutarAccionCoordinada(vale.estado, { tipo: "no-quiero-vale-cuatro", jugador: "b" });
  };
  const resultados = [rechazar("truco"), rechazar("retruco"), rechazar("vale-cuatro")];
  assert.deepEqual(
    resultados.map((resultado) => resultado.estado.adjudicacionTruco),
    [
      {
        causa: "rechazo-voluntario",
        equipo: "A",
        puntos: 1,
        nivelPropuesto: "truco",
        propuestaOrden: 1,
        respondedor: "b",
      },
      {
        causa: "rechazo-voluntario",
        equipo: "B",
        puntos: 2,
        nivelPropuesto: "retruco",
        propuestaOrden: 2,
        respondedor: "a",
      },
      {
        causa: "rechazo-voluntario",
        equipo: "A",
        puntos: 3,
        nivelPropuesto: "vale-cuatro",
        propuestaOrden: 3,
        respondedor: "b",
      },
    ],
  );
  for (const resultado of resultados) {
    assert.equal(resultado.eventos.filter((evento) => "adjudicacion" in evento).length, 1);
    assert.equal(
      resultado.eventos.filter((evento) => evento.tipo === "mano-decidida-por-rechazo-truco")
        .length,
      1,
    );
    assert.equal(resultado.estado.juego.equipoGanador, resultado.estado.adjudicacionTruco.equipo);
  }
});

test("la adjudicaciÃ³n canÃ³nica de rechazo rechaza adulteraciones y no aparece fuera de esa ruta", () => {
  const propuesta = ejecutarAccionCoordinada(base().estado, {
    tipo: "proponer-truco",
    jugador: "a",
  });
  const rechazo = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "no-quiero-truco",
    jugador: "b",
  });
  for (const adjudicacionTruco of [
    { ...rechazo.estado.adjudicacionTruco, equipo: "B" },
    { ...rechazo.estado.adjudicacionTruco, puntos: 2 },
    { ...rechazo.estado.adjudicacionTruco, nivelPropuesto: "retruco" },
    { ...rechazo.estado.adjudicacionTruco, propuestaOrden: 2 },
    { ...rechazo.estado.adjudicacionTruco, respondedor: "a" },
  ]) {
    const adulterado = { ...rechazo.estado, adjudicacionTruco };
    assert.equal(
      ejecutarAccionCoordinada(adulterado, {
        tipo: "jugar-carta",
        jugador: "a",
        carta: adulterado.juego.mano.manos[0].cartas[0],
      }).rechazo.codigo,
      "estado-invalido",
    );
  }
  assert.equal(
    ejecutarAccionCoordinada(
      { ...rechazo.estado, adjudicacionTruco: null },
      { tipo: "proponer-truco", jugador: "a" },
    ).rechazo.codigo,
    "estado-invalido",
  );
  assert.equal(
    ejecutarAccionCoordinada(
      { ...rechazo.estado, truco: { ...rechazo.estado.truco, historialPropuestas: [] } },
      { tipo: "proponer-truco", jugador: "a" },
    ).rechazo.codigo,
    "estado-invalido",
  );
  const activo = base().estado;
  assert.equal(
    ejecutarAccionCoordinada(
      { ...activo, adjudicacionTruco: rechazo.estado.adjudicacionTruco },
      { tipo: "proponer-truco", jugador: "a" },
    ).rechazo.codigo,
    "estado-invalido",
  );
  const mazo = ejecutarAccionCoordinada(baseSinFlor().estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });
  assert.equal(mazo.estado.adjudicacionTruco, null);
  assert.equal(
    ejecutarAccionCoordinada(
      { ...mazo.estado, adjudicacionTruco: rechazo.estado.adjudicacionTruco },
      { tipo: "liquidar-puntos-mazo" },
    ).rechazo.codigo,
    "estado-invalido",
  );
});

test("rechazo de Truco conserva jugadas previas y bloquea toda accion posterior", () => {
  const { estado, mano } = base();
  const primeraCarta = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[0],
  });
  const propuesta = ejecutarAccionCoordinada(primeraCarta.estado, {
    tipo: "proponer-truco",
    jugador: "b",
  });
  const rechazoTruco = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "no-quiero-truco",
    jugador: "a",
  });
  assert.equal(rechazoTruco.estado.juego.bazasCompletadas.length, 0);
  assert.deepEqual(rechazoTruco.estado.juego.bazaActual, primeraCarta.estado.juego.bazaActual);
  assert.deepEqual(
    rechazoTruco.estado.juego.cartasDisponibles,
    primeraCarta.estado.juego.cartasDisponibles,
  );
  assert.equal(rechazoTruco.estado.juego.motivoFinalizacion, "rechazo-truco");
  assert.equal(
    ejecutarAccionCoordinada(rechazoTruco.estado, {
      tipo: "jugar-carta",
      jugador: "b",
      carta: mano.manos[1].cartas[0],
    }).rechazo.codigo,
    "mano-finalizada",
  );
  assert.equal(
    ejecutarAccionCoordinada(rechazoTruco.estado, { tipo: "proponer-truco", jugador: "b" }).rechazo
      .codigo,
    "mano-finalizada",
  );
  assert.equal(
    ejecutarAccionCoordinada(rechazoTruco.estado, {
      tipo: "iniciar-envido",
      jugador: "b",
      canto: "envido",
    }).rechazo.codigo,
    "mano-finalizada",
  );
});

test("No quiero respeta suspensiones, es determinista y rechaza finalizaciones adulteradas", () => {
  const { estado } = base();
  const propuesta = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  const envido = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  assert.equal(
    ejecutarAccionCoordinada(envido.estado, { tipo: "no-quiero-truco", jugador: "b" }).rechazo
      .codigo,
    "envido-pendiente",
  );

  const accion = { tipo: "no-quiero-truco", jugador: "b" };
  const resultado = ejecutarAccionCoordinada(propuesta.estado, accion);
  const duplicado = ejecutarAccionCoordinada(JSON.parse(JSON.stringify(propuesta.estado)), accion);
  assert.deepEqual(resultado, duplicado);
  assert.equal(
    ejecutarAccionCoordinada(
      {
        ...resultado.estado,
        juego: { ...resultado.estado.juego, motivoFinalizacion: "bazas" },
      },
      { tipo: "proponer-truco", jugador: "a" },
    ).rechazo.codigo,
    "estado-invalido",
  );
});

test("bazas adjudican Truco una sola vez con el ganador canonico y el nivel aceptado", () => {
  const sinTruco = baseGanadorA();
  const finSinTruco = finalizarPorBazas(sinTruco.estado, sinTruco.mano);
  assert.deepEqual(finSinTruco.eventos.at(-1), {
    tipo: "truco-adjudicado-por-bazas",
    adjudicacion: { equipo: "A", puntos: 1, motivo: "bazas", nivel: null },
  });
  assert.deepEqual(finSinTruco.estado.adjudicacionTruco, {
    causa: "mano-por-bazas",
    equipo: "A",
    puntos: 1,
    nivelAceptado: null,
  });

  const conEnvido = baseGanadorA();
  const envido = ejecutarAccionCoordinada(conEnvido.estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const envidoAceptado = ejecutarAccionCoordinada(envido.estado, {
    tipo: "quiero-envido",
    jugador: "b",
  });
  const finConEnvido = finalizarPorBazas(envidoAceptado.estado, conEnvido.mano);
  assert.equal(finConEnvido.estado.envido.resueltos.length, 1);
  assert.deepEqual(finConEnvido.eventos.at(-1).adjudicacion, {
    equipo: "A",
    puntos: 1,
    motivo: "bazas",
    nivel: null,
  });

  const conTruco = baseGanadorA();
  const propuesta = ejecutarAccionCoordinada(conTruco.estado, {
    tipo: "proponer-truco",
    jugador: "a",
  });
  const trucoAceptado = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "quiero-truco",
    jugador: "b",
  });
  const finTruco = finalizarPorBazas(trucoAceptado.estado, conTruco.mano);
  assert.deepEqual(finTruco.eventos.at(-1).adjudicacion, {
    equipo: "A",
    puntos: 2,
    motivo: "bazas",
    nivel: "truco",
  });
  assert.equal(finTruco.estado.truco.apuestaActiva.equipoAceptante, "B");
  assert.deepEqual(finTruco.estado.adjudicacionTruco, {
    causa: "mano-por-bazas",
    equipo: "A",
    puntos: 2,
    nivelAceptado: "truco",
  });

  const conRetruco = baseGanadorA();
  const t = ejecutarAccionCoordinada(conRetruco.estado, { tipo: "proponer-truco", jugador: "a" });
  const q = ejecutarAccionCoordinada(t.estado, { tipo: "quiero-truco", jugador: "b" });
  const r = ejecutarAccionCoordinada(q.estado, { tipo: "proponer-retruco", jugador: "b" });
  const qr = ejecutarAccionCoordinada(r.estado, { tipo: "quiero-retruco", jugador: "a" });
  const finRetruco = finalizarPorBazas(qr.estado, conRetruco.mano);
  assert.deepEqual(finRetruco.eventos.at(-1).adjudicacion, {
    equipo: "A",
    puntos: 3,
    motivo: "bazas",
    nivel: "retruco",
  });
  assert.deepEqual(finRetruco.estado.adjudicacionTruco, {
    causa: "mano-por-bazas",
    equipo: "A",
    puntos: 3,
    nivelAceptado: "retruco",
  });

  const conVale = baseGanadorA();
  const p = ejecutarAccionCoordinada(conVale.estado, { tipo: "proponer-truco", jugador: "a" });
  const rDirecto = ejecutarAccionCoordinada(p.estado, { tipo: "proponer-retruco", jugador: "b" });
  const vDirecto = ejecutarAccionCoordinada(rDirecto.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  const valeAceptado = ejecutarAccionCoordinada(vDirecto.estado, {
    tipo: "quiero-vale-cuatro",
    jugador: "b",
  });
  const finVale = finalizarPorBazas(valeAceptado.estado, conVale.mano);
  assert.deepEqual(finVale.eventos.at(-1).adjudicacion, {
    equipo: "A",
    puntos: 4,
    motivo: "bazas",
    nivel: "vale-cuatro",
  });
  assert.equal(finVale.estado.truco.apuestaActiva.equipoAceptante, "B");
  assert.deepEqual(finVale.estado.adjudicacionTruco, {
    causa: "mano-por-bazas",
    equipo: "A",
    puntos: 4,
    nivelAceptado: "vale-cuatro",
  });
});

test("recorrido público completa una mano 1v1 de Envido y Truco por bazas", () => {
  const { estado: inicial, mano } = baseGanadorA();
  const antes = JSON.parse(JSON.stringify(inicial));
  const envido = ejecutarAccionCoordinada(inicial, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const envidoAceptado = ejecutarAccionCoordinada(envido.estado, {
    tipo: "quiero-envido",
    jugador: "b",
  });
  const truco = ejecutarAccionCoordinada(envidoAceptado.estado, {
    tipo: "proponer-truco",
    jugador: "a",
  });
  const trucoAceptado = ejecutarAccionCoordinada(truco.estado, {
    tipo: "quiero-truco",
    jugador: "b",
  });
  const cartasA = mano.manos.find((item) => item.jugador === "a").cartas;
  const cartasB = mano.manos.find((item) => item.jugador === "b").cartas;
  const primeraA = ejecutarAccionCoordinada(trucoAceptado.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: cartasA[0],
  });
  const primeraB = ejecutarAccionCoordinada(primeraA.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: cartasB[0],
  });
  const segundaA = ejecutarAccionCoordinada(primeraB.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: cartasA[1],
  });
  const final = ejecutarAccionCoordinada(segundaA.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: cartasB[1],
  });

  assert.equal(final.aceptada, true);
  assert.equal(final.estado.juego.finalizada, true);
  assert.equal(final.estado.juego.equipoGanador, "A");
  assert.deepEqual(
    final.estado.envido.resueltos.map(({ equipo, puntos, motivo, respuesta }) => ({
      equipo,
      puntos,
      motivo,
      respuesta,
    })),
    [{ equipo: "B", puntos: 2, motivo: "aceptacion", respuesta: "quiero" }],
  );
  assert.deepEqual(final.estado.adjudicacionTruco, {
    causa: "mano-por-bazas",
    equipo: "A",
    puntos: 2,
    nivelAceptado: "truco",
  });
  assert.equal(
    ejecutarAccionCoordinada(final.estado, { tipo: "jugar-carta", jugador: "a", carta: cartasA[2] })
      .rechazo.codigo,
    "mano-finalizada",
  );
  assert.deepEqual(inicial, antes);
});

test("adjudicacion por bazas solo aparece al finalizar, no ante cartas invalidas y mantiene orden", () => {
  const { estado, mano } = baseGanadorA();
  const invalida = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos[1].cartas[0],
  });
  assert.equal(invalida.aceptada, false);
  const primera = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[0],
  });
  assert.equal(
    primera.eventos.some((evento) => evento.tipo === "truco-adjudicado-por-bazas"),
    false,
  );
  assert.equal(primera.estado.adjudicacionTruco, null);
  const final = finalizarPorBazas(estado, mano);
  assert.deepEqual(final.eventos.map((evento) => evento.tipo).slice(-4), [
    "carta-jugada",
    "baza-resuelta",
    "mano-decidida-por-bazas",
    "truco-adjudicado-por-bazas",
  ]);
  assert.deepEqual(final.estado.ciclo, {
    fase: "cierre-definitivo",
    equipoGanador: "A",
    causa: "bazas",
  });
  assert.equal(
    ejecutarAccionCoordinada(final.estado, {
      tipo: "jugar-carta",
      jugador: "a",
      carta: mano.manos[0].cartas[2],
    }).rechazo.codigo,
    "mano-finalizada",
  );
});

test("la adjudicaciÃ³n canÃ³nica por bazas exige ganador, nivel y puntaje exactos", () => {
  const { estado, mano } = baseGanadorA();
  const final = finalizarPorBazas(estado, mano);
  for (const adjudicacionTruco of [
    { ...final.estado.adjudicacionTruco, equipo: "B" },
    { ...final.estado.adjudicacionTruco, puntos: 2 },
    { ...final.estado.adjudicacionTruco, nivelAceptado: "truco" },
  ]) {
    assert.equal(
      ejecutarAccionCoordinada(
        { ...final.estado, adjudicacionTruco },
        { tipo: "proponer-truco", jugador: "a" },
      ).rechazo.codigo,
      "estado-invalido",
    );
  }
  assert.equal(
    ejecutarAccionCoordinada(
      { ...final.estado, adjudicacionTruco: null },
      { tipo: "proponer-truco", jugador: "a" },
    ).rechazo.codigo,
    "estado-invalido",
  );
  assert.equal(
    ejecutarAccionCoordinada(
      { ...final.estado, juego: { ...final.estado.juego, motivoFinalizacion: "rechazo-truco" } },
      { tipo: "proponer-truco", jugador: "a" },
    ).rechazo.codigo,
    "estado-invalido",
  );
});

function estadoConFlorReceptora() {
  return estadoConManos(
    [
      [c("espada", 1), c("basto", 3), c("oro", 2)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  );
}

test("Con Flor Quiero anuncia fuera de turno y acepta Truco, Retruco y Vale Cuatro", () => {
  const inicial = estadoConFlorReceptora();
  const truco = ejecutarAccionCoordinada(inicial.estado, { tipo: "proponer-truco", jugador: "a" });
  const conFlorTruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "con-flor-quiero",
    jugador: "b",
  });
  assert.deepEqual(
    conFlorTruco.eventos.map((evento) => evento.tipo),
    ["flor-anunciada", "truco-aceptado"],
  );
  assert.deepEqual(conFlorTruco.estado.truco, {
    apuestaActiva: { nivel: "truco", equipoAceptante: "B" },
    propuestaPendiente: null,
    historialPropuestas: [
      {
        orden: 1,
        nivel: "truco",
        proponente: "a",
        equipoProponente: "A",
        nivelAceptadoAnterior: null,
        respuesta: "quiero",
      },
    ],
  });
  assert.deepEqual(conFlorTruco.estado.flor.anuncios, [{ jugador: "b", equipo: "B" }]);
  assert.equal(conFlorTruco.estado.flor.adjudicaciones.length, 0);
  assert.equal(conFlorTruco.estado.juego, inicial.estado.juego);

  const retruco = ejecutarAccionCoordinada(conFlorTruco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const conFlorRetruco = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "con-flor-quiero",
    jugador: "a",
  });
  assert.equal(conFlorRetruco.rechazo.codigo, "flor-inexistente");

  const conFlores = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  ).estado;
  const p = ejecutarAccionCoordinada(conFlores, { tipo: "proponer-truco", jugador: "a" });
  const q = ejecutarAccionCoordinada(p.estado, { tipo: "quiero-truco", jugador: "b" });
  const r = ejecutarAccionCoordinada(q.estado, { tipo: "proponer-retruco", jugador: "b" });
  const conFlorRetrucoValido = ejecutarAccionCoordinada(r.estado, {
    tipo: "con-flor-quiero",
    jugador: "a",
  });
  assert.deepEqual(conFlorRetrucoValido.estado.truco.apuestaActiva, {
    nivel: "retruco",
    equipoAceptante: "A",
  });

  const p2 = ejecutarAccionCoordinada(inicial.estado, { tipo: "proponer-truco", jugador: "a" });
  const r2 = ejecutarAccionCoordinada(p2.estado, { tipo: "proponer-retruco", jugador: "b" });
  const v2 = ejecutarAccionCoordinada(r2.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  const conFlorVale = ejecutarAccionCoordinada(v2.estado, {
    tipo: "con-flor-quiero",
    jugador: "b",
  });
  assert.deepEqual(conFlorVale.estado.truco.apuestaActiva, {
    nivel: "vale-cuatro",
    equipoAceptante: "B",
  });
});

test("Con Flor Quiero cancela Envido, preserva prioridad y permite desafios posteriores de Flor", () => {
  const { estado } = estadoConFlorReceptora();
  const truco = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  const envido = ejecutarAccionCoordinada(truco.estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const compuesto = ejecutarAccionCoordinada(envido.estado, {
    tipo: "con-flor-quiero",
    jugador: "b",
  });
  assert.deepEqual(
    compuesto.eventos.map((evento) => evento.tipo),
    ["flor-anunciada", "envido-cancelado-por-flor", "truco-aceptado"],
  );
  assert.equal(compuesto.estado.envido.pendiente, null);
  assert.deepEqual(compuesto.estado.envido.resueltos, []);
  assert.deepEqual(compuesto.estado.envido.cancelacionPorFlor, {
    causa: "cancelado-por-flor",
    jugadorFlor: "b",
    equipoFlor: "B",
    historial: envido.estado.envido.pendiente.cantos,
  });
  assert.equal(compuesto.estado.truco.apuestaActiva.nivel, "truco");

  const dosFlores = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  ).estado;
  const propuesta = ejecutarAccionCoordinada(dosFlores, { tipo: "proponer-truco", jugador: "a" });
  const respuesta = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "con-flor-quiero",
    jugador: "b",
  });
  const anuncioPosterior = ejecutarAccionCoordinada(respuesta.estado, {
    tipo: "anunciar-flor",
    jugador: "a",
  });
  const desafio = ejecutarAccionCoordinada(anuncioPosterior.estado, {
    tipo: "proponer-contra-flor",
    jugador: "a",
  });
  assert.equal(desafio.aceptada, true);
});

test("Con Flor Quiero conserva atomicidad ante precondiciones invalidas", () => {
  const { estado } = estadoConFlorReceptora();
  const antes = JSON.stringify(estado);
  assert.equal(
    ejecutarAccionCoordinada(estado, { tipo: "con-flor-quiero", jugador: "b" }).rechazo.codigo,
    "sin-propuesta-pendiente",
  );
  assert.equal(JSON.stringify(estado), antes);

  const propuesta = ejecutarAccionCoordinada(estado, { tipo: "proponer-truco", jugador: "a" });
  assert.equal(
    ejecutarAccionCoordinada(propuesta.estado, { tipo: "con-flor-quiero", jugador: "a" }).rechazo
      .codigo,
    "flor-inexistente",
  );
  assert.equal(
    ejecutarAccionCoordinada(propuesta.estado, { tipo: "anunciar-flor", jugador: "b" }).rechazo
      .codigo,
    "primer-anuncio-fuera-de-turno",
  );
});

test("Con Flor Quiero no recupera derechos perdidos y es determinista", () => {
  const { estado, mano } = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("espada", 1), c("basto", 3), c("copa", 2)],
    ],
    c("copa", 7),
  );
  const primera = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos[0].cartas[0],
  });
  const segunda = ejecutarAccionCoordinada(primera.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos[1].cartas[0],
  });
  const propuesta = ejecutarAccionCoordinada(segunda.estado, {
    tipo: "proponer-truco",
    jugador: "b",
  });
  assert.equal(
    ejecutarAccionCoordinada(propuesta.estado, { tipo: "con-flor-quiero", jugador: "a" }).rechazo
      .codigo,
    "derecho-perdido",
  );

  const original = estadoConFlorReceptora();
  const truco = ejecutarAccionCoordinada(original.estado, { tipo: "proponer-truco", jugador: "a" });
  const accion = { tipo: "con-flor-quiero", jugador: "b" };
  assert.deepEqual(
    ejecutarAccionCoordinada(truco.estado, accion),
    ejecutarAccionCoordinada(JSON.parse(JSON.stringify(truco.estado)), accion),
  );
});

test("Con Flor Quiero mantiene la apuesta aceptada durante Flor y la continuación de cartas", () => {
  const conFlores = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  );
  const truco = ejecutarAccionCoordinada(conFlores.estado, {
    tipo: "proponer-truco",
    jugador: "a",
  });
  const quieroTruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "con-flor-quiero",
    jugador: "b",
  });
  const retruco = ejecutarAccionCoordinada(quieroTruco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  assert.equal(retruco.aceptada, true);
  const quieroRetruco = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "quiero-retruco",
    jugador: "a",
  });
  assert.equal(quieroRetruco.aceptada, true);
  const valeCuatro = ejecutarAccionCoordinada(quieroRetruco.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  assert.equal(valeCuatro.aceptada, true);
  const quieroValeCuatro = ejecutarAccionCoordinada(valeCuatro.estado, {
    tipo: "quiero-vale-cuatro",
    jugador: "b",
  });
  assert.equal(quieroValeCuatro.aceptada, true);

  assert.equal(quieroValeCuatro.estado.truco.apuestaActiva.nivel, "vale-cuatro");
  assert.equal(quieroValeCuatro.estado.truco.propuestaPendiente, null);
  const continuacion = finalizarPorBazas(quieroValeCuatro.estado, conFlores.mano);
  assert.equal(continuacion.aceptada, true);
  assert.equal(continuacion.estado.truco.apuestaActiva.nivel, "vale-cuatro");
  assert.equal(
    continuacion.eventos.some((evento) => evento.tipo === "truco-adjudicado-por-bazas"),
    false,
  );
});

test("la excepción de Con Flor Quiero no se expone por la API pública de Flor", () => {
  assert.equal("anunciarFlorPorConFlorQuiero" in motor, false);
});

test("irse al mazo 1v1 conserva pendiente la adjudicación del nivel de Truco aceptado", () => {
  const sinTruco = ejecutarAccionCoordinada(base().estado, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(sinTruco.aceptada, true);
  assert.deepEqual(
    sinTruco.eventos.map((evento) => evento.tipo),
    ["mano-decidida-por-mazo"],
  );
  assert.equal(sinTruco.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(sinTruco.estado.adjudicacionTruco, null);
  assert.equal(sinTruco.estado.juego.motivoFinalizacion, "mazo");
  assert.equal(
    ejecutarAccionCoordinada(sinTruco.estado, { tipo: "irse-al-mazo", jugador: "b" }).rechazo
      .codigo,
    "mano-finalizada",
  );
  assert.equal(
    ejecutarAccionCoordinada(sinTruco.estado, { tipo: "proponer-truco", jugador: "b" }).rechazo
      .codigo,
    "mano-finalizada",
  );

  const truco = ejecutarAccionCoordinada(base().estado, { tipo: "proponer-truco", jugador: "a" });
  const quieroTruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "quiero-truco",
    jugador: "b",
  });
  const mazoTruco = ejecutarAccionCoordinada(quieroTruco.estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });
  assert.equal(mazoTruco.estado.truco.apuestaActiva.nivel, "truco");
  assert.equal(mazoTruco.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(mazoTruco.estado.adjudicacionTruco, null);
  const retruco = ejecutarAccionCoordinada(quieroTruco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const quieroRetruco = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "quiero-retruco",
    jugador: "a",
  });
  const mazoRetruco = ejecutarAccionCoordinada(quieroRetruco.estado, {
    tipo: "irse-al-mazo",
    jugador: "b",
  });
  assert.equal(mazoRetruco.estado.truco.apuestaActiva.nivel, "retruco");
  assert.equal(mazoRetruco.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(mazoRetruco.estado.adjudicacionTruco, null);
  const vale = ejecutarAccionCoordinada(quieroRetruco.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  const quieroVale = ejecutarAccionCoordinada(vale.estado, {
    tipo: "quiero-vale-cuatro",
    jugador: "b",
  });
  const mazoVale = ejecutarAccionCoordinada(quieroVale.estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });
  assert.equal(mazoVale.estado.truco.apuestaActiva.nivel, "vale-cuatro");
  assert.equal(mazoVale.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(mazoVale.estado.adjudicacionTruco, null);
});

test("irse al mazo bloquea desafíos, prepara 2v2 y no muta rechazos", () => {
  const envido = ejecutarAccionCoordinada(base().estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const mazoEnvido = ejecutarAccionCoordinada(envido.estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });
  assert.equal(mazoEnvido.aceptada, true);
  assert.equal(
    mazoEnvido.estado.envido.liquidacionPorRetiro.causa,
    "propuesta-cancelada-por-retiro",
  );
  assert.equal(mazoEnvido.estado.liquidacionMazo.puntos, "pendiente");
  const truco = ejecutarAccionCoordinada(base().estado, { tipo: "proponer-truco", jugador: "a" });
  assert.equal(
    ejecutarAccionCoordinada(truco.estado, { tipo: "irse-al-mazo", jugador: "a" }).aceptada,
    true,
  );
  const aceptado = ejecutarAccionCoordinada(truco.estado, { tipo: "quiero-truco", jugador: "b" });
  const retruco = ejecutarAccionCoordinada(aceptado.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  assert.equal(
    ejecutarAccionCoordinada(retruco.estado, { tipo: "irse-al-mazo", jugador: "b" }).aceptada,
    true,
  );
  const retrucoAceptado = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "quiero-retruco",
    jugador: "a",
  });
  const vale = ejecutarAccionCoordinada(retrucoAceptado.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  assert.equal(
    ejecutarAccionCoordinada(vale.estado, { tipo: "irse-al-mazo", jugador: "a" }).aceptada,
    true,
  );
  const conFlores = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  ).estado;
  const florA = ejecutarAccionCoordinada(conFlores, { tipo: "anunciar-flor", jugador: "a" });
  const florB = ejecutarAccionCoordinada(florA.estado, { tipo: "anunciar-flor", jugador: "b" });
  const contraFlor = ejecutarAccionCoordinada(florB.estado, {
    tipo: "proponer-contra-flor",
    jugador: "a",
  });
  const mazoContraFlor = ejecutarAccionCoordinada(contraFlor.estado, {
    tipo: "irse-al-mazo",
    jugador: "b",
  });
  assert.equal(mazoContraFlor.aceptada, true);
  assert.equal(mazoContraFlor.estado.flor.pendiente, null);
  assert.equal(
    mazoContraFlor.estado.flor.historialDesafios.at(-1).respuesta,
    "rechazo-implicito-por-retiro",
  );
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "a", equipo: "A", posicion: 0 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "d", equipo: "B", posicion: 3 },
    ],
  };
  const mano = prepararMano(mesa2v2, "d", crearMazo());
  const estado2v2 = crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
    metaPuntos: 40,
    puntajesIniciales: { A: 0, B: 0 },
    esDesempate: false,
  });
  const retiro2v2 = ejecutarAccionCoordinada(estado2v2, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(retiro2v2.aceptada, true);
  assert.deepEqual(retiro2v2.estado.juego.retirados, ["a"]);
  assert.equal(retiro2v2.estado.ciclo.fase, "competencia-activa");
});

test("irse al mazo 1v1 es válido fuera del turno de carta", () => {
  const { estado } = base();
  assert.equal(estado.juego.jugadorTurno, "a");
  const resultado = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "b" });
  assert.equal(resultado.aceptada, true);
  assert.deepEqual(resultado.eventos, [{ tipo: "mano-decidida-por-mazo", equipo: "A" }]);
  assert.equal(resultado.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(resultado.estado.adjudicacionTruco, null);
});

test("irse al mazo no confunde una fase de Flor abierta sin desafío pendiente", () => {
  const { estado } = base();
  assert.equal(estado.flor.cerrado, false);
  assert.equal(estado.flor.pendiente, null);
  const resultado = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(resultado.aceptada, true);
  assert.deepEqual(resultado.eventos, [{ tipo: "mano-decidida-por-mazo", equipo: "B" }]);
  assert.equal(resultado.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(resultado.estado.adjudicacionTruco, null);
});

test("mazo resuelve el desafío de Flor antes del cierre diferido y valida su procedencia", () => {
  const conFlores = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  ).estado;
  const florA = ejecutarAccionCoordinada(conFlores, { tipo: "anunciar-flor", jugador: "a" });
  const florB = ejecutarAccionCoordinada(florA.estado, { tipo: "anunciar-flor", jugador: "b" });
  const desafio = ejecutarAccionCoordinada(florB.estado, {
    tipo: "proponer-contra-flor",
    jugador: "a",
  });

  const rechazo = ejecutarAccionCoordinada(desafio.estado, { tipo: "irse-al-mazo", jugador: "b" });
  assert.equal(rechazo.aceptada, true);
  assert.equal(
    rechazo.estado.flor.historialDesafios.at(-1).respuesta,
    "rechazo-implicito-por-retiro",
  );
  assert.equal(rechazo.estado.flor.adjudicaciones.length, 2);
  const cierreRechazo = ejecutarAccionCoordinada(rechazo.estado, { tipo: "liquidar-puntos-mazo" });
  assert.equal(cierreRechazo.aceptada, true);
  assert.equal(cierreRechazo.estado.flor.adjudicaciones.length, 2);

  const adulterado = {
    ...rechazo.estado,
    flor: {
      ...rechazo.estado.flor,
      historialDesafios: rechazo.estado.flor.historialDesafios.map((historial, indice) =>
        indice === rechazo.estado.flor.historialDesafios.length - 1
          ? { ...historial, proponente: "b" }
          : historial,
      ),
    },
  };
  const invalido = ejecutarAccionCoordinada(adulterado, { tipo: "liquidar-puntos-mazo" });
  assert.equal(invalido.aceptada, false);
  assert.equal(invalido.rechazo.codigo, "estado-invalido");
  assert.equal(adulterado.flor.historialDesafios.at(-1).proponente, "b");

  const cancelacion = ejecutarAccionCoordinada(desafio.estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });
  assert.equal(cancelacion.aceptada, true);
  assert.equal(cancelacion.estado.flor.historialDesafios.at(-1).respuesta, "cancelado-por-retiro");
  assert.equal(
    ejecutarAccionCoordinada(cancelacion.estado, { tipo: "liquidar-puntos-mazo" }).aceptada,
    true,
  );
});

test("mazo liquida Envido pendiente canónicamente y conserva la mano diferida", () => {
  const preparar = (cantos) => {
    let estado = baseSinFlor().estado;
    for (const [indice, canto] of cantos.entries()) {
      const resultado = ejecutarAccionCoordinada(estado, {
        tipo: indice === 0 ? "iniciar-envido" : "aumentar-envido",
        jugador: indice % 2 === 0 ? "a" : "b",
        canto,
      });
      assert.equal(resultado.aceptada, true);
      estado = resultado.estado;
    }
    return estado;
  };
  for (const { cantos, rechazo } of [
    { cantos: ["envido"], rechazo: 1 },
    { cantos: ["real-envido"], rechazo: 1 },
    { cantos: ["falta-envido"], rechazo: 1 },
    { cantos: ["envido", "envido"], rechazo: 2 },
    { cantos: ["envido", "real-envido"], rechazo: 2 },
    { cantos: ["real-envido", "falta-envido"], rechazo: 3 },
    { cantos: ["envido", "envido", "real-envido", "falta-envido"], rechazo: 7 },
  ]) {
    const estado = preparar(cantos);
    const proponente = cantos.length % 2 ? "a" : "b";
    const respondedor = proponente === "a" ? "b" : "a";
    const rechazoImplicito = ejecutarAccionCoordinada(estado, {
      tipo: "irse-al-mazo",
      jugador: respondedor,
    });
    assert.equal(rechazoImplicito.aceptada, true);
    assert.equal(rechazoImplicito.estado.envido.resueltos[0].puntos, rechazo);
    assert.equal(rechazoImplicito.estado.envido.liquidacionPorRetiro.jugadorRetirado, respondedor);
    assert.equal(rechazoImplicito.estado.juego.equipoGanador, proponente === "a" ? "A" : "B");
    assert.deepEqual(
      rechazoImplicito.eventos.map((evento) => evento.tipo),
      ["envido-rechazo-implicito-por-retiro", "mano-decidida-por-mazo"],
    );
    const mano = ejecutarAccionCoordinada(rechazoImplicito.estado, {
      tipo: "liquidar-puntos-mazo",
    });
    assert.equal(mano.aceptada, true);
    assert.equal(mano.estado.adjudicacionTruco.puntos, 1);

    const cancelacion = ejecutarAccionCoordinada(estado, {
      tipo: "irse-al-mazo",
      jugador: proponente,
    });
    assert.equal(cancelacion.aceptada, true);
    assert.equal(cancelacion.estado.envido.resueltos.length, 0);
    assert.equal(
      cancelacion.estado.envido.liquidacionPorRetiro.causa,
      "propuesta-cancelada-por-retiro",
    );
    assert.equal(cancelacion.estado.juego.equipoGanador, respondedor === "a" ? "A" : "B");
  }
});

test("mazo con Envido rechaza procedencias históricas adulteradas sin mutar", () => {
  const iniciado = ejecutarAccionCoordinada(baseSinFlor().estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const mazo = ejecutarAccionCoordinada(iniciado.estado, { tipo: "irse-al-mazo", jugador: "b" });
  assert.equal(mazo.aceptada, true);
  const accion = { tipo: "liquidar-puntos-mazo" };
  for (const estado of [
    { ...mazo.estado, juego: { ...mazo.estado.juego, retirados: ["a"] } },
    {
      ...mazo.estado,
      envido: {
        ...mazo.estado.envido,
        liquidacionPorRetiro: { ...mazo.estado.envido.liquidacionPorRetiro, jugadorRetirado: "a" },
      },
    },
    { ...mazo.estado, liquidacionMazo: null },
  ]) {
    const antes = JSON.stringify(estado);
    assert.equal(ejecutarAccionCoordinada(estado, accion).rechazo.codigo, "estado-invalido");
    assert.equal(JSON.stringify(estado), antes);
  }
});

test("irse al mazo conserva la adjudicación resuelta de Envido sin reemitirla", () => {
  const iniciado = ejecutarAccionCoordinada(baseGanadorA().estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const envido = ejecutarAccionCoordinada(iniciado.estado, { tipo: "quiero-envido", jugador: "b" });
  assert.equal(envido.aceptada, true);
  assert.equal(envido.estado.envido.resueltos.length, 1);
  const adjudicacionPrevia = envido.estado.envido.resueltos[0];

  const mazo = ejecutarAccionCoordinada(envido.estado, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(mazo.aceptada, true);
  assert.equal(mazo.estado.envido, envido.estado.envido);
  assert.deepEqual(mazo.estado.envido.resueltos, [adjudicacionPrevia]);
  assert.deepEqual(
    mazo.eventos.map((evento) => evento.tipo),
    ["mano-decidida-por-mazo"],
  );
  assert.equal(
    mazo.eventos.some((evento) => evento.tipo.startsWith("envido-")),
    false,
  );
  assert.equal(mazo.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(mazo.estado.adjudicacionTruco, null);
});

test("irse al mazo conserva la adjudicación resuelta de Flor sin reemitirla", () => {
  const conFlores = estadoConManos(
    [
      [c("oro", 1), c("oro", 3), c("oro", 6)],
      [c("copa", 1), c("copa", 3), c("copa", 6)],
    ],
    c("espada", 7),
  ).estado;
  const florA = ejecutarAccionCoordinada(conFlores, { tipo: "anunciar-flor", jugador: "a" });
  const florB = ejecutarAccionCoordinada(florA.estado, { tipo: "anunciar-flor", jugador: "b" });
  const desafio = ejecutarAccionCoordinada(florB.estado, {
    tipo: "proponer-contra-flor",
    jugador: "a",
  });
  const flor = ejecutarAccionCoordinada(desafio.estado, {
    tipo: "no-quiero-contra-flor",
    jugador: "b",
  });
  assert.equal(flor.aceptada, true);
  assert.equal(flor.estado.flor.adjudicaciones.length, 2);
  const adjudicacionesPrevias = flor.estado.flor.adjudicaciones;

  const mazo = ejecutarAccionCoordinada(flor.estado, { tipo: "irse-al-mazo", jugador: "b" });
  assert.equal(mazo.aceptada, true);
  assert.equal(mazo.estado.flor, flor.estado.flor);
  assert.deepEqual(mazo.estado.flor.adjudicaciones, adjudicacionesPrevias);
  assert.deepEqual(
    mazo.eventos.map((evento) => evento.tipo),
    ["mano-decidida-por-mazo"],
  );
  assert.equal(
    mazo.eventos.some((evento) => evento.tipo.includes("flor")),
    false,
  );
  assert.equal(mazo.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(mazo.estado.adjudicacionTruco, null);
});

test("retiro 1v1 difiere adjudicación de Truco hasta liquidación", () => {
  const resultado = ejecutarAccionCoordinada(base().estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });

  assert.equal(resultado.aceptada, true);
  assert.equal(resultado.estado.juego.equipoGanador, "B");
  assert.equal(resultado.estado.juego.finalizada, true);
  assert.deepEqual(resultado.eventos, [{ tipo: "mano-decidida-por-mazo", equipo: "B" }]);
  assert.equal(
    resultado.eventos.some((evento) => evento.tipo === "mazo-adjudicado"),
    false,
  );
  assert.equal(
    resultado.eventos.some((evento) => "adjudicacion" in evento),
    false,
  );
  assert.equal(resultado.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(resultado.estado.adjudicacionTruco, null);
  assert.equal(
    esCicloCoherenteConEstado(
      resultado.estado.ciclo,
      resultado.estado.juego,
      resultado.estado.resultadoPartida,
      resultado.estado.liquidacionMazo,
      resultado.estado.flor,
    ),
    true,
  );
});

test("liquida una vez los puntos de mano por mazo según el último Truco aceptado", () => {
  const sinTruco = ejecutarAccionCoordinada(baseSinFlor().estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });
  const liquidadoSinTruco = ejecutarAccionCoordinada(sinTruco.estado, {
    tipo: "liquidar-puntos-mazo",
  });
  assert.equal(liquidadoSinTruco.aceptada, true);
  assert.deepEqual(liquidadoSinTruco.eventos, [
    {
      tipo: "mazo-adjudicado",
      jugadorRetirado: "a",
      adjudicacion: { equipo: "B", puntos: 1, motivo: "mazo", nivel: null },
    },
  ]);
  assert.deepEqual(liquidadoSinTruco.estado.adjudicacionTruco, {
    causa: "mano-por-mazo",
    equipo: "B",
    puntos: 1,
    nivelAceptado: null,
  });
  assert.equal(liquidadoSinTruco.estado.liquidacionMazo.puntos, "realizada");
  assert.deepEqual(liquidadoSinTruco.estado.ciclo, {
    fase: "liquidacion",
    equipoGanador: "B",
    causa: "mazo",
  });

  const truco = ejecutarAccionCoordinada(baseSinFlor().estado, {
    tipo: "proponer-truco",
    jugador: "a",
  });
  const quieroTruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "quiero-truco",
    jugador: "b",
  });
  const liquidadoTruco = ejecutarAccionCoordinada(
    ejecutarAccionCoordinada(quieroTruco.estado, { tipo: "irse-al-mazo", jugador: "a" }).estado,
    { tipo: "liquidar-puntos-mazo" },
  );
  assert.equal(liquidadoTruco.aceptada, true);
  assert.equal(liquidadoTruco.estado.adjudicacionTruco.puntos, 2);

  const retruco = ejecutarAccionCoordinada(quieroTruco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const quieroRetruco = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "quiero-retruco",
    jugador: "a",
  });
  const liquidadoRetruco = ejecutarAccionCoordinada(
    ejecutarAccionCoordinada(quieroRetruco.estado, { tipo: "irse-al-mazo", jugador: "b" }).estado,
    { tipo: "liquidar-puntos-mazo" },
  );
  assert.equal(liquidadoRetruco.aceptada, true);
  assert.equal(liquidadoRetruco.estado.adjudicacionTruco.puntos, 3);

  const vale = ejecutarAccionCoordinada(quieroRetruco.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  const quieroVale = ejecutarAccionCoordinada(vale.estado, {
    tipo: "quiero-vale-cuatro",
    jugador: "b",
  });
  const liquidadoVale = ejecutarAccionCoordinada(
    ejecutarAccionCoordinada(quieroVale.estado, { tipo: "irse-al-mazo", jugador: "a" }).estado,
    { tipo: "liquidar-puntos-mazo" },
  );
  assert.equal(liquidadoVale.aceptada, true);
  assert.equal(liquidadoVale.estado.adjudicacionTruco.puntos, 4);

  const antesSegundoIntento = JSON.stringify(liquidadoSinTruco.estado);
  const segundoIntento = ejecutarAccionCoordinada(liquidadoSinTruco.estado, {
    tipo: "liquidar-puntos-mazo",
  });
  assert.equal(segundoIntento.aceptada, false);
  assert.equal(JSON.stringify(liquidadoSinTruco.estado), antesSegundoIntento);
});

test("liquidación por mazo preserva Envido aceptado, rechazado y Falta Envido sin reemitirlos", () => {
  const escenarios = [
    {
      nombre: "aceptado",
      resolver: (estado) => {
        const iniciado = ejecutarAccionCoordinada(estado, {
          tipo: "iniciar-envido",
          jugador: "a",
          canto: "envido",
        });
        return ejecutarAccionCoordinada(iniciado.estado, { tipo: "quiero-envido", jugador: "b" });
      },
    },
    {
      nombre: "rechazado",
      resolver: (estado) => {
        const iniciado = ejecutarAccionCoordinada(estado, {
          tipo: "iniciar-envido",
          jugador: "a",
          canto: "envido",
        });
        return ejecutarAccionCoordinada(iniciado.estado, {
          tipo: "no-quiero-envido",
          jugador: "b",
        });
      },
    },
    {
      nombre: "falta-envido aceptada",
      resolver: (estado) => {
        const iniciado = ejecutarAccionCoordinada(estado, {
          tipo: "iniciar-envido",
          jugador: "a",
          canto: "falta-envido",
        });
        return ejecutarAccionCoordinada(iniciado.estado, { tipo: "quiero-envido", jugador: "b" });
      },
    },
  ];

  for (const escenario of escenarios) {
    const envido = escenario.resolver(baseGanadorA().estado);
    assert.equal(envido.aceptada, true, escenario.nombre);
    assert.equal(envido.estado.envido.resueltos.length, 1, escenario.nombre);
    const resueltos = envido.estado.envido.resueltos;
    const mazo = ejecutarAccionCoordinada(envido.estado, { tipo: "irse-al-mazo", jugador: "a" });
    assert.equal(mazo.aceptada, true, escenario.nombre);

    const liquidado = ejecutarAccionCoordinada(mazo.estado, { tipo: "liquidar-puntos-mazo" });
    assert.equal(liquidado.aceptada, true, escenario.nombre);
    assert.equal(liquidado.estado.envido.resueltos, resueltos, escenario.nombre);
    assert.deepEqual(liquidado.estado.envido.resueltos, resueltos, escenario.nombre);
    assert.equal(
      liquidado.eventos.some((evento) => evento.tipo.startsWith("envido-")),
      false,
      escenario.nombre,
    );
    assert.deepEqual(liquidado.eventos, [
      {
        tipo: "mazo-adjudicado",
        jugadorRetirado: "a",
        adjudicacion: { equipo: "B", puntos: 1, motivo: "mazo", nivel: null },
      },
    ]);
    assert.equal(liquidado.estado.liquidacionMazo.puntos, "realizada", escenario.nombre);
    assert.deepEqual(liquidado.estado.ciclo, {
      fase: "liquidacion",
      equipoGanador: "B",
      causa: "mazo",
    });

    const antesSegundoIntento = JSON.stringify(liquidado.estado);
    const segundoIntento = ejecutarAccionCoordinada(liquidado.estado, {
      tipo: "liquidar-puntos-mazo",
    });
    assert.equal(segundoIntento.aceptada, false, escenario.nombre);
    assert.equal(JSON.stringify(liquidado.estado), antesSegundoIntento, escenario.nombre);
  }
});

test("liquidación por mazo adjudica Flor ordinaria antes de Truco una sola vez", () => {
  const escenarios = [
    {
      nombre: "Flor del retirado",
      crear: () => {
        const estado = estadoConManos(
          [
            [c("copa", 1), c("copa", 3), c("copa", 6)],
            [c("espada", 1), c("basto", 7), c("oro", 3)],
          ],
          c("oro", 7),
        ).estado;
        return ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" }).estado;
      },
      retirado: "a",
      puntosFlor: [3, 0],
    },
    {
      nombre: "Flor del activo",
      crear: () => {
        const { estado, mano } = estadoConManos(
          [
            [c("espada", 1), c("basto", 7), c("oro", 3)],
            [c("copa", 1), c("copa", 3), c("copa", 6)],
          ],
          c("oro", 7),
        );
        const primera = ejecutarAccionCoordinada(estado, {
          tipo: "jugar-carta",
          jugador: "a",
          carta: mano.manos[0].cartas[0],
        });
        return ejecutarAccionCoordinada(primera.estado, { tipo: "anunciar-flor", jugador: "b" })
          .estado;
      },
      retirado: "a",
      puntosFlor: [0, 3],
    },
    {
      nombre: "Flores de ambos equipos",
      crear: () => {
        const estado = estadoConManos(
          [
            [c("copa", 1), c("copa", 3), c("copa", 6)],
            [c("espada", 1), c("espada", 3), c("espada", 6)],
          ],
          c("oro", 7),
        ).estado;
        const florA = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
        return ejecutarAccionCoordinada(florA.estado, { tipo: "anunciar-flor", jugador: "b" })
          .estado;
      },
      retirado: "a",
      puntosFlor: [3, 3],
    },
  ];

  for (const escenario of escenarios) {
    const mazo = ejecutarAccionCoordinada(escenario.crear(), {
      tipo: "irse-al-mazo",
      jugador: escenario.retirado,
    });
    assert.equal(mazo.aceptada, true, escenario.nombre);
    const adulterado = {
      ...mazo.estado,
      flor: {
        ...mazo.estado.flor,
        adjudicaciones: [{ equipo: "A", puntos: 3, motivo: "sin-desafio" }],
      },
    };
    const antesAdulterado = JSON.stringify(adulterado);
    assert.equal(
      ejecutarAccionCoordinada(adulterado, { tipo: "liquidar-puntos-mazo" }).aceptada,
      false,
      escenario.nombre,
    );
    assert.equal(JSON.stringify(adulterado), antesAdulterado, escenario.nombre);
    const liquidado = ejecutarAccionCoordinada(mazo.estado, { tipo: "liquidar-puntos-mazo" });
    assert.equal(liquidado.aceptada, true, escenario.nombre);
    assert.deepEqual(
      liquidado.estado.flor.adjudicaciones.map((adjudicacion) => adjudicacion.puntos),
      escenario.puntosFlor,
      escenario.nombre,
    );
    assert.deepEqual(liquidado.eventos, [
      { tipo: "flor-adjudicada", adjudicaciones: liquidado.estado.flor.adjudicaciones },
      {
        tipo: "mazo-adjudicado",
        jugadorRetirado: escenario.retirado,
        adjudicacion: { equipo: "B", puntos: 1, motivo: "mazo", nivel: null },
      },
    ]);
    const antesSegundoIntento = JSON.stringify(liquidado.estado);
    const segundoIntento = ejecutarAccionCoordinada(liquidado.estado, {
      tipo: "liquidar-puntos-mazo",
    });
    assert.equal(segundoIntento.aceptada, false, escenario.nombre);
    assert.equal(JSON.stringify(liquidado.estado), antesSegundoIntento, escenario.nombre);
  }
});

test("liquidación por mazo rechaza Envido resuelto adulterado", () => {
  const iniciado = ejecutarAccionCoordinada(baseGanadorA().estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const envido = ejecutarAccionCoordinada(iniciado.estado, { tipo: "quiero-envido", jugador: "b" });
  const mazo = ejecutarAccionCoordinada(envido.estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  }).estado;
  const adulterado = {
    ...mazo,
    envido: {
      ...mazo.envido,
      resueltos: [{ ...mazo.envido.resueltos[0], puntos: 999 }],
    },
  };
  const antes = JSON.stringify(adulterado);
  assert.equal(
    ejecutarAccionCoordinada(adulterado, { tipo: "liquidar-puntos-mazo" }).aceptada,
    false,
  );
  assert.equal(JSON.stringify(adulterado), antes);
});

test("liquidación de mano por mazo rechaza Flor, Envido y adjudicaciones adulteradas", () => {
  const conOportunidad = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  ).estado;
  const mazoConOportunidad = ejecutarAccionCoordinada(conOportunidad, {
    tipo: "irse-al-mazo",
    jugador: "a",
  }).estado;
  const antesOportunidad = JSON.stringify(mazoConOportunidad);
  assert.equal(
    ejecutarAccionCoordinada(mazoConOportunidad, { tipo: "liquidar-puntos-mazo" }).aceptada,
    false,
  );
  assert.equal(JSON.stringify(mazoConOportunidad), antesOportunidad);

  const mazo = ejecutarAccionCoordinada(baseSinFlor().estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  }).estado;
  const adulterado = {
    ...mazo,
    liquidacionMazo: {
      ...mazo.liquidacionMazo,
      puntos: "realizada",
    },
    adjudicacionTruco: {
      causa: "mano-por-mazo",
      equipo: "A",
      puntos: 4,
      nivelAceptado: "vale-cuatro",
    },
    ciclo: { fase: "liquidacion", equipoGanador: "B", causa: "mazo" },
  };
  const antesAdulterado = JSON.stringify(adulterado);
  assert.equal(
    ejecutarAccionCoordinada(adulterado, { tipo: "liquidar-puntos-mazo" }).aceptada,
    false,
  );
  assert.equal(JSON.stringify(adulterado), antesAdulterado);
});

test("liquidación por mazo conserva Flor ordinaria con Vale Cuatro aceptado", () => {
  const estado = estadoConManos(
    [
      [c("copa", 1), c("copa", 3), c("copa", 6)],
      [c("espada", 1), c("basto", 7), c("oro", 3)],
    ],
    c("oro", 7),
  ).estado;
  const flor = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const truco = ejecutarAccionCoordinada(flor.estado, { tipo: "proponer-truco", jugador: "a" });
  const quieroTruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "quiero-truco",
    jugador: "b",
  });
  const retruco = ejecutarAccionCoordinada(quieroTruco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const quieroRetruco = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "quiero-retruco",
    jugador: "a",
  });
  const vale = ejecutarAccionCoordinada(quieroRetruco.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  const quieroVale = ejecutarAccionCoordinada(vale.estado, {
    tipo: "quiero-vale-cuatro",
    jugador: "b",
  });
  assert.equal(quieroVale.aceptada, true);

  const mazo = ejecutarAccionCoordinada(quieroVale.estado, { tipo: "irse-al-mazo", jugador: "a" });
  const liquidado = ejecutarAccionCoordinada(mazo.estado, { tipo: "liquidar-puntos-mazo" });
  assert.equal(liquidado.aceptada, true);
  assert.deepEqual(liquidado.estado.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "sin-desafio" },
    { equipo: "B", puntos: 0, motivo: "sin-desafio" },
  ]);
  assert.deepEqual(liquidado.eventos, [
    { tipo: "flor-adjudicada", adjudicaciones: liquidado.estado.flor.adjudicaciones },
    {
      tipo: "mazo-adjudicado",
      jugadorRetirado: "a",
      adjudicacion: { equipo: "B", puntos: 4, motivo: "mazo", nivel: "vale-cuatro" },
    },
  ]);
  assert.equal(
    esCicloCoherenteConEstado(
      liquidado.estado.ciclo,
      liquidado.estado.juego,
      liquidado.estado.resultadoPartida,
      liquidado.estado.liquidacionMazo,
      liquidado.estado.flor,
      liquidado.estado.truco,
      liquidado.estado.envido,
      liquidado.estado.adjudicacionTruco,
    ),
    true,
  );
});

test("liquidación por mazo conserva Envido resuelto con Vale Cuatro aceptado", () => {
  const iniciado = ejecutarAccionCoordinada(baseGanadorA().estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const envido = ejecutarAccionCoordinada(iniciado.estado, { tipo: "quiero-envido", jugador: "b" });
  const resueltos = envido.estado.envido.resueltos;
  const truco = ejecutarAccionCoordinada(envido.estado, { tipo: "proponer-truco", jugador: "a" });
  const quieroTruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "quiero-truco",
    jugador: "b",
  });
  const retruco = ejecutarAccionCoordinada(quieroTruco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const quieroRetruco = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "quiero-retruco",
    jugador: "a",
  });
  const vale = ejecutarAccionCoordinada(quieroRetruco.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  const quieroVale = ejecutarAccionCoordinada(vale.estado, {
    tipo: "quiero-vale-cuatro",
    jugador: "b",
  });
  assert.equal(quieroVale.aceptada, true);

  const mazo = ejecutarAccionCoordinada(quieroVale.estado, { tipo: "irse-al-mazo", jugador: "a" });
  const liquidado = ejecutarAccionCoordinada(mazo.estado, { tipo: "liquidar-puntos-mazo" });
  assert.equal(liquidado.aceptada, true);
  assert.equal(liquidado.estado.envido.resueltos, resueltos);
  assert.equal(
    liquidado.eventos.some((evento) => evento.tipo.startsWith("envido-")),
    false,
  );
  assert.deepEqual(liquidado.eventos, [
    {
      tipo: "mazo-adjudicado",
      jugadorRetirado: "a",
      adjudicacion: { equipo: "B", puntos: 4, motivo: "mazo", nivel: "vale-cuatro" },
    },
  ]);
  const antesSegundoIntento = JSON.stringify(liquidado.estado);
  assert.equal(
    ejecutarAccionCoordinada(liquidado.estado, { tipo: "liquidar-puntos-mazo" }).aceptada,
    false,
  );
  assert.equal(JSON.stringify(liquidado.estado), antesSegundoIntento);
});

test("liquidar puntos por mazo no altera el estado competitivo", () => {
  const mazo = ejecutarAccionCoordinada(baseSinFlor().estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });
  const competitivo = {
    juego: JSON.parse(JSON.stringify(mazo.estado.juego)),
    turno: mazo.estado.juego.jugadorTurno,
    ganador: mazo.estado.juego.equipoGanador,
    finalizada: mazo.estado.juego.finalizada,
    motivo: mazo.estado.juego.motivoFinalizacion,
    envido: JSON.parse(JSON.stringify(mazo.estado.envido)),
    truco: JSON.parse(JSON.stringify(mazo.estado.truco)),
    resultadoPartida: mazo.estado.resultadoPartida,
    contextoInicio: JSON.parse(JSON.stringify(mazo.estado.contextoInicio)),
  };
  const liquidado = ejecutarAccionCoordinada(mazo.estado, { tipo: "liquidar-puntos-mazo" });
  assert.equal(liquidado.aceptada, true);
  assert.deepEqual(liquidado.estado.juego, competitivo.juego);
  assert.equal(liquidado.estado.juego.jugadorTurno, competitivo.turno);
  assert.equal(liquidado.estado.juego.equipoGanador, competitivo.ganador);
  assert.equal(liquidado.estado.juego.finalizada, competitivo.finalizada);
  assert.equal(liquidado.estado.juego.motivoFinalizacion, competitivo.motivo);
  assert.deepEqual(liquidado.estado.envido, competitivo.envido);
  assert.deepEqual(liquidado.estado.truco, competitivo.truco);
  assert.equal(liquidado.estado.resultadoPartida, competitivo.resultadoPartida);
  assert.deepEqual(liquidado.estado.contextoInicio, competitivo.contextoInicio);
});

function cerrarMazoLiquidado(estado) {
  const cierre = ejecutarAccionCoordinada(estado, { tipo: "cerrar-mano-mazo" });
  assert.equal(cierre.aceptada, true);
  assert.deepEqual(cierre.eventos, []);
  assert.deepEqual(cierre.estado.ciclo, {
    fase: "cierre-definitivo",
    equipoGanador: "B",
    causa: "mazo",
  });
  return cierre;
}

test("cierre definitivo por mazo preserva la liquidación simple, Flor y Envido", () => {
  const simple = ejecutarAccionCoordinada(
    ejecutarAccionCoordinada(baseSinFlor().estado, { tipo: "irse-al-mazo", jugador: "a" }).estado,
    { tipo: "liquidar-puntos-mazo" },
  );

  const conFlor = estadoConManos(
    [
      [c("copa", 1), c("copa", 3), c("copa", 6)],
      [c("espada", 1), c("basto", 7), c("oro", 3)],
    ],
    c("oro", 7),
  ).estado;
  const florAnunciada = ejecutarAccionCoordinada(conFlor, { tipo: "anunciar-flor", jugador: "a" });
  const flor = ejecutarAccionCoordinada(
    ejecutarAccionCoordinada(florAnunciada.estado, { tipo: "irse-al-mazo", jugador: "a" }).estado,
    { tipo: "liquidar-puntos-mazo" },
  );

  const conOportunidad = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  ).estado;
  const excepcionalPendiente = ejecutarAccionCoordinada(conOportunidad, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });
  const excepcionalAnunciada = ejecutarAccionCoordinada(excepcionalPendiente.estado, {
    tipo: "anunciar-flor",
    jugador: "b",
  });
  const excepcional = ejecutarAccionCoordinada(excepcionalAnunciada.estado, {
    tipo: "liquidar-puntos-mazo",
  });

  const envidoIniciado = ejecutarAccionCoordinada(baseGanadorA().estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const envidoResuelto = ejecutarAccionCoordinada(envidoIniciado.estado, {
    tipo: "quiero-envido",
    jugador: "b",
  });
  const envido = ejecutarAccionCoordinada(
    ejecutarAccionCoordinada(envidoResuelto.estado, { tipo: "irse-al-mazo", jugador: "a" }).estado,
    { tipo: "liquidar-puntos-mazo" },
  );

  for (const liquidado of [simple, flor, excepcional, envido]) {
    assert.equal(liquidado.aceptada, true);
    const antes = Object.fromEntries(
      Object.entries(liquidado.estado).filter(([campo]) => campo !== "ciclo"),
    );
    const cierre = cerrarMazoLiquidado(liquidado.estado);
    const despues = Object.fromEntries(
      Object.entries(cierre.estado).filter(([campo]) => campo !== "ciclo"),
    );
    assert.deepEqual(despues, antes);
  }
  assert.equal(excepcional.estado.liquidacionMazo.oportunidadFlor.estado, "consumida");
  assert.equal(envido.estado.envido.resueltos, envidoResuelto.estado.envido.resueltos);
});

test("cierre definitivo por mazo conserva Vale Cuatro y rechaza cierres inválidos", () => {
  const truco = ejecutarAccionCoordinada(baseSinFlor().estado, {
    tipo: "proponer-truco",
    jugador: "a",
  });
  const quieroTruco = ejecutarAccionCoordinada(truco.estado, {
    tipo: "quiero-truco",
    jugador: "b",
  });
  const retruco = ejecutarAccionCoordinada(quieroTruco.estado, {
    tipo: "proponer-retruco",
    jugador: "b",
  });
  const quieroRetruco = ejecutarAccionCoordinada(retruco.estado, {
    tipo: "quiero-retruco",
    jugador: "a",
  });
  const vale = ejecutarAccionCoordinada(quieroRetruco.estado, {
    tipo: "proponer-vale-cuatro",
    jugador: "a",
  });
  const quieroVale = ejecutarAccionCoordinada(vale.estado, {
    tipo: "quiero-vale-cuatro",
    jugador: "b",
  });
  const mazo = ejecutarAccionCoordinada(quieroVale.estado, { tipo: "irse-al-mazo", jugador: "a" });
  const antesLiquidar = JSON.stringify(mazo.estado);
  assert.equal(ejecutarAccionCoordinada(mazo.estado, { tipo: "cerrar-mano-mazo" }).aceptada, false);
  assert.equal(JSON.stringify(mazo.estado), antesLiquidar);

  const liquidado = ejecutarAccionCoordinada(mazo.estado, { tipo: "liquidar-puntos-mazo" });
  assert.equal(liquidado.estado.adjudicacionTruco.puntos, 4);
  const cierre = cerrarMazoLiquidado(liquidado.estado);
  const antesDuplicado = JSON.stringify(cierre.estado);
  assert.equal(
    ejecutarAccionCoordinada(cierre.estado, { tipo: "cerrar-mano-mazo" }).aceptada,
    false,
  );
  assert.equal(JSON.stringify(cierre.estado), antesDuplicado);

  const adulterado = {
    ...liquidado.estado,
    adjudicacionTruco: { ...liquidado.estado.adjudicacionTruco, puntos: 1 },
  };
  const antesAdulterado = JSON.stringify(adulterado);
  assert.equal(ejecutarAccionCoordinada(adulterado, { tipo: "cerrar-mano-mazo" }).aceptada, false);
  assert.equal(JSON.stringify(adulterado), antesAdulterado);
});

function crearCierreMazoConFlorExcepcional() {
  const estado = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  ).estado;
  const mazo = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "a" });
  const anuncio = ejecutarAccionCoordinada(mazo.estado, { tipo: "anunciar-flor", jugador: "b" });
  const liquidado = ejecutarAccionCoordinada(anuncio.estado, { tipo: "liquidar-puntos-mazo" });
  return cerrarMazoLiquidado(liquidado.estado).estado;
}

test("cierre definitivo por mazo rechaza toda AccionCoordinada sin mutar", () => {
  const cerrado = crearCierreMazoConFlorExcepcional();
  const carta = cerrado.juego.mano.manos.find((mano) => mano.jugador === "b").cartas[0];
  const acciones = [
    { tipo: "jugar-carta", jugador: "b", carta },
    { tipo: "anunciar-flor", jugador: "b" },
    { tipo: "proponer-contra-flor", jugador: "b" },
    { tipo: "proponer-contra-flor-al-resto", jugador: "b" },
    { tipo: "quiero-contra-flor", jugador: "a" },
    { tipo: "no-quiero-contra-flor", jugador: "a" },
    { tipo: "quiero-contra-flor-al-resto", jugador: "a" },
    { tipo: "no-quiero-contra-flor-al-resto", jugador: "a" },
    { tipo: "iniciar-envido", jugador: "b", canto: "envido" },
    { tipo: "aumentar-envido", jugador: "b", canto: "real-envido" },
    { tipo: "quiero-envido", jugador: "b" },
    { tipo: "no-quiero-envido", jugador: "b" },
    { tipo: "con-flor-quiero", jugador: "b" },
    { tipo: "vencer-oportunidad-flor", jugador: "b" },
    { tipo: "proponer-truco", jugador: "b" },
    { tipo: "quiero-truco", jugador: "b" },
    { tipo: "no-quiero-truco", jugador: "b" },
    { tipo: "proponer-retruco", jugador: "b" },
    { tipo: "quiero-retruco", jugador: "b" },
    { tipo: "no-quiero-retruco", jugador: "b" },
    { tipo: "proponer-vale-cuatro", jugador: "b" },
    { tipo: "quiero-vale-cuatro", jugador: "b" },
    { tipo: "no-quiero-vale-cuatro", jugador: "b" },
    { tipo: "irse-al-mazo", jugador: "b" },
    { tipo: "liquidar-puntos-mazo" },
    { tipo: "cerrar-mano-mazo" },
  ];
  for (const accion of acciones) {
    const antes = JSON.stringify(cerrado);
    const resultado = ejecutarAccionCoordinada(cerrado, accion);
    assert.equal(resultado.aceptada, false, accion.tipo);
    assert.equal("eventos" in resultado, false, accion.tipo);
    assert.equal(JSON.stringify(cerrado), antes, accion.tipo);
  }
});

test("coherencia rechaza cierres definitivos de mazo adulterados", () => {
  const cerrado = crearCierreMazoConFlorExcepcional();
  const coherente = (estado) =>
    esCicloCoherenteConEstado(
      estado.ciclo,
      estado.juego,
      estado.resultadoPartida,
      estado.liquidacionMazo,
      estado.flor,
      estado.truco,
      estado.envido,
      estado.adjudicacionTruco,
    );
  assert.equal(coherente(cerrado), true);
  const variantes = [
    {
      ...cerrado,
      liquidacionMazo: { ...cerrado.liquidacionMazo, puntos: "pendiente" },
      adjudicacionTruco: null,
    },
    {
      ...cerrado,
      adjudicacionTruco: null,
    },
    {
      ...cerrado,
      liquidacionMazo: {
        ...cerrado.liquidacionMazo,
        oportunidadFlor: { ...cerrado.liquidacionMazo.oportunidadFlor, estado: "pendiente" },
      },
    },
    { ...cerrado, flor: { ...cerrado.flor, cerrado: false, adjudicaciones: [] } },
    {
      ...cerrado,
      flor: {
        ...cerrado.flor,
        pendiente: {
          tipo: "contra-flor",
          proponente: "b",
          equipoProponente: "B",
          equipoRespondedor: "A",
        },
      },
    },
    { ...cerrado, envido: { ...cerrado.envido, pendiente: { proponente: "b" } } },
    { ...cerrado, truco: { ...cerrado.truco, propuestaPendiente: { nivel: "truco" } } },
    { ...cerrado, liquidacionMazo: { ...cerrado.liquidacionMazo, equipoGanador: "A" } },
  ];
  for (const adulterado of variantes) assert.equal(coherente(adulterado), false);
});

function congelarProfundamente(valor, vistos = new Set()) {
  if (!valor || typeof valor !== "object" || vistos.has(valor)) return valor;
  vistos.add(valor);
  for (const propiedad of Object.values(valor)) congelarProfundamente(propiedad, vistos);
  return Object.freeze(valor);
}

test("irse al mazo es determinista y no muta profundamente el estado de entrada", () => {
  const original = base().estado;
  const antes = JSON.parse(JSON.stringify(original));
  const accion = { tipo: "irse-al-mazo", jugador: "a" };
  const congelado = congelarProfundamente(JSON.parse(JSON.stringify(original)));
  const primera = ejecutarAccionCoordinada(congelado, accion);
  const segunda = ejecutarAccionCoordinada(JSON.parse(JSON.stringify(original)), accion);

  assert.equal(primera.aceptada, true);
  assert.deepEqual(primera, segunda);
  assert.deepEqual(original, antes);
  assert.equal(original.juego.finalizada, false);
  assert.equal(original.juego.jugadorTurno, "a");
  assert.equal(original.truco.apuestaActiva, null);
  assert.equal(original.envido.resueltos.length, 0);
  assert.equal(original.flor.adjudicaciones.length, 0);
});

test("retiro del respondedor liquida implÃ­citamente Truco, Retruco y Vale Cuatro", () => {
  const retirarRespondedor = (nivel) => {
    const inicial = baseSinFlor().estado;
    const truco = ejecutarAccionCoordinada(inicial, { tipo: "proponer-truco", jugador: "a" });
    if (nivel === "truco")
      return ejecutarAccionCoordinada(truco.estado, { tipo: "irse-al-mazo", jugador: "b" });
    const querido = ejecutarAccionCoordinada(truco.estado, { tipo: "quiero-truco", jugador: "b" });
    const retruco = ejecutarAccionCoordinada(querido.estado, {
      tipo: "proponer-retruco",
      jugador: "b",
    });
    if (nivel === "retruco")
      return ejecutarAccionCoordinada(retruco.estado, { tipo: "irse-al-mazo", jugador: "a" });
    const retrucoQuerido = ejecutarAccionCoordinada(retruco.estado, {
      tipo: "quiero-retruco",
      jugador: "a",
    });
    const vale = ejecutarAccionCoordinada(retrucoQuerido.estado, {
      tipo: "proponer-vale-cuatro",
      jugador: "a",
    });
    return ejecutarAccionCoordinada(vale.estado, { tipo: "irse-al-mazo", jugador: "b" });
  };
  const resultados = [
    retirarRespondedor("truco"),
    retirarRespondedor("retruco"),
    retirarRespondedor("vale-cuatro"),
  ];
  assert.deepEqual(
    resultados.map((resultado) => resultado.estado.adjudicacionTruco),
    [
      {
        causa: "rechazo-implicito-por-retiro",
        equipo: "A",
        puntos: 1,
        nivelPropuesto: "truco",
        propuestaOrden: 1,
        jugadorRetirado: "b",
      },
      {
        causa: "rechazo-implicito-por-retiro",
        equipo: "B",
        puntos: 2,
        nivelPropuesto: "retruco",
        propuestaOrden: 2,
        jugadorRetirado: "a",
      },
      {
        causa: "rechazo-implicito-por-retiro",
        equipo: "A",
        puntos: 3,
        nivelPropuesto: "vale-cuatro",
        propuestaOrden: 3,
        jugadorRetirado: "b",
      },
    ],
  );
  for (const resultado of resultados) {
    assert.equal(resultado.estado.liquidacionMazo, null);
    assert.equal(resultado.estado.juego.motivoFinalizacion, "rechazo-truco");
    assert.equal(resultado.estado.truco.propuestaPendiente, null);
    assert.equal(
      resultado.estado.truco.historialPropuestas.at(-1).respuesta,
      "rechazo-implicito-por-retiro",
    );
    assert.equal(
      resultado.estado.truco.historialPropuestas.at(-1).jugadorRetirado,
      resultado.estado.adjudicacionTruco.jugadorRetirado,
    );
    assert.equal(
      resultado.eventos.filter((evento) => evento.tipo === "truco-rechazo-implicito-por-retiro")
        .length,
      1,
    );
    assert.equal(
      resultado.eventos.some((evento) => evento.tipo === "mazo-adjudicado"),
      false,
    );
  }
});

test("rechazo implÃ­cito por retiro valida procedencia, preserva Envido y rechaza adulteraciones", () => {
  const inicial = baseSinFlor().estado;
  const envido = ejecutarAccionCoordinada(inicial, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const envidoResuelto = ejecutarAccionCoordinada(envido.estado, {
    tipo: "quiero-envido",
    jugador: "b",
  });
  const truco = ejecutarAccionCoordinada(envidoResuelto.estado, {
    tipo: "proponer-truco",
    jugador: "a",
  });
  const rechazo = ejecutarAccionCoordinada(truco.estado, { tipo: "irse-al-mazo", jugador: "b" });
  assert.equal(rechazo.aceptada, true);
  assert.equal(rechazo.estado.envido.resueltos, envidoResuelto.estado.envido.resueltos);
  for (const adjudicacionTruco of [
    { ...rechazo.estado.adjudicacionTruco, equipo: "B" },
    { ...rechazo.estado.adjudicacionTruco, puntos: 2 },
    { ...rechazo.estado.adjudicacionTruco, nivelPropuesto: "retruco" },
    { ...rechazo.estado.adjudicacionTruco, jugadorRetirado: "a" },
  ]) {
    assert.equal(
      ejecutarAccionCoordinada(
        { ...rechazo.estado, adjudicacionTruco },
        { tipo: "proponer-truco", jugador: "a" },
      ).rechazo.codigo,
      "estado-invalido",
    );
  }
  assert.equal(
    ejecutarAccionCoordinada(
      { ...rechazo.estado, adjudicacionTruco: null },
      { tipo: "proponer-truco", jugador: "a" },
    ).rechazo.codigo,
    "estado-invalido",
  );
  assert.equal(
    ejecutarAccionCoordinada(
      { ...rechazo.estado, truco: { ...rechazo.estado.truco, historialPropuestas: [] } },
      { tipo: "proponer-truco", jugador: "a" },
    ).rechazo.codigo,
    "estado-invalido",
  );
});

test("retiro del proponente cancela la propuesta y liquida el último nivel aceptado", () => {
  const cancelarPropuesta = (nivel) => {
    const inicial = baseSinFlor().estado;
    const truco = ejecutarAccionCoordinada(inicial, { tipo: "proponer-truco", jugador: "a" });
    if (nivel === "truco")
      return ejecutarAccionCoordinada(truco.estado, { tipo: "irse-al-mazo", jugador: "a" });
    const querido = ejecutarAccionCoordinada(truco.estado, { tipo: "quiero-truco", jugador: "b" });
    const retruco = ejecutarAccionCoordinada(querido.estado, {
      tipo: "proponer-retruco",
      jugador: "b",
    });
    if (nivel === "retruco")
      return ejecutarAccionCoordinada(retruco.estado, { tipo: "irse-al-mazo", jugador: "b" });
    const retrucoQuerido = ejecutarAccionCoordinada(retruco.estado, {
      tipo: "quiero-retruco",
      jugador: "a",
    });
    const vale = ejecutarAccionCoordinada(retrucoQuerido.estado, {
      tipo: "proponer-vale-cuatro",
      jugador: "a",
    });
    return ejecutarAccionCoordinada(vale.estado, { tipo: "irse-al-mazo", jugador: "a" });
  };
  const cancelaciones = [
    cancelarPropuesta("truco"),
    cancelarPropuesta("retruco"),
    cancelarPropuesta("vale-cuatro"),
  ];
  assert.deepEqual(
    cancelaciones.map((resultado) => resultado.estado.truco.historialPropuestas.at(-1).respuesta),
    ["cancelada-por-retiro", "cancelada-por-retiro", "cancelada-por-retiro"],
  );
  assert.deepEqual(
    cancelaciones.map((resultado) => resultado.estado.truco.apuestaActiva?.nivel ?? null),
    [null, "truco", "retruco"],
  );
  for (const resultado of cancelaciones) {
    assert.equal(resultado.estado.adjudicacionTruco, null);
    assert.equal(resultado.estado.liquidacionMazo.puntos, "pendiente");
    assert.equal(resultado.estado.juego.motivoFinalizacion, "mazo");
    assert.equal(
      resultado.eventos.some((evento) => evento.tipo === "truco-rechazo-implicito-por-retiro"),
      false,
    );
  }
  const liquidados = cancelaciones.map((resultado) =>
    ejecutarAccionCoordinada(resultado.estado, { tipo: "liquidar-puntos-mazo" }),
  );
  assert.deepEqual(
    liquidados.map((resultado) => resultado.estado.adjudicacionTruco),
    [
      { causa: "mano-por-mazo", equipo: "B", puntos: 1, nivelAceptado: null },
      { causa: "mano-por-mazo", equipo: "A", puntos: 2, nivelAceptado: "truco" },
      { causa: "mano-por-mazo", equipo: "B", puntos: 3, nivelAceptado: "retruco" },
    ],
  );
  const cierre = ejecutarAccionCoordinada(liquidados[2].estado, { tipo: "cerrar-mano-mazo" });
  assert.equal(cierre.aceptada, true);
  assert.equal(
    ejecutarAccionCoordinada(cierre.estado, { tipo: "proponer-truco", jugador: "a" }).rechazo
      .codigo,
    "mano-finalizada",
  );
});

test("retiro del proponente preserva Envido y habilita Flor excepcional sólo para el ganador", () => {
  const conEnvido = baseSinFlor().estado;
  const envido = ejecutarAccionCoordinada(conEnvido, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const envidoResuelto = ejecutarAccionCoordinada(envido.estado, {
    tipo: "quiero-envido",
    jugador: "b",
  });
  const truco = ejecutarAccionCoordinada(envidoResuelto.estado, {
    tipo: "proponer-truco",
    jugador: "a",
  });
  const mazo = ejecutarAccionCoordinada(truco.estado, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(mazo.estado.envido.resueltos, envidoResuelto.estado.envido.resueltos);
  assert.equal(mazo.estado.liquidacionMazo.oportunidadFlor, null);

  const conFlorGanadora = estadoConManos(
    [
      [c("espada", 1), c("basto", 7), c("oro", 3)],
      [c("copa", 4), c("copa", 5), c("copa", 6)],
    ],
    c("oro", 7),
  ).estado;
  const propuesta = ejecutarAccionCoordinada(conFlorGanadora, {
    tipo: "proponer-truco",
    jugador: "a",
  });
  const cancelada = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "irse-al-mazo",
    jugador: "a",
  });
  assert.deepEqual(cancelada.estado.liquidacionMazo.oportunidadFlor, {
    jugador: "b",
    estado: "pendiente",
    duracionMs: 10000,
  });
});

test("cancelación por retiro exige que el proponente histórico sea el retirado canónico", () => {
  const cancelar = (nivel) => {
    const truco = ejecutarAccionCoordinada(baseSinFlor().estado, {
      tipo: "proponer-truco",
      jugador: "a",
    });
    if (nivel === "truco")
      return ejecutarAccionCoordinada(truco.estado, { tipo: "irse-al-mazo", jugador: "a" });
    const querido = ejecutarAccionCoordinada(truco.estado, { tipo: "quiero-truco", jugador: "b" });
    const retruco = ejecutarAccionCoordinada(querido.estado, {
      tipo: "proponer-retruco",
      jugador: "b",
    });
    if (nivel === "retruco")
      return ejecutarAccionCoordinada(retruco.estado, { tipo: "irse-al-mazo", jugador: "b" });
    const retrucoQuerido = ejecutarAccionCoordinada(retruco.estado, {
      tipo: "quiero-retruco",
      jugador: "a",
    });
    const vale = ejecutarAccionCoordinada(retrucoQuerido.estado, {
      tipo: "proponer-vale-cuatro",
      jugador: "a",
    });
    return ejecutarAccionCoordinada(vale.estado, { tipo: "irse-al-mazo", jugador: "a" });
  };
  const pendientes = [cancelar("truco"), cancelar("retruco"), cancelar("vale-cuatro")];
  for (const pendiente of pendientes) {
    assert.equal(
      esCicloCoherenteConEstado(
        pendiente.estado.ciclo,
        pendiente.estado.juego,
        pendiente.estado.resultadoPartida,
        pendiente.estado.liquidacionMazo,
        pendiente.estado.flor,
        pendiente.estado.truco,
        pendiente.estado.envido,
        pendiente.estado.adjudicacionTruco,
      ),
      true,
    );
  }
  const pendiente = pendientes[0].estado;
  const liquidado = ejecutarAccionCoordinada(pendiente, { tipo: "liquidar-puntos-mazo" }).estado;
  const cerrado = ejecutarAccionCoordinada(liquidado, { tipo: "cerrar-mano-mazo" }).estado;
  const adulterarProponente = (estado) => {
    const historial = estado.truco.historialPropuestas;
    return {
      ...estado,
      truco: {
        ...estado.truco,
        historialPropuestas: [
          ...historial.slice(0, -1),
          { ...historial.at(-1), proponente: "b", equipoProponente: "B" },
        ],
      },
    };
  };
  assert.equal(
    ejecutarAccionCoordinada(adulterarProponente(pendiente), { tipo: "liquidar-puntos-mazo" })
      .rechazo.codigo,
    "estado-invalido",
  );
  assert.equal(
    ejecutarAccionCoordinada(adulterarProponente(liquidado), { tipo: "cerrar-mano-mazo" }).rechazo
      .codigo,
    "estado-invalido",
  );
  assert.equal(
    ejecutarAccionCoordinada(adulterarProponente(cerrado), { tipo: "proponer-truco", jugador: "a" })
      .rechazo.codigo,
    "estado-invalido",
  );
});

test("Flor ordinaria del proponente retirado se conserva al cancelar Truco pendiente", () => {
  const estado = estadoConManos(
    [
      [c("copa", 1), c("copa", 3), c("copa", 6)],
      [c("espada", 1), c("basto", 7), c("oro", 3)],
    ],
    c("oro", 7),
  ).estado;
  const flor = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  assert.equal(flor.aceptada, true);
  assert.equal(flor.estado.flor.pendiente, null);
  const propuesta = ejecutarAccionCoordinada(flor.estado, { tipo: "proponer-truco", jugador: "a" });
  const mazo = ejecutarAccionCoordinada(propuesta.estado, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(mazo.aceptada, true);
  assert.equal(mazo.estado.truco.historialPropuestas.at(-1).respuesta, "cancelada-por-retiro");
  assert.equal(mazo.estado.truco.historialPropuestas.at(-1).proponente, "a");
  assert.equal(mazo.estado.juego.retirados.includes("a"), true);
  assert.equal(mazo.estado.adjudicacionTruco, null);
  assert.equal(mazo.estado.liquidacionMazo.puntos, "pendiente");
  assert.equal(
    mazo.eventos.some((evento) => evento.tipo === "truco-rechazo-implicito-por-retiro"),
    false,
  );

  const liquidado = ejecutarAccionCoordinada(mazo.estado, { tipo: "liquidar-puntos-mazo" });
  assert.equal(liquidado.aceptada, true);
  assert.deepEqual(liquidado.estado.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "sin-desafio" },
    { equipo: "B", puntos: 0, motivo: "sin-desafio" },
  ]);
  assert.deepEqual(liquidado.estado.adjudicacionTruco, {
    causa: "mano-por-mazo",
    equipo: "B",
    puntos: 1,
    nivelAceptado: null,
  });
  assert.deepEqual(liquidado.eventos, [
    { tipo: "flor-adjudicada", adjudicaciones: liquidado.estado.flor.adjudicaciones },
    {
      tipo: "mazo-adjudicado",
      jugadorRetirado: "a",
      adjudicacion: { equipo: "B", puntos: 1, motivo: "mazo", nivel: null },
    },
  ]);
  assert.equal(liquidado.eventos.filter((evento) => evento.tipo === "flor-adjudicada").length, 1);
  assert.equal(liquidado.eventos.filter((evento) => evento.tipo === "mazo-adjudicado").length, 1);
  const cierre = ejecutarAccionCoordinada(liquidado.estado, { tipo: "cerrar-mano-mazo" });
  assert.equal(cierre.aceptada, true);
  assert.equal(
    ejecutarAccionCoordinada(cierre.estado, { tipo: "proponer-truco", jugador: "a" }).rechazo
      .codigo,
    "mano-finalizada",
  );
});
