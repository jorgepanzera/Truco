import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contabilizarManoCerrada,
  crearEstadoManoCoordinada,
  crearEstadoPartida,
  crearMazo,
  ejecutarAccionPartida,
  esEstadoPartidaValido,
  ejecutarAccionCoordinada,
  iniciarJuegoCartas,
  prepararMano,
  siguienteMano,
} from "../dist/index.js";

const c = (palo, valor) => ({ palo, valor });
const mesa = {
  modalidad: "1v1",
  jugadores: [
    { id: "a", equipo: "A", posicion: 0 },
    { id: "b", equipo: "B", posicion: 1 },
  ],
};
const identidad = (carta) => `${carta.palo}:${carta.valor}`;
const detalleRechazo = (resultado) => `${resultado.rechazo?.codigo}: ${resultado.rechazo?.mensaje}`;

function mazoConPrimeras(primeras) {
  return [
    ...primeras,
    ...crearMazo().filter(
      (carta) => !primeras.some((usada) => identidad(usada) === identidad(carta)),
    ),
  ];
}

function mazoSinFlor() {
  return mazoConPrimeras([
    c("espada", 1),
    c("copa", 4),
    c("basto", 3),
    c("basto", 4),
    c("oro", 2),
    c("espada", 5),
    c("basto", 7),
  ]);
}

function mazoConManos(repartidor, cartasA, cartasB, muestra) {
  const orden = repartidor === "b" ? [cartasA, cartasB] : [cartasB, cartasA];
  const primeras = [
    orden[0][0],
    orden[1][0],
    orden[0][1],
    orden[1][1],
    orden[0][2],
    orden[1][2],
    muestra,
  ];
  return mazoConPrimeras(primeras);
}

function accionPartidaValida(partida, accion) {
  const antes = JSON.stringify(partida);
  const resultado = ejecutarAccionPartida(partida, accion);
  assert.equal(resultado.aceptada, true, detalleRechazo(resultado));
  assert.equal(esEstadoPartidaValido(resultado.estado), true, `estado posterior a ${accion.tipo}`);
  assert.equal(JSON.stringify(partida), antes, `inmutabilidad de ${accion.tipo}`);
  return resultado.estado;
}

function contabilizarValida(partida) {
  const antes = JSON.stringify(partida);
  const resultado = contabilizarManoCerrada(partida);
  assert.equal(resultado.aceptada, true, detalleRechazo(resultado));
  assert.equal(esEstadoPartidaValido(resultado.estado), true, "estado posterior a contabilizar");
  assert.equal(JSON.stringify(partida), antes, "inmutabilidad de contabilizar");
  return resultado.estado;
}

function siguienteValida(partida, mazo) {
  const antes = JSON.stringify(partida);
  const resultado = siguienteMano(partida, mazo);
  assert.equal(resultado.aceptada, true, detalleRechazo(resultado));
  assert.equal(esEstadoPartidaValido(resultado.estado), true, "estado posterior a siguienteMano");
  assert.equal(JSON.stringify(partida), antes, "inmutabilidad de siguienteMano");
  return resultado.estado;
}

function iniciar({ metaPuntos = 40, puntajesIniciales = { A: 0, B: 0 } } = {}) {
  const reparto = [
    c("espada", 1),
    c("copa", 4),
    c("basto", 3),
    c("oro", 4),
    c("oro", 2),
    c("espada", 5),
  ];
  const muestra = c("basto", 7);
  const mano = prepararMano(mesa, "b", [
    ...reparto,
    muestra,
    ...crearMazo().filter(
      (carta) => ![...reparto, muestra].some((usada) => identidad(usada) === identidad(carta)),
    ),
  ]);
  return {
    mano,
    estado: crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
      metaPuntos,
      puntajesIniciales,
      esDesempate: false,
    }),
  };
}

function cerrarPorBazas(opciones) {
  const { mano, estado } = iniciar(opciones);
  const cartasA = mano.manos.find((item) => item.jugador === "a").cartas;
  const cartasB = mano.manos.find((item) => item.jugador === "b").cartas;
  let actual = estado;
  for (const [jugador, carta] of [
    ["a", cartasA[0]],
    ["b", cartasB[0]],
    ["a", cartasA[1]],
    ["b", cartasB[1]],
  ]) {
    const resultado = ejecutarAccionCoordinada(actual, { tipo: "jugar-carta", jugador, carta });
    assert.equal(resultado.aceptada, true);
    actual = resultado.estado;
  }
  assert.equal(actual.ciclo.fase, "cierre-definitivo");
  return actual;
}

function cerrarPorBazasConEnvido() {
  const { mano, estado } = iniciar();
  const envido = ejecutarAccionCoordinada(estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const aceptado = ejecutarAccionCoordinada(envido.estado, { tipo: "quiero-envido", jugador: "b" });
  const cartasA = mano.manos.find((item) => item.jugador === "a").cartas;
  const cartasB = mano.manos.find((item) => item.jugador === "b").cartas;
  let actual = aceptado.estado;
  for (const [jugador, carta] of [
    ["a", cartasA[0]],
    ["b", cartasB[0]],
    ["a", cartasA[1]],
    ["b", cartasB[1]],
  ]) {
    const resultado = ejecutarAccionCoordinada(actual, { tipo: "jugar-carta", jugador, carta });
    assert.equal(resultado.aceptada, true);
    actual = resultado.estado;
  }
  return actual;
}

test("partida 1v1 contabiliza una mano cerrada exactamente una vez", () => {
  const mano = cerrarPorBazas();
  const partida = crearEstadoPartida(mano);
  const antes = JSON.parse(JSON.stringify(partida));
  const aplicada = contabilizarManoCerrada(partida);
  assert.equal(aplicada.aceptada, true);
  assert.deepEqual(aplicada.estado.puntajes, { A: 1, B: 0 });
  assert.equal(aplicada.estado.fase, "mano-contabilizada");
  assert.deepEqual(partida, antes);
  assert.equal(contabilizarManoCerrada(aplicada.estado).aceptada, false);
  assert.equal(contabilizarManoCerrada(aplicada.estado).rechazo.codigo, "mano-ya-contabilizada");
});

test("partida rechaza manos abiertas y marcadores adulterados sin mutar", () => {
  const abierta = crearEstadoPartida(iniciar().estado);
  assert.equal(contabilizarManoCerrada(abierta).rechazo.codigo, "mano-no-cerrada");
  const cerrada = contabilizarManoCerrada(crearEstadoPartida(cerrarPorBazas())).estado;
  const adulterada = { ...cerrada, puntajes: { A: 99, B: 0 } };
  const antes = JSON.stringify(adulterada);
  assert.equal(contabilizarManoCerrada(adulterada).rechazo.codigo, "estado-partida-invalido");
  assert.equal(JSON.stringify(adulterada), antes);
});

test("partida aplica meta 30 y 40 al terminar la mano completa", () => {
  const a30 = contabilizarManoCerrada(
    crearEstadoPartida(cerrarPorBazas({ metaPuntos: 30, puntajesIniciales: { A: 29, B: 0 } })),
  );
  assert.equal(a30.estado.equipoGanador, "A");
  assert.equal(a30.estado.fase, "partida-finalizada");
  const a40 = contabilizarManoCerrada(
    crearEstadoPartida(cerrarPorBazas({ metaPuntos: 40, puntajesIniciales: { A: 39, B: 0 } })),
  );
  assert.equal(a40.estado.equipoGanador, "A");
  assert.equal(contabilizarManoCerrada(a40.estado).rechazo.codigo, "partida-finalizada");
});

test("partida incorpora una mano por mazo sólo tras su cierre definitivo", () => {
  const { estado } = iniciar();
  const mazo = ejecutarAccionCoordinada(estado, { tipo: "irse-al-mazo", jugador: "a" });
  const liquidada = ejecutarAccionCoordinada(mazo.estado, { tipo: "liquidar-puntos-mazo" });
  const cerrada = ejecutarAccionCoordinada(liquidada.estado, { tipo: "cerrar-mano-mazo" });
  const partida = contabilizarManoCerrada(crearEstadoPartida(cerrada.estado));
  assert.equal(partida.aceptada, true);
  assert.deepEqual(partida.estado.puntajes, { A: 0, B: 1 });
});

test("partida suma adjudicaciones independientes de Envido y Truco", () => {
  const mano = cerrarPorBazasConEnvido();
  const partida = contabilizarManoCerrada(crearEstadoPartida(mano));
  assert.equal(partida.aceptada, true);
  assert.deepEqual(partida.estado.puntajes, { A: 1, B: 2 });
});

function cerrarMazoDePartida(partida, jugador = "b") {
  const mazo = accionPartidaValida(partida, { tipo: "irse-al-mazo", jugador });
  const oportunidad = mazo.mano.liquidacionMazo?.oportunidadFlor;
  const trasOportunidad =
    oportunidad?.estado === "pendiente"
      ? accionPartidaValida(mazo, { tipo: "vencer-oportunidad-flor", jugador: oportunidad.jugador })
      : mazo;
  const liquidada = accionPartidaValida(trasOportunidad, { tipo: "liquidar-puntos-mazo" });
  return accionPartidaValida(liquidada, { tipo: "cerrar-mano-mazo" });
}

function aceptarValeCuatro(partida, conEnvido = false) {
  const primero = partida.mano.juego.mano.manoOriginal;
  const segundo = partida.mano.juego.mano.mesa.jugadores.find(
    (jugador) => jugador.id !== primero,
  ).id;
  let actual = partida;
  if (conEnvido) {
    actual = accionPartidaValida(actual, {
      tipo: "iniciar-envido",
      jugador: primero,
      canto: "envido",
    });
    actual = accionPartidaValida(actual, { tipo: "quiero-envido", jugador: segundo });
  }
  actual = accionPartidaValida(actual, { tipo: "proponer-truco", jugador: primero });
  actual = accionPartidaValida(actual, { tipo: "quiero-truco", jugador: segundo });
  actual = accionPartidaValida(actual, { tipo: "proponer-retruco", jugador: segundo });
  actual = accionPartidaValida(actual, { tipo: "quiero-retruco", jugador: primero });
  actual = accionPartidaValida(actual, { tipo: "proponer-vale-cuatro", jugador: primero });
  return accionPartidaValida(actual, { tipo: "quiero-vale-cuatro", jugador: segundo });
}

function resolverValeCuatroPorMazo(partida, jugadorRetirado, conEnvido = false) {
  return contabilizarValida(
    cerrarMazoDePartida(aceptarValeCuatro(partida, conEnvido), jugadorRetirado),
  );
}

test("siguiente mano rota repartidor, conserva marcador y exige contabilización", () => {
  const cerrada = cerrarMazoDePartida(crearEstadoPartida(iniciar().estado));
  assert.equal(siguienteMano(cerrada, crearMazo()).rechazo.codigo, "mano-no-contabilizada");
  const contabilizada = contabilizarManoCerrada(cerrada).estado;
  const antes = JSON.parse(JSON.stringify(contabilizada));
  const siguiente = siguienteMano(contabilizada, crearMazo());
  assert.equal(siguiente.aceptada, true);
  assert.equal(siguiente.estado.mano.juego.mano.repartidor, "a");
  assert.deepEqual(siguiente.estado.puntajes, { A: 1, B: 0 });
  assert.deepEqual(siguiente.estado.mano.contextoInicio.puntajesIniciales, { A: 1, B: 0 });
  assert.deepEqual(contabilizada, antes);
});

test("partida a 30 valida la primera mano contabilizada y permite rotar", () => {
  const cerrada = cerrarMazoDePartida(crearEstadoPartida(iniciar({ metaPuntos: 30 }).estado));
  const contabilizada = contabilizarManoCerrada(cerrada);
  assert.equal(contabilizada.aceptada, true);
  assert.equal(esEstadoPartidaValido(contabilizada.estado), true);
  const siguiente = siguienteMano(contabilizada.estado, crearMazo());
  assert.equal(siguiente.aceptada, true);
  assert.equal(siguiente.estado.mano.juego.mano.repartidor, "a");
  assert.deepEqual(siguiente.estado.puntajes, { A: 1, B: 0 });
});

test("dos y tres manos consecutivas conservan historial, marcador y rotación", () => {
  let partida = crearEstadoPartida(iniciar().estado);
  const repartidores = [];
  for (let indice = 0; indice < 3; indice++) {
    if (indice > 0) {
      const siguiente = siguienteMano(partida, crearMazo());
      assert.equal(siguiente.aceptada, true, siguiente.rechazo?.mensaje);
      partida = siguiente.estado;
      assert.equal(esEstadoPartidaValido(partida), true, `siguiente ${indice}`);
    }
    repartidores.push(partida.mano.juego.mano.repartidor);
    const cerrada = cerrarMazoDePartida(partida);
    assert.equal(esEstadoPartidaValido(cerrada), true, `entrada ${indice}`);
    const contabilizada = contabilizarManoCerrada(cerrada);
    assert.equal(contabilizada.aceptada, true, contabilizada.rechazo?.codigo);
    partida = contabilizada.estado;
  }
  assert.deepEqual(repartidores, ["b", "a", "b"]);
  assert.deepEqual(partida.puntajes, { A: 9, B: 0 });
  assert.equal(partida.manosContabilizadas.length, 3);
  const adulterada = {
    ...partida,
    manosContabilizadas: partida.manosContabilizadas.slice(1),
  };
  assert.equal(esEstadoPartidaValido(adulterada), false);
});

function completarPartidaPorValeCuatro(metaPuntos, conEnvidoInicial = false) {
  let partida = crearEstadoPartida(iniciar({ metaPuntos }).estado);
  while (partida.fase !== "partida-finalizada") {
    partida = resolverValeCuatroPorMazo(
      partida,
      "b",
      conEnvidoInicial && partida.ordinalMano === 1,
    );
    if (partida.fase !== "partida-finalizada") partida = siguienteValida(partida, mazoSinFlor());
  }
  return partida;
}

test("partidas públicas a 30 y 40 terminan por marcador y contabilizan Envido y Truco una sola vez", () => {
  const a30 = completarPartidaPorValeCuatro(30, true);
  assert.equal(a30.fase, "partida-finalizada");
  assert.equal(a30.equipoGanador, "A");
  assert.deepEqual(a30.puntajes, { A: 32, B: 2 });
  assert.equal(a30.manosContabilizadas.length, 8);
  assert.deepEqual(a30.manosContabilizadas[0].puntos, { A: 4, B: 2 });
  assert.equal(
    a30.manosContabilizadas.every((registro) => registro.mano.adjudicacionTruco?.puntos === 4),
    true,
  );
  assert.equal(
    ejecutarAccionPartida(a30, { tipo: "proponer-truco", jugador: "a" }).rechazo.codigo,
    "partida-finalizada",
  );
  assert.equal(siguienteMano(a30, mazoSinFlor()).rechazo.codigo, "partida-finalizada");

  const a40 = completarPartidaPorValeCuatro(40);
  assert.equal(a40.fase, "partida-finalizada");
  assert.equal(a40.equipoGanador, "A");
  assert.deepEqual(a40.puntajes, { A: 40, B: 0 });
  assert.equal(a40.manosContabilizadas.length, 10);
  assert.equal(esEstadoPartidaValido(a40), true);
});

test("empate en meta inicia desempate y la mano adicional determina el ganador", () => {
  let partida = crearEstadoPartida(iniciar({ metaPuntos: 30 }).estado);
  partida = contabilizarValida(cerrarMazoDePartida(partida, "b"));
  for (let indice = 0; indice < 14; indice++) {
    partida = siguienteValida(partida, mazoSinFlor());
    partida = resolverValeCuatroPorMazo(partida, indice % 2 === 0 ? "b" : "a");
  }
  assert.deepEqual(partida.puntajes, { A: 29, B: 28 });
  const repartidor = partida.mano.juego.mano.repartidor === "a" ? "b" : "a";
  partida = siguienteValida(
    partida,
    mazoConManos(
      repartidor,
      [c("copa", 3), c("copa", 4), c("copa", 5)],
      [c("espada", 1), c("espada", 2), c("espada", 3)],
      c("oro", 7),
    ),
  );
  const cartasA = partida.mano.juego.mano.manos.find((mano) => mano.jugador === "a").cartas;
  const cartasB = partida.mano.juego.mano.manos.find((mano) => mano.jugador === "b").cartas;
  const primero = partida.mano.juego.mano.manoOriginal;
  const segundo = primero === "a" ? "b" : "a";
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: primero });
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: segundo });
  const jugadas =
    primero === "a"
      ? [
          ["a", cartasA[2]],
          ["b", cartasB[0]],
          ["b", cartasB[2]],
          ["a", cartasA[1]],
        ]
      : [
          ["b", cartasB[0]],
          ["a", cartasA[2]],
          ["b", cartasB[2]],
          ["a", cartasA[1]],
        ];
  for (const [jugador, carta] of jugadas)
    partida = accionPartidaValida(partida, { tipo: "jugar-carta", jugador, carta });
  partida = contabilizarValida(partida);
  assert.equal(partida.fase, "mano-contabilizada");
  assert.equal(partida.equipoGanador, null);
  assert.equal(partida.desempatePendiente, true);
  assert.deepEqual(partida.puntajes, { A: 32, B: 32 });
  assert.deepEqual(partida.manosContabilizadas.at(-1).puntos, { A: 3, B: 4 });
  assert.deepEqual(partida.manosContabilizadas.at(-1).mano.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "sin-desafio" },
    { equipo: "B", puntos: 3, motivo: "sin-desafio" },
  ]);
  assert.deepEqual(partida.manosContabilizadas.at(-1).mano.adjudicacionTruco, {
    causa: "mano-por-bazas",
    equipo: "B",
    puntos: 1,
    nivelAceptado: null,
  });
  const desempate = siguienteValida(partida, mazoSinFlor());
  assert.equal(desempate.mano.contextoInicio.esDesempate, true);
  const finalizada = resolverValeCuatroPorMazo(desempate, "b");
  assert.equal(finalizada.fase, "partida-finalizada");
  assert.equal(finalizada.equipoGanador, "A");
  assert.equal(finalizada.desempatePendiente, false);
  assert.deepEqual(finalizada.puntajes, { A: 36, B: 32 });
});

test("Contra Flor al Resto aceptada finaliza la partida al contabilizar su mano", () => {
  const primeras = [
    c("copa", 3),
    c("espada", 3),
    c("copa", 6),
    c("espada", 6),
    c("copa", 7),
    c("espada", 7),
    c("oro", 2),
  ];
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(
      iniciarJuegoCartas(prepararMano(mesa, "b", mazoConPrimeras(primeras))),
      { metaPuntos: 40, puntajesIniciales: { A: 0, B: 0 }, esDesempate: false },
    ),
  );
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "a" });
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "b" });
  partida = accionPartidaValida(partida, { tipo: "proponer-contra-flor-al-resto", jugador: "a" });
  partida = accionPartidaValida(partida, { tipo: "quiero-contra-flor-al-resto", jugador: "b" });
  assert.deepEqual(partida.mano.resultadoPartida, {
    motivo: "contra-flor-al-resto",
    equipoGanador: "A",
  });
  assert.equal(partida.equipoGanador, null);
  assert.equal(partida.mano.ciclo.fase, "cierre-definitivo");
  const finalizada = contabilizarValida(partida);
  assert.equal(finalizada.fase, "partida-finalizada");
  assert.equal(finalizada.equipoGanador, "A");
  assert.equal(finalizada.manosContabilizadas.length, 1);
  assert.deepEqual(finalizada.manosContabilizadas[0].puntos, { A: 0, B: 0 });
  assert.equal(contabilizarManoCerrada(finalizada).rechazo.codigo, "partida-finalizada");
  assert.equal(
    ejecutarAccionPartida(finalizada, { tipo: "proponer-truco", jugador: "a" }).rechazo.codigo,
    "partida-finalizada",
  );
  assert.equal(siguienteMano(finalizada, mazoSinFlor()).rechazo.codigo, "partida-finalizada");
});

test("partida 2v2 se inicia como estructura válida sin exponer ejecución reglamentaria incompleta", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "c", equipo: "A", posicion: 2 },
      { id: "a", equipo: "A", posicion: 0 },
      { id: "d", equipo: "B", posicion: 3 },
      { id: "b", equipo: "B", posicion: 1 },
    ],
  };
  const mazo = crearMazo();
  const antesMesa = JSON.stringify(mesa2v2);
  const antesMazo = JSON.stringify(mazo);
  for (const metaPuntos of [30, 40]) {
    const mano = prepararMano(mesa2v2, "d", mazo);
    const partida = crearEstadoPartida(
      crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
        metaPuntos,
        puntajesIniciales: { A: 0, B: 0 },
        esDesempate: false,
      }),
    );
    assert.equal(esEstadoPartidaValido(partida), true);
    assert.equal(partida.fase, "estructura-2v2");
    assert.equal(partida.mesa.modalidad, "2v2");
    assert.deepEqual(
      partida.mano.juego.mano.mesa.jugadores.map((jugador) => jugador.id),
      ["a", "b", "c", "d"],
    );
    assert.deepEqual(partida.mano.juego.mano.equipos, ["A", "B"]);
    assert.equal(partida.mano.juego.mano.repartidor, "d");
    assert.equal(partida.mano.juego.mano.manoOriginal, "a");
    assert.equal(partida.mano.juego.mano.equipoManoOriginal, "A");
    assert.equal(partida.mano.juego.mano.entregas.length, 12);
    assert.equal(
      partida.mano.juego.mano.manos.every((item) => item.cartas.length === 3),
      true,
    );
    assert.equal(
      new Set(partida.mano.juego.mano.entregas.map((entrega) => identidad(entrega.carta))).size,
      12,
    );
    assert.equal(partida.mano.juego.mano.restantes.length, 27);
    assert.deepEqual(partida.puntajes, { A: 0, B: 0 });

    const accion = ejecutarAccionPartida(partida, { tipo: "proponer-truco", jugador: "a" });
    assert.equal(accion.aceptada, true, detalleRechazo(accion));
    assert.equal(accion.estado.mano.truco.propuestaPendiente.nivel, "truco");
    assert.equal(contabilizarManoCerrada(partida).rechazo.codigo, "mano-no-cerrada");
    assert.equal(siguienteMano(partida, mazo).rechazo.codigo, "mano-no-contabilizada");
    assert.equal(JSON.stringify(partida.mesa), JSON.stringify(partida.mano.juego.mano.mesa));
  }
  assert.equal(JSON.stringify(mesa2v2), antesMesa);
  assert.equal(JSON.stringify(mazo), antesMazo);
});

test("partida 2v2 habilita bazas por posiciones y bloquea desafios pendientes", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "c", equipo: "A", posicion: 2 },
      { id: "a", equipo: "A", posicion: 0 },
      { id: "d", equipo: "B", posicion: 3 },
      { id: "b", equipo: "B", posicion: 1 },
    ],
  };
  const reparto = [
    c("oro", 12),
    c("espada", 1),
    c("espada", 7),
    c("oro", 3),
    c("copa", 6),
    c("basto", 4),
    c("copa", 4),
    c("espada", 4),
    c("basto", 3),
    c("copa", 5),
    c("basto", 5),
    c("basto", 7),
  ];
  const muestra = c("oro", 2);
  const mano = prepararMano(mesa2v2, "d", mazoConPrimeras([...reparto, muestra]));
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
      metaPuntos: 40,
      puntajesIniciales: { A: 0, B: 0 },
      esDesempate: false,
    }),
  );
  const carta = (jugador, indice) =>
    partida.mano.juego.cartasDisponibles.find((manoJugador) => manoJugador.jugador === jugador)
      .cartas[indice];
  const antes = JSON.stringify(partida);
  assert.equal(
    ejecutarAccionPartida(partida, { tipo: "jugar-carta", jugador: "d", carta: carta("d", 0) })
      .rechazo.codigo,
    "fuera-de-turno",
  );
  assert.equal(JSON.stringify(partida), antes);
  assert.equal(
    ejecutarAccionPartida(partida, { tipo: "jugar-carta", jugador: "a", carta: carta("b", 0) })
      .rechazo.codigo,
    "carta-no-disponible",
  );
  assert.equal(JSON.stringify(partida), antes);

  for (const jugador of ["a", "b", "c", "d"]) {
    const resultado = ejecutarAccionPartida(partida, {
      tipo: "jugar-carta",
      jugador,
      carta: carta(jugador, 0),
    });
    assert.equal(resultado.aceptada, true, detalleRechazo(resultado));
    partida = resultado.estado;
    assert.equal(esEstadoPartidaValido(partida), true);
  }
  assert.equal(partida.fase, "mano-activa-2v2");
  assert.equal(partida.mano.juego.bazasCompletadas.length, 1);
  assert.equal(partida.mano.juego.bazasCompletadas[0].resultado.equipoGanador, "A");
  assert.deepEqual(partida.mano.juego.bazasCompletadas[0].resultado.jugadoresMaximos, ["a"]);
  assert.equal(partida.mano.juego.jugadorTurno, "a");

  for (const jugador of ["a", "b", "c", "d"]) {
    const resultado = ejecutarAccionPartida(partida, {
      tipo: "jugar-carta",
      jugador,
      carta: carta(jugador, 0),
    });
    assert.equal(resultado.aceptada, true, detalleRechazo(resultado));
    partida = resultado.estado;
  }
  assert.equal(partida.mano.juego.finalizada, true);
  assert.equal(partida.mano.juego.equipoGanador, "A");
  assert.equal(partida.mano.ciclo.fase, "cierre-definitivo");
  assert.equal(
    ejecutarAccionPartida(partida, { tipo: "jugar-carta", jugador: "a", carta: carta("a", 0) })
      .rechazo.codigo,
    "mano-finalizada",
  );
  assert.equal(
    ejecutarAccionPartida(partida, { tipo: "iniciar-envido", jugador: "a", canto: "envido" })
      .rechazo.codigo,
    "mano-finalizada",
  );
  const contabilizada = contabilizarValida(partida);
  assert.deepEqual(contabilizada.puntajes, { A: 1, B: 0 });
  const siguiente = siguienteValida(contabilizada, mazoConPrimeras([...reparto, muestra]));
  assert.equal(siguiente.fase, "mano-activa-2v2");
  assert.equal(siguiente.mano.juego.mano.repartidor, "a");
  assert.equal(siguiente.mano.juego.mano.manoOriginal, "b");
});

test("partida pública 2v2 coordina Envido y escalera completa de Truco por equipos", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "a", equipo: "A", posicion: 0 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "d", equipo: "B", posicion: 3 },
    ],
  };
  const reparto = [
    c("oro", 12),
    c("espada", 1),
    c("espada", 7),
    c("oro", 3),
    c("copa", 6),
    c("basto", 4),
    c("copa", 4),
    c("espada", 4),
    c("basto", 3),
    c("copa", 5),
    c("basto", 5),
    c("basto", 7),
  ];
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(
      iniciarJuegoCartas(prepararMano(mesa2v2, "d", mazoConPrimeras([...reparto, c("oro", 2)]))),
      { metaPuntos: 40, puntajesIniciales: { A: 0, B: 0 }, esDesempate: false },
    ),
  );
  partida = accionPartidaValida(partida, { tipo: "iniciar-envido", jugador: "a", canto: "envido" });
  partida = accionPartidaValida(partida, {
    tipo: "aumentar-envido",
    jugador: "b",
    canto: "real-envido",
  });
  partida = accionPartidaValida(partida, { tipo: "quiero-envido", jugador: "c" });
  assert.equal(partida.mano.envido.resueltos.length, 1);

  partida = accionPartidaValida(partida, { tipo: "proponer-truco", jugador: "a" });
  partida = accionPartidaValida(partida, { tipo: "quiero-truco", jugador: "b" });
  partida = accionPartidaValida(partida, { tipo: "proponer-retruco", jugador: "b" });
  partida = accionPartidaValida(partida, { tipo: "quiero-retruco", jugador: "c" });
  partida = accionPartidaValida(partida, { tipo: "proponer-vale-cuatro", jugador: "a" });
  partida = accionPartidaValida(partida, { tipo: "no-quiero-vale-cuatro", jugador: "d" });
  assert.deepEqual(partida.mano.adjudicacionTruco, {
    causa: "rechazo-voluntario",
    equipo: "A",
    puntos: 3,
    nivelPropuesto: "vale-cuatro",
    propuestaOrden: 3,
    respondedor: "d",
  });
});

test("partida pública 2v2 conserva los desafíos con compañero retirado y bloquea al retirado", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "a", equipo: "A", posicion: 0 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "d", equipo: "B", posicion: 3 },
    ],
  };
  const reparto = [
    c("oro", 12),
    c("espada", 1),
    c("espada", 7),
    c("oro", 3),
    c("copa", 6),
    c("basto", 4),
    c("copa", 4),
    c("espada", 4),
    c("basto", 3),
    c("copa", 5),
    c("basto", 5),
    c("basto", 7),
  ];
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(
      iniciarJuegoCartas(prepararMano(mesa2v2, "d", mazoConPrimeras([...reparto, c("oro", 2)]))),
      { metaPuntos: 40, puntajesIniciales: { A: 0, B: 0 }, esDesempate: false },
    ),
  );
  partida = accionPartidaValida(partida, { tipo: "iniciar-envido", jugador: "a", canto: "envido" });
  partida = accionPartidaValida(partida, { tipo: "irse-al-mazo", jugador: "c" });
  assert.equal(
    ejecutarAccionPartida(partida, { tipo: "aumentar-envido", jugador: "c", canto: "real-envido" })
      .rechazo.codigo,
    "jugador-inactivo",
  );
  partida = accionPartidaValida(partida, { tipo: "quiero-envido", jugador: "b" });
  partida = accionPartidaValida(partida, { tipo: "proponer-truco", jugador: "a" });
  partida = accionPartidaValida(partida, { tipo: "quiero-truco", jugador: "d" });
  assert.equal(partida.mano.juego.retirados.includes("c"), true);
});

test("partida pública 2v2 resuelve Flor, Contra Flor y Contra Flor al Resto", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "a", equipo: "A", posicion: 0 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "d", equipo: "B", posicion: 3 },
    ],
  };
  const reparto = [
    c("copa", 1),
    c("espada", 1),
    c("oro", 12),
    c("oro", 3),
    c("copa", 2),
    c("espada", 2),
    c("espada", 7),
    c("basto", 7),
    c("copa", 3),
    c("espada", 3),
    c("basto", 3),
    c("copa", 5),
  ];
  const crear = () =>
    crearEstadoPartida(
      crearEstadoManoCoordinada(
        iniciarJuegoCartas(prepararMano(mesa2v2, "d", mazoConPrimeras([...reparto, c("oro", 4)]))),
        { metaPuntos: 40, puntajesIniciales: { A: 0, B: 0 }, esDesempate: false },
      ),
    );
  let partida = crear();
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "a" });
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "b" });
  partida = accionPartidaValida(partida, { tipo: "proponer-contra-flor", jugador: "a" });
  partida = accionPartidaValida(partida, { tipo: "quiero-contra-flor", jugador: "b" });
  assert.deepEqual(
    partida.mano.flor.adjudicaciones.map((adjudicacion) => adjudicacion.puntos),
    [3, 0],
  );

  partida = crear();
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "a" });
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "b" });
  partida = accionPartidaValida(partida, {
    tipo: "proponer-contra-flor-al-resto",
    jugador: "a",
  });
  partida = accionPartidaValida(partida, { tipo: "quiero-contra-flor-al-resto", jugador: "b" });
  assert.deepEqual(partida.mano.resultadoPartida, {
    motivo: "contra-flor-al-resto",
    equipoGanador: "A",
  });
  assert.equal(partida.mano.ciclo.fase, "cierre-definitivo");
  assert.equal(contabilizarManoCerrada(partida).aceptada, true);
});

test("partida 2v2 liquida Envido pendiente al retirarse el último equipo proponente", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "a", equipo: "A", posicion: 0 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "d", equipo: "B", posicion: 3 },
    ],
  };
  const reparto = [
    c("oro", 12),
    c("espada", 1),
    c("espada", 7),
    c("oro", 3),
    c("copa", 6),
    c("basto", 4),
    c("copa", 4),
    c("espada", 4),
    c("basto", 3),
    c("copa", 5),
    c("basto", 5),
    c("basto", 7),
  ];
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(
      iniciarJuegoCartas(prepararMano(mesa2v2, "d", mazoConPrimeras([...reparto, c("oro", 2)]))),
      {
        metaPuntos: 40,
        puntajesIniciales: { A: 0, B: 0 },
        esDesempate: false,
      },
    ),
  );
  partida = accionPartidaValida(partida, { tipo: "irse-al-mazo", jugador: "c" });
  partida = accionPartidaValida(partida, { tipo: "iniciar-envido", jugador: "a", canto: "envido" });
  partida = accionPartidaValida(partida, { tipo: "irse-al-mazo", jugador: "a" });
  assert.equal(partida.mano.juego.finalizada, true);
  assert.equal(partida.mano.envido.liquidacionPorRetiro.causa, "propuesta-cancelada-por-retiro");
  assert.equal(partida.mano.ciclo.fase, "liquidacion");
});

test("partida 2v2 convierte en No quiero el retiro del último respondedor de Truco", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "a", equipo: "A", posicion: 0 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "d", equipo: "B", posicion: 3 },
    ],
  };
  const reparto = [
    c("oro", 12),
    c("espada", 1),
    c("espada", 7),
    c("oro", 3),
    c("copa", 6),
    c("basto", 4),
    c("copa", 4),
    c("espada", 4),
    c("basto", 3),
    c("copa", 5),
    c("basto", 5),
    c("basto", 7),
  ];
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(
      iniciarJuegoCartas(prepararMano(mesa2v2, "d", mazoConPrimeras([...reparto, c("oro", 2)]))),
      { metaPuntos: 40, puntajesIniciales: { A: 0, B: 0 }, esDesempate: false },
    ),
  );
  partida = accionPartidaValida(partida, { tipo: "irse-al-mazo", jugador: "c" });
  const cartaA = partida.mano.juego.cartasDisponibles.find((mano) => mano.jugador === "a")
    .cartas[0];
  partida = accionPartidaValida(partida, { tipo: "jugar-carta", jugador: "a", carta: cartaA });
  partida = accionPartidaValida(partida, { tipo: "proponer-truco", jugador: "b" });
  partida = accionPartidaValida(partida, { tipo: "irse-al-mazo", jugador: "a" });
  assert.deepEqual(partida.mano.adjudicacionTruco, {
    causa: "rechazo-implicito-por-retiro",
    equipo: "B",
    puntos: 1,
    nivelPropuesto: "truco",
    propuestaOrden: 1,
    jugadorRetirado: "a",
  });
  assert.equal(partida.mano.ciclo.fase, "liquidacion");
});

test("partida 2v2 conserva y ordena las oportunidades de Flor tras abandono completo", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "a", equipo: "A", posicion: 0 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "d", equipo: "B", posicion: 3 },
    ],
  };
  const reparto = [
    c("copa", 1),
    c("oro", 12),
    c("espada", 1),
    c("oro", 3),
    c("copa", 2),
    c("basto", 4),
    c("espada", 2),
    c("copa", 4),
    c("copa", 3),
    c("basto", 5),
    c("espada", 3),
    c("basto", 7),
  ];
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(
      iniciarJuegoCartas(prepararMano(mesa2v2, "d", mazoConPrimeras([...reparto, c("oro", 2)]))),
      { metaPuntos: 40, puntajesIniciales: { A: 0, B: 0 }, esDesempate: false },
    ),
  );
  partida = accionPartidaValida(partida, { tipo: "irse-al-mazo", jugador: "b" });
  partida = accionPartidaValida(partida, { tipo: "irse-al-mazo", jugador: "d" });
  assert.deepEqual(
    partida.mano.liquidacionMazo.oportunidadesFlor.map((oportunidad) => oportunidad.jugador),
    ["a", "c"],
  );
  assert.deepEqual(partida.mano.adjudicacionTruco, {
    causa: "mano-por-mazo",
    equipo: "A",
    puntos: 1,
    nivelAceptado: null,
  });
  assert.equal(
    ejecutarAccionPartida(partida, { tipo: "anunciar-flor", jugador: "c" }).aceptada,
    false,
  );
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "a" });
  partida = accionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "c" });
  assert.deepEqual(
    partida.mano.liquidacionMazo.oportunidadesFlor.map((oportunidad) => oportunidad.estado),
    ["consumida", "consumida"],
  );
  assert.equal(
    ejecutarAccionPartida(partida, { tipo: "proponer-truco", jugador: "a" }).rechazo.codigo,
    "mano-finalizada",
  );
  assert.equal(
    ejecutarAccionPartida(partida, { tipo: "vencer-oportunidad-flor", jugador: "a" }).rechazo
      .codigo,
    "mano-finalizada",
  );
  partida = accionPartidaValida(partida, { tipo: "cerrar-mano-mazo" });
  const contabilizada = contabilizarValida(partida);
  assert.deepEqual(contabilizada.puntajes, { A: 7, B: 0 });
  const siguiente = siguienteValida(contabilizada, mazoConPrimeras([...reparto, c("oro", 2)]));
  assert.equal(siguiente.fase, "mano-activa-2v2");
  assert.equal(siguiente.ordinalMano, 2);
  assert.equal(siguiente.mano.juego.mano.repartidor, "a");
  assert.equal(siguiente.mano.juego.mano.manoOriginal, "b");
  assert.deepEqual(siguiente.mano.juego.retirados, []);
});

test("partida 2v2 conserva al mano original como salida despues de una parda", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "d", equipo: "B", posicion: 3 },
      { id: "b", equipo: "B", posicion: 1 },
      { id: "c", equipo: "A", posicion: 2 },
      { id: "a", equipo: "A", posicion: 0 },
    ],
  };
  const reparto = [
    c("espada", 3),
    c("copa", 3),
    c("espada", 4),
    c("basto", 4),
    c("copa", 6),
    c("oro", 5),
    c("basto", 5),
    c("espada", 6),
    c("oro", 6),
    c("basto", 6),
    c("copa", 7),
    c("espada", 5),
  ];
  const mano = prepararMano(mesa2v2, "d", mazoConPrimeras([...reparto, c("oro", 2)]));
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
      metaPuntos: 30,
      puntajesIniciales: { A: 0, B: 0 },
      esDesempate: false,
    }),
  );
  for (const jugador of ["a", "b", "c", "d"]) {
    const carta = partida.mano.juego.cartasDisponibles.find(
      (manoJugador) => manoJugador.jugador === jugador,
    ).cartas[0];
    const resultado = ejecutarAccionPartida(partida, { tipo: "jugar-carta", jugador, carta });
    assert.equal(resultado.aceptada, true, detalleRechazo(resultado));
    partida = resultado.estado;
  }
  assert.equal(partida.mano.juego.bazasCompletadas[0].resultado.equipoGanador, null);
  assert.equal(partida.mano.juego.bazasCompletadas[0].resultado.salidaSiguiente, "a");
  assert.equal(partida.mano.juego.jugadorTurno, "a");
});

test("partida 2v2 expone retiro individual sin cerrar la mano prematuramente", () => {
  const mesa2v2 = {
    modalidad: "2v2",
    jugadores: [
      { id: "c", equipo: "A", posicion: 2 },
      { id: "a", equipo: "A", posicion: 0 },
      { id: "d", equipo: "B", posicion: 3 },
      { id: "b", equipo: "B", posicion: 1 },
    ],
  };
  const mano = prepararMano(mesa2v2, "d", crearMazo());
  let partida = crearEstadoPartida(
    crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
      metaPuntos: 40,
      puntajesIniciales: { A: 0, B: 0 },
      esDesempate: false,
    }),
  );
  const antes = JSON.stringify(partida);
  const retiro = ejecutarAccionPartida(partida, { tipo: "irse-al-mazo", jugador: "b" });
  assert.equal(retiro.aceptada, true, detalleRechazo(retiro));
  partida = retiro.estado;
  assert.equal(JSON.stringify(retiro.estado.mano.juego.retirados), '["b"]');
  assert.equal(partida.mano.juego.jugadorTurno, "a");
  assert.equal(
    JSON.stringify(
      crearEstadoPartida(
        crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
          metaPuntos: 40,
          puntajesIniciales: { A: 0, B: 0 },
          esDesempate: false,
        }),
      ),
    ),
    antes,
  );
  const cartaA = partida.mano.juego.cartasDisponibles.find((item) => item.jugador === "a")
    .cartas[0];
  const carta = ejecutarAccionPartida(partida, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: cartaA,
  });
  assert.equal(carta.aceptada, true, detalleRechazo(carta));
  partida = carta.estado;
  assert.equal(partida.mano.juego.jugadorTurno, "c");
  assert.equal(
    ejecutarAccionPartida(partida, { tipo: "irse-al-mazo", jugador: "b" }).rechazo.codigo,
    "jugador-retirado",
  );
  const terminal = ejecutarAccionPartida(partida, { tipo: "irse-al-mazo", jugador: "d" });
  assert.equal(terminal.aceptada, true, detalleRechazo(terminal));
  assert.equal(terminal.estado.mano.juego.equipoGanador, "A");
  assert.equal(terminal.estado.mano.ciclo.fase, "liquidacion");
  assert.equal(terminal.estado.mano.ciclo.causa, "mazo");
});
