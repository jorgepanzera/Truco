import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crearEstadoTruco,
  esEstadoTrucoValido,
  proponerRetruco,
  proponerTruco,
  proponerValeCuatro,
  responderNoQuieroRetruco,
  responderNoQuieroTruco,
  responderNoQuieroValeCuatro,
  responderQuieroRetruco,
  responderQuieroTruco,
  responderQuieroValeCuatro,
  liquidarTrucoPorRetiro,
} from "../dist/index.js";

const contexto = (cambios = {}) => ({
  jugadores: [
    { id: "a", equipo: "A" },
    { id: "b", equipo: "B" },
  ],
  jugadorTurno: "a",
  manoFinalizada: false,
  florPendiente: false,
  envidoPendiente: false,
  ...cambios,
});

const propuestaHistorica = (
  orden,
  nivel,
  proponente,
  equipoProponente,
  nivelAceptadoAnterior,
  respuesta,
  respondedor,
) => ({
  orden,
  nivel,
  proponente,
  equipoProponente,
  nivelAceptadoAnterior,
  respuesta,
  ...(respondedor ? { respondedor } : {}),
});

test("inicializa Truco sin propuesta ni apuesta activa", () => {
  const estado = crearEstadoTruco();
  assert.deepEqual(estado, { apuestaActiva: null, propuestaPendiente: null, historialPropuestas: [] });
  assert.equal(esEstadoTrucoValido(estado), true);
});

test("la inicialización de Truco es determinista", () => {
  assert.deepEqual(crearEstadoTruco(), crearEstadoTruco());
  assert.notEqual(crearEstadoTruco(), crearEstadoTruco());
});

test("la inicialización no muta resultados previos", () => {
  const anterior = crearEstadoTruco();
  const copia = { ...anterior };
  const siguiente = crearEstadoTruco();
  assert.deepEqual(anterior, copia);
  assert.deepEqual(siguiente, copia);
});

test("propone Truco inicial en turno y emite un evento semántico", () => {
  const estado = crearEstadoTruco();
  const r = proponerTruco(estado, contexto(), "a");
  assert.equal(r.aceptada, true);
  assert.deepEqual(r.estado.propuestaPendiente, { nivel: "truco", proponente: "a" });
  assert.deepEqual(r.eventos, [
    {
      tipo: "truco-propuesto",
      propuesta: { nivel: "truco", proponente: "a" },
      equipoProponente: "A",
    },
  ]);
  assert.deepEqual(estado, crearEstadoTruco());
  assert.equal(esEstadoTrucoValido(r.estado, contexto()), true);
});

test("rechaza proponentes inexistentes o fuera de turno", () => {
  assert.equal(
    proponerTruco(crearEstadoTruco(), contexto(), "nadie").codigo,
    "jugador-inexistente",
  );
  assert.equal(proponerTruco(crearEstadoTruco(), contexto(), "b").codigo, "fuera-de-turno");
});

test("rechaza Truco cuando la mano ya terminó o no hay turno de carta", () => {
  assert.equal(
    proponerTruco(crearEstadoTruco(), contexto({ manoFinalizada: true }), "a").codigo,
    "mano-finalizada",
  );
  assert.equal(
    proponerTruco(crearEstadoTruco(), contexto({ jugadorTurno: null }), "a").codigo,
    "fuera-de-turno",
  );
});

test("Flor y Envido pendientes bloquean la propuesta de Truco", () => {
  assert.equal(
    proponerTruco(crearEstadoTruco(), contexto({ florPendiente: true }), "a").codigo,
    "flor-pendiente",
  );
  assert.equal(
    proponerTruco(crearEstadoTruco(), contexto({ envidoPendiente: true }), "a").codigo,
    "envido-pendiente",
  );
});

test("rechaza una propuesta duplicada y conserva estado y contexto", () => {
  const base = crearEstadoTruco();
  const x = contexto();
  const primera = proponerTruco(base, x, "a");
  const estadoAntes = JSON.stringify(primera.estado);
  const contextoAntes = JSON.stringify(x);
  const r = proponerTruco(primera.estado, x, "a");
  assert.equal(r.aceptada, false);
  assert.equal(r.codigo, "propuesta-pendiente");
  assert.equal(JSON.stringify(primera.estado), estadoAntes);
  assert.equal(JSON.stringify(x), contextoAntes);
});

function propuestaPendiente() {
  const r = proponerTruco(crearEstadoTruco(), contexto(), "a");
  assert.equal(r.aceptada, true);
  return r.estado;
}

test("el equipo receptor puede querer Truco fuera de turno", () => {
  const pendiente = propuestaPendiente();
  const r = responderQuieroTruco(pendiente, contexto(), "b");
  assert.equal(r.aceptada, true);
  assert.deepEqual(r.estado, {
    apuestaActiva: { nivel: "truco", equipoAceptante: "B" },
    propuestaPendiente: null,
    historialPropuestas: [propuestaHistorica(1, "truco", "a", "A", null, "quiero")],
  });
  assert.deepEqual(r.eventos, [
    {
      tipo: "truco-aceptado",
      propuesta: { nivel: "truco", proponente: "a" },
      respondedor: "b",
      equipoRespondedor: "B",
    },
  ]);
  assert.equal(esEstadoTrucoValido(r.estado, contexto()), true);
  assert.deepEqual(pendiente, {
    apuestaActiva: null,
    propuestaPendiente: { nivel: "truco", proponente: "a" },
    historialPropuestas: [propuestaHistorica(1, "truco", "a", "A", null, null)],
  });
});

test("No quiero adjudica un punto al proponente y resuelve semánticamente la mano", () => {
  const r = responderNoQuieroTruco(propuestaPendiente(), contexto(), "b");
  assert.equal(r.aceptada, true);
  assert.deepEqual(r.estado, {
    apuestaActiva: null,
    propuestaPendiente: null,
    historialPropuestas: [propuestaHistorica(1, "truco", "a", "A", null, "no-quiero", "b")],
  });
  assert.deepEqual(r.eventos, [
    {
      tipo: "truco-rechazado",
      propuesta: { nivel: "truco", proponente: "a" },
      respondedor: "b",
      adjudicacion: { equipo: "A", puntos: 1, motivo: "rechazo" },
      manoFinalizada: true,
    },
  ]);
});

test("una respuesta ya resuelta no puede responderse de nuevo", () => {
  const querida = responderQuieroTruco(propuestaPendiente(), contexto(), "b");
  const rechazada = responderNoQuieroTruco(propuestaPendiente(), contexto(), "b");
  assert.equal(
    responderNoQuieroTruco(querida.estado, contexto(), "b").codigo,
    "sin-propuesta-pendiente",
  );
  assert.equal(
    responderQuieroTruco(rechazada.estado, contexto(), "b").codigo,
    "sin-propuesta-pendiente",
  );
});

test("rechaza respuestas sin propuesta, del proponente o de jugadores inexistentes", () => {
  assert.equal(
    responderQuieroTruco(crearEstadoTruco(), contexto(), "b").codigo,
    "sin-propuesta-pendiente",
  );
  assert.equal(
    responderQuieroTruco(propuestaPendiente(), contexto(), "a").codigo,
    "respondedor-invalido",
  );
  assert.equal(
    responderNoQuieroTruco(propuestaPendiente(), contexto(), "x").codigo,
    "jugador-inexistente",
  );
});

test("Flor y Envido suspenden la respuesta sin alterar la propuesta", () => {
  const pendiente = propuestaPendiente();
  const antes = JSON.stringify(pendiente);
  assert.equal(
    responderQuieroTruco(pendiente, contexto({ florPendiente: true }), "b").codigo,
    "flor-pendiente",
  );
  assert.equal(
    responderNoQuieroTruco(pendiente, contexto({ envidoPendiente: true }), "b").codigo,
    "envido-pendiente",
  );
  assert.equal(JSON.stringify(pendiente), antes);
  const reanudada = responderQuieroTruco(pendiente, contexto({ envidoPendiente: false }), "b");
  assert.equal(reanudada.aceptada, true);
});

test("respuestas son deterministas y rechazan estados, contextos o manos adulterados", () => {
  assert.deepEqual(
    responderNoQuieroTruco(propuestaPendiente(), contexto(), "b"),
    responderNoQuieroTruco(propuestaPendiente(), contexto(), "b"),
  );
  assert.equal(
    responderQuieroTruco(propuestaPendiente(), contexto({ manoFinalizada: true }), "b").codigo,
    "mano-finalizada",
  );
  assert.equal(
    responderQuieroTruco(
      {
        apuestaActiva: { nivel: "truco", equipoAceptante: "B" },
        propuestaPendiente: { nivel: "truco", proponente: "a" },
      },
      contexto(),
      "b",
    ).codigo,
    "estado-invalido",
  );
  assert.equal(
    responderQuieroTruco(propuestaPendiente(), contexto({ jugadores: [] }), "b").codigo,
    "contexto-invalido",
  );
});

test("la propuesta es determinista e invalida estados o contextos adulterados", () => {
  const primero = proponerTruco(crearEstadoTruco(), contexto(), "a");
  const segundo = proponerTruco(crearEstadoTruco(), contexto(), "a");
  assert.deepEqual(primero, segundo);
  assert.equal(
    esEstadoTrucoValido(
      { apuestaActiva: null, propuestaPendiente: { nivel: "truco", proponente: "x" } },
      contexto(),
    ),
    false,
  );
  assert.equal(
    esEstadoTrucoValido({
      apuestaActiva: { nivel: "retruco", equipoAceptante: "A" },
      propuestaPendiente: null,
      historialPropuestas: [
        propuestaHistorica(1, "truco", "a", "A", null, "quiero"),
        propuestaHistorica(2, "retruco", "b", "B", "truco", "quiero"),
      ],
    }, contexto()),
    true,
  );
  assert.equal(
    proponerTruco(crearEstadoTruco(), contexto({ jugadores: [] }), "a").codigo,
    "contexto-invalido",
  );
});

test("rechaza estados de Truco estructuralmente inválidos", () => {
  assert.equal(esEstadoTrucoValido(null), false);
  assert.equal(esEstadoTrucoValido(undefined), false);
  assert.equal(
    esEstadoTrucoValido({
      apuestaActiva: { nivel: "vale-cuatro", equipoAceptante: "" },
      propuestaPendiente: null,
    }),
    false,
  );
  assert.equal(esEstadoTrucoValido({ apuestaActiva: null, propuestaPendiente: {} }), false);
});

function trucoAceptado() {
  const r = responderQuieroTruco(propuestaPendiente(), contexto(), "b");
  assert.equal(r.aceptada, true);
  return r.estado;
}

const contextoDosContraDos = (cambios = {}) =>
  contexto({
    jugadores: [
      { id: "a", equipo: "A" },
      { id: "b", equipo: "B" },
      { id: "a2", equipo: "A" },
      { id: "b2", equipo: "B" },
    ],
    ...cambios,
  });

test("Retruco lo propone cualquier integrante del equipo que aceptó Truco", () => {
  const estado = trucoAceptado();
  const enTurno = proponerRetruco(estado, contextoDosContraDos({ jugadorTurno: "b" }), "b");
  const fueraDeTurno = proponerRetruco(estado, contextoDosContraDos({ jugadorTurno: "a" }), "b2");
  assert.equal(enTurno.aceptada, true);
  assert.equal(fueraDeTurno.aceptada, true);
  assert.deepEqual(fueraDeTurno.estado, {
    apuestaActiva: { nivel: "truco", equipoAceptante: "B" },
    propuestaPendiente: { nivel: "retruco", proponente: "b2" },
    historialPropuestas: [
      propuestaHistorica(1, "truco", "a", "A", null, "quiero"),
      propuestaHistorica(2, "retruco", "b2", "B", "truco", null),
    ],
  });
  assert.deepEqual(fueraDeTurno.eventos, [
    {
      tipo: "retruco-propuesto",
      propuesta: { nivel: "retruco", proponente: "b2" },
      equipoProponente: "B",
    },
  ]);
  assert.deepEqual(estado, trucoAceptado());
});

test("Vale Cuatro lo propone cualquier integrante del equipo que aceptó Retruco", () => {
  const estado = responderQuieroRetruco(
    proponerRetruco(trucoAceptado(), contexto(), "b").estado,
    contexto(),
    "a",
  ).estado;
  const enTurno = proponerValeCuatro(estado, contextoDosContraDos({ jugadorTurno: "a" }), "a");
  const fueraDeTurno = proponerValeCuatro(
    estado,
    contextoDosContraDos({ jugadorTurno: "b" }),
    "a2",
  );
  assert.equal(enTurno.aceptada, true);
  assert.equal(fueraDeTurno.aceptada, true);
  assert.equal(fueraDeTurno.estado.apuestaActiva.nivel, "retruco");
  assert.deepEqual(fueraDeTurno.estado.propuestaPendiente, {
    nivel: "vale-cuatro",
    proponente: "a2",
  });
});

test("aumentos rechazan equipos no habilitados, niveles previos y propuestas pendientes", () => {
  assert.equal(proponerRetruco(trucoAceptado(), contexto(), "a").codigo, "aumento-no-habilitado");
  assert.equal(proponerRetruco(crearEstadoTruco(), contexto(), "a").codigo, "sin-apuesta-aceptada");
  const pendiente = proponerRetruco(trucoAceptado(), contexto(), "b");
  assert.equal(
    proponerValeCuatro(pendiente.estado, contexto(), "b").codigo,
    "aumento-no-habilitado",
  );
  assert.equal(
    proponerValeCuatro(trucoAceptado(), contexto(), "b").codigo,
    "aumento-no-disponible",
  );
});

test("aumentos respetan Flor, Envido, mano finalizada, inmutabilidad y contextos inválidos", () => {
  const estado = trucoAceptado();
  const antes = JSON.stringify(estado);
  assert.equal(
    proponerRetruco(estado, contexto({ florPendiente: true }), "b").codigo,
    "flor-pendiente",
  );
  assert.equal(
    proponerRetruco(estado, contexto({ envidoPendiente: true }), "b").codigo,
    "envido-pendiente",
  );
  assert.equal(
    proponerRetruco(estado, contexto({ manoFinalizada: true }), "b").codigo,
    "mano-finalizada",
  );
  assert.equal(JSON.stringify(estado), antes);
  assert.deepEqual(
    proponerRetruco(estado, contexto(), "b"),
    proponerRetruco(estado, contexto(), "b"),
  );
  assert.equal(
    proponerRetruco(estado, contexto({ jugadores: [] }), "b").codigo,
    "contexto-invalido",
  );
  assert.equal(
    esEstadoTrucoValido(
      {
        apuestaActiva: { nivel: "truco", equipoAceptante: "A" },
        propuestaPendiente: { nivel: "vale-cuatro", proponente: "a" },
      },
      contexto(),
    ),
    false,
  );
});

function retrucoPendiente() {
  const r = proponerRetruco(trucoAceptado(), contexto(), "b");
  assert.equal(r.aceptada, true);
  return r.estado;
}

function valeCuatroPendiente() {
  const aceptado = responderQuieroRetruco(
    proponerRetruco(trucoAceptado(), contexto(), "b").estado,
    contexto(),
    "a",
  ).estado;
  const r = proponerValeCuatro(aceptado, contexto(), "a");
  assert.equal(r.aceptada, true);
  return r.estado;
}

test("Quiero Retruco actualiza el equipo aceptante sin adjudicar puntos", () => {
  const pendiente = retrucoPendiente();
  const r = responderQuieroRetruco(pendiente, contextoDosContraDos({ jugadorTurno: "a" }), "a2");
  assert.equal(r.aceptada, true);
  assert.deepEqual(r.estado, {
    apuestaActiva: { nivel: "retruco", equipoAceptante: "A" },
    propuestaPendiente: null,
    historialPropuestas: [
      propuestaHistorica(1, "truco", "a", "A", null, "quiero"),
      propuestaHistorica(2, "retruco", "b", "B", "truco", "quiero"),
    ],
  });
  assert.equal(r.eventos[0].tipo, "retruco-aceptado");
  assert.deepEqual(pendiente.apuestaActiva, { nivel: "truco", equipoAceptante: "B" });
});

test("No quiero Retruco adjudica dos puntos y finaliza semánticamente la mano", () => {
  const r = responderNoQuieroRetruco(retrucoPendiente(), contexto(), "a");
  assert.equal(r.aceptada, true);
  assert.deepEqual(r.estado, {
    apuestaActiva: { nivel: "truco", equipoAceptante: "B" },
    propuestaPendiente: null,
    historialPropuestas: [
      propuestaHistorica(1, "truco", "a", "A", null, "quiero"),
      propuestaHistorica(2, "retruco", "b", "B", "truco", "no-quiero", "a"),
    ],
  });
  assert.deepEqual(r.eventos[0], {
    tipo: "retruco-rechazado",
    propuesta: { nivel: "retruco", proponente: "b" },
    respondedor: "a",
    adjudicacion: { equipo: "B", puntos: 2, motivo: "rechazo" },
    manoFinalizada: true,
  });
});

test("Quiero y No quiero Vale Cuatro actualizan o adjudican tres puntos", () => {
  const querida = responderQuieroValeCuatro(valeCuatroPendiente(), contextoDosContraDos(), "b2");
  assert.equal(querida.aceptada, true);
  assert.deepEqual(querida.estado.apuestaActiva, { nivel: "vale-cuatro", equipoAceptante: "B" });
  assert.equal(querida.eventos[0].tipo, "vale-cuatro-aceptado");
  const rechazada = responderNoQuieroValeCuatro(valeCuatroPendiente(), contexto(), "b");
  assert.equal(rechazada.aceptada, true);
  assert.deepEqual(rechazada.eventos[0].adjudicacion, {
    equipo: "A",
    puntos: 3,
    motivo: "rechazo",
  });
  assert.equal(rechazada.eventos[0].manoFinalizada, true);
});

test("respuestas a aumentos validan equipo, propuesta y nivel", () => {
  assert.equal(
    responderQuieroRetruco(retrucoPendiente(), contexto(), "b").codigo,
    "respondedor-invalido",
  );
  assert.equal(
    responderQuieroRetruco(retrucoPendiente(), contexto(), "x").codigo,
    "jugador-inexistente",
  );
  assert.equal(
    responderQuieroRetruco(trucoAceptado(), contexto(), "a").codigo,
    "sin-propuesta-pendiente",
  );
  assert.equal(
    responderQuieroValeCuatro(retrucoPendiente(), contexto(), "a").codigo,
    "sin-propuesta-pendiente",
  );
});

test("Flor y Envido suspenden aumentos sin mutar y permiten responder al reanudarse", () => {
  const pendiente = retrucoPendiente();
  const antes = JSON.stringify(pendiente);
  assert.equal(
    responderQuieroRetruco(pendiente, contexto({ florPendiente: true }), "a").codigo,
    "flor-pendiente",
  );
  assert.equal(
    responderNoQuieroRetruco(pendiente, contexto({ envidoPendiente: true }), "a").codigo,
    "envido-pendiente",
  );
  assert.equal(JSON.stringify(pendiente), antes);
  assert.equal(responderQuieroRetruco(pendiente, contexto(), "a").aceptada, true);
});

test("respuestas a aumentos son deterministas y rechazan estados o contextos adulterados", () => {
  assert.deepEqual(
    responderNoQuieroValeCuatro(valeCuatroPendiente(), contexto(), "b"),
    responderNoQuieroValeCuatro(valeCuatroPendiente(), contexto(), "b"),
  );
  assert.equal(
    responderQuieroRetruco(
      {
        apuestaActiva: { nivel: "truco", equipoAceptante: "B" },
        propuestaPendiente: { nivel: "vale-cuatro", proponente: "b" },
      },
      contexto(),
      "a",
    ).codigo,
    "estado-invalido",
  );
  assert.equal(
    responderQuieroValeCuatro(valeCuatroPendiente(), contexto({ jugadores: [] }), "b").codigo,
    "contexto-invalido",
  );
});

test("secuencias completas conservan la escalera, valores y ausencia de adjudicaciones anticipadas", () => {
  const inicial = crearEstadoTruco();
  const truco = proponerTruco(inicial, contexto(), "a");
  const trucoQuerido = responderQuieroTruco(truco.estado, contexto(), "b");
  assert.deepEqual(trucoQuerido.estado.apuestaActiva, { nivel: "truco", equipoAceptante: "B" });
  assert.deepEqual(trucoQuerido.eventos, [
    {
      tipo: "truco-aceptado",
      propuesta: { nivel: "truco", proponente: "a" },
      respondedor: "b",
      equipoRespondedor: "B",
    },
  ]);
  const retruco = proponerRetruco(trucoQuerido.estado, contexto({ jugadorTurno: "a" }), "b");
  assert.deepEqual(retruco.estado.apuestaActiva, { nivel: "truco", equipoAceptante: "B" });
  const retrucoQuerido = responderQuieroRetruco(retruco.estado, contexto(), "a");
  assert.deepEqual(retrucoQuerido.estado.apuestaActiva, { nivel: "retruco", equipoAceptante: "A" });
  const valeCuatro = proponerValeCuatro(
    retrucoQuerido.estado,
    contexto({ jugadorTurno: "b" }),
    "a",
  );
  const valeCuatroQuerido = responderQuieroValeCuatro(valeCuatro.estado, contexto(), "b");
  assert.deepEqual(valeCuatroQuerido.estado, {
    apuestaActiva: { nivel: "vale-cuatro", equipoAceptante: "B" },
    propuestaPendiente: null,
    historialPropuestas: [
      propuestaHistorica(1, "truco", "a", "A", null, "quiero"),
      propuestaHistorica(2, "retruco", "b", "B", "truco", "quiero"),
      propuestaHistorica(3, "vale-cuatro", "a", "A", "retruco", "quiero"),
    ],
  });
  assert.equal(
    proponerRetruco(valeCuatroQuerido.estado, contexto(), "b").codigo,
    "aumento-no-disponible",
  );
  assert.equal(
    proponerValeCuatro(valeCuatroQuerido.estado, contexto(), "b").codigo,
    "aumento-no-disponible",
  );
  assert.deepEqual(inicial, crearEstadoTruco());
});

test("secuencias de rechazo adjudican exactamente uno, dos y tres puntos una sola vez", () => {
  const trucoNo = responderNoQuieroTruco(
    proponerTruco(crearEstadoTruco(), contexto(), "a").estado,
    contexto(),
    "b",
  );
  const retrucoNo = responderNoQuieroRetruco(
    proponerRetruco(trucoAceptado(), contexto(), "b").estado,
    contexto(),
    "a",
  );
  const retrucoAceptado = responderQuieroRetruco(
    proponerRetruco(trucoAceptado(), contexto(), "b").estado,
    contexto(),
    "a",
  );
  const valeNo = responderNoQuieroValeCuatro(
    proponerValeCuatro(retrucoAceptado.estado, contexto(), "a").estado,
    contexto(),
    "b",
  );
  assert.deepEqual(
    [trucoNo, retrucoNo, valeNo].map((resultado) => resultado.eventos[0].adjudicacion?.puntos),
    [1, 2, 3],
  );
  for (const resultado of [trucoNo, retrucoNo, valeNo]) {
    assert.equal(resultado.eventos.length, 1);
    assert.equal(resultado.eventos[0].manoFinalizada, true);
    assert.equal(
      responderQuieroTruco(resultado.estado, contexto(), "b").codigo,
      "sin-propuesta-pendiente",
    );
  }
});

test("validación histórica rechaza contradicciones deducibles y conserva suspensión legítima", () => {
  const x = contexto();
  assert.equal(
    esEstadoTrucoValido(
      { apuestaActiva: null, propuestaPendiente: { nivel: "retruco", proponente: "a" } },
      x,
    ),
    false,
  );
  assert.equal(
    esEstadoTrucoValido(
      {
        apuestaActiva: { nivel: "vale-cuatro", equipoAceptante: "A" },
        propuestaPendiente: { nivel: "retruco", proponente: "a" },
      },
      x,
    ),
    false,
  );
  assert.equal(
    esEstadoTrucoValido(
      {
        apuestaActiva: { nivel: "truco", equipoAceptante: "A" },
        propuestaPendiente: { nivel: "retruco", proponente: "b" },
      },
      x,
    ),
    false,
  );
  const pendiente = proponerRetruco(trucoAceptado(), x, "b").estado;
  assert.equal(esEstadoTrucoValido(pendiente, contexto({ envidoPendiente: true })), true);
  assert.equal(esEstadoTrucoValido(pendiente, contexto({ florPendiente: true })), true);
  assert.equal(esEstadoTrucoValido(pendiente, contexto({ manoFinalizada: true })), false);
});

test("Retruco responde y acepta implícitamente Truco en una transición atómica", () => {
  const pendiente = propuestaPendiente();
  const r = proponerRetruco(pendiente, contextoDosContraDos({ jugadorTurno: "a" }), "b2");
  assert.equal(r.aceptada, true);
  assert.deepEqual(r.estado, {
    apuestaActiva: { nivel: "truco", equipoAceptante: "B" },
    propuestaPendiente: { nivel: "retruco", proponente: "b2" },
    historialPropuestas: [
      propuestaHistorica(1, "truco", "a", "A", null, "quiero"),
      propuestaHistorica(2, "retruco", "b2", "B", "truco", null),
    ],
  });
  assert.deepEqual(r.eventos, [
    {
      tipo: "truco-aceptado",
      propuesta: { nivel: "truco", proponente: "a" },
      respondedor: "b2",
      equipoRespondedor: "B",
    },
    {
      tipo: "retruco-propuesto",
      propuesta: { nivel: "retruco", proponente: "b2" },
      equipoProponente: "B",
    },
  ]);
  assert.deepEqual(pendiente, propuestaPendiente());
});

test("Vale Cuatro responde y acepta implícitamente Retruco, incluso fuera de turno", () => {
  const retruco = proponerRetruco(propuestaPendiente(), contexto(), "b");
  const r = proponerValeCuatro(retruco.estado, contextoDosContraDos({ jugadorTurno: "b" }), "a2");
  assert.equal(r.aceptada, true);
  assert.deepEqual(r.estado, {
    apuestaActiva: { nivel: "retruco", equipoAceptante: "A" },
    propuestaPendiente: { nivel: "vale-cuatro", proponente: "a2" },
    historialPropuestas: [
      propuestaHistorica(1, "truco", "a", "A", null, "quiero"),
      propuestaHistorica(2, "retruco", "b", "B", "truco", "quiero"),
      propuestaHistorica(3, "vale-cuatro", "a2", "A", "retruco", null),
    ],
  });
  assert.equal(r.eventos[0].tipo, "retruco-aceptado");
  assert.equal(r.eventos[1].tipo, "vale-cuatro-propuesto");
  assert.equal(
    r.eventos.some((evento) => "adjudicacion" in evento),
    false,
  );
});

test("secuencia directa completa conserva niveles y permite sus respuestas posteriores", () => {
  const retruco = proponerRetruco(
    proponerTruco(crearEstadoTruco(), contexto(), "a").estado,
    contexto(),
    "b",
  );
  const vale = proponerValeCuatro(retruco.estado, contexto(), "a");
  const valeQuerido = responderQuieroValeCuatro(vale.estado, contexto(), "b");
  assert.equal(valeQuerido.aceptada, true);
  assert.deepEqual(valeQuerido.estado.apuestaActiva, {
    nivel: "vale-cuatro",
    equipoAceptante: "B",
  });
  const valeNo = proponerValeCuatro(retruco.estado, contexto(), "a");
  const rechazo = responderNoQuieroValeCuatro(valeNo.estado, contexto(), "b");
  assert.deepEqual(rechazo.eventos[0].adjudicacion, { equipo: "A", puntos: 3, motivo: "rechazo" });
  const retrucoNo = proponerRetruco(propuestaPendiente(), contexto(), "b");
  assert.deepEqual(
    responderNoQuieroRetruco(retrucoNo.estado, contexto(), "a").eventos[0].adjudicacion,
    { equipo: "B", puntos: 2, motivo: "rechazo" },
  );
});

test("aumentos directos rechazan equipo original, saltos, bloqueos y estados adulterados", () => {
  const truco = propuestaPendiente();
  assert.equal(proponerRetruco(truco, contexto(), "a").codigo, "aumento-no-habilitado");
  assert.equal(proponerValeCuatro(truco, contexto(), "b").codigo, "aumento-no-disponible");
  const antes = JSON.stringify(truco);
  assert.equal(
    proponerRetruco(truco, contexto({ florPendiente: true }), "b").codigo,
    "flor-pendiente",
  );
  assert.equal(
    proponerRetruco(truco, contexto({ envidoPendiente: true }), "b").codigo,
    "envido-pendiente",
  );
  assert.equal(JSON.stringify(truco), antes);
  assert.equal(
    proponerValeCuatro(
      {
        apuestaActiva: { nivel: "truco", equipoAceptante: "B" },
        propuestaPendiente: { nivel: "retruco", proponente: "a" },
      },
      contexto(),
      "b",
    ).codigo,
    "estado-invalido",
  );
});

test("retiro del respondedor de Truco pendiente liquida rechazo implícito", () => {
  const original = proponerTruco(crearEstadoTruco(), contexto(), "a").estado;
  const antes = JSON.stringify(original);
  const resultado = liquidarTrucoPorRetiro(original, contexto(), "b");
  assert.equal(resultado.aceptada, true);
  assert.equal(resultado.liquidacion.causa, "rechazo-implicito-por-retiro");
  assert.equal(resultado.liquidacion.equipo, "A");
  assert.equal(resultado.liquidacion.puntos, 1);
  assert.deepEqual(resultado.eventos, [{ tipo: "truco-rechazo-implicito-por-retiro" }]);
  assert.equal(resultado.estado.apuestaActiva, null);
  assert.equal(JSON.stringify(original), antes);
});

test("retiro del respondedor de Retruco y Vale Cuatro paga el rechazo exacto", () => {
  const truco = responderQuieroTruco(proponerTruco(crearEstadoTruco(), contexto(), "a").estado, contexto(), "b").estado;
  const retruco = proponerRetruco(truco, contexto(), "b").estado;
  const r = liquidarTrucoPorRetiro(retruco, contexto(), "a");
  assert.equal(r.aceptada, true);
  assert.equal(r.liquidacion.equipo, "B");
  assert.equal(r.liquidacion.puntos, 2);
  const aceptado = responderQuieroRetruco(retruco, contexto(), "a").estado;
  const vale = proponerValeCuatro(aceptado, contexto(), "a").estado;
  const v = liquidarTrucoPorRetiro(vale, contexto(), "b");
  assert.equal(v.aceptada, true);
  assert.equal(v.liquidacion.equipo, "A");
  assert.equal(v.liquidacion.puntos, 3);
  assert.equal(v.eventos[0].tipo, "truco-rechazo-implicito-por-retiro");
});

test("retiro sin propuesta expone el valor de mano aceptado", () => {
  const inicial = crearEstadoTruco();
  const truco = responderQuieroTruco(proponerTruco(inicial, contexto(), "a").estado, contexto(), "b").estado;
  const retruco = responderQuieroRetruco(proponerRetruco(truco, contexto(), "b").estado, contexto(), "a").estado;
  const vale = responderQuieroValeCuatro(proponerValeCuatro(retruco, contexto(), "a").estado, contexto(), "b").estado;
  for (const [estado, puntos] of [[inicial, 1], [truco, 2], [retruco, 3], [vale, 4]]) {
    const resultado = liquidarTrucoPorRetiro(estado, contexto(), "a");
    assert.equal(resultado.aceptada, true);
    assert.equal(resultado.liquidacion.puntos, puntos);
    assert.equal(resultado.eventos[0].tipo, "truco-sin-propuesta-por-retiro");
  }
  assert.equal(liquidarTrucoPorRetiro(inicial, contexto(), "x").aceptada, false);
});

test("retiro del proponente cancela Truco, Retruco y Vale Cuatro sin rechazo", () => {
  const trucoPendiente = proponerTruco(crearEstadoTruco(), contexto(), "a").estado;
  const trucoAceptado = responderQuieroTruco(trucoPendiente, contexto(), "b").estado;
  const retrucoPendiente = proponerRetruco(trucoAceptado, contexto(), "b").estado;
  const retrucoAceptado = responderQuieroRetruco(retrucoPendiente, contexto(), "a").estado;
  const valePendiente = proponerValeCuatro(retrucoAceptado, contexto(), "a").estado;
  for (const [pendiente, proponente, valor] of [
    [trucoPendiente, "a", 1],
    [retrucoPendiente, "b", 2],
    [valePendiente, "a", 3],
  ]) {
    const antes = JSON.stringify(pendiente);
    const resultado = liquidarTrucoPorRetiro(pendiente, contexto(), proponente);
    assert.equal(resultado.aceptada, true);
    assert.equal(resultado.liquidacion.causa, "propuesta-cancelada-por-retiro");
    assert.equal(resultado.liquidacion.puntos, valor);
    assert.deepEqual(resultado.eventos, [{ tipo: "truco-cancelado-por-retiro" }]);
    assert.equal(resultado.estado.propuestaPendiente, null);
    assert.equal(esEstadoTrucoValido(resultado.estado, contexto()), true);
    assert.equal(JSON.stringify(pendiente), antes);
  }
});

test("el historial persistente registra la escalera completa y sus respuestas", () => {
  const truco = proponerTruco(crearEstadoTruco(), contexto(), "a").estado;
  const retruco = proponerRetruco(truco, contexto(), "b").estado;
  const vale = proponerValeCuatro(retruco, contexto(), "a").estado;
  assert.deepEqual(vale.historialPropuestas, [
    propuestaHistorica(1, "truco", "a", "A", null, "quiero"),
    propuestaHistorica(2, "retruco", "b", "B", "truco", "quiero"),
    propuestaHistorica(3, "vale-cuatro", "a", "A", "retruco", null),
  ]);
  const aceptado = responderQuieroValeCuatro(vale, contexto(), "b").estado;
  assert.equal(aceptado.historialPropuestas[2].respuesta, "quiero");
  assert.equal(esEstadoTrucoValido(aceptado, contexto()), true);
});

test("el historial conserva rechazos voluntarios e implÃ­citos y cancelaciones por retiro", () => {
  const trucoNo = responderNoQuieroTruco(propuestaPendiente(), contexto(), "b").estado;
  const retrucoNo = responderNoQuieroRetruco(retrucoPendiente(), contexto(), "a").estado;
  const valeNo = responderNoQuieroValeCuatro(valeCuatroPendiente(), contexto(), "b").estado;
  assert.deepEqual(
    [trucoNo, retrucoNo, valeNo].map((estado) => estado.historialPropuestas.at(-1).respuesta),
    ["no-quiero", "no-quiero", "no-quiero"],
  );
  const implicito = liquidarTrucoPorRetiro(propuestaPendiente(), contexto(), "b").estado;
  const cancelado = liquidarTrucoPorRetiro(propuestaPendiente(), contexto(), "a").estado;
  assert.equal(implicito.historialPropuestas[0].respuesta, "rechazo-implicito-por-retiro");
  assert.equal(cancelado.historialPropuestas[0].respuesta, "cancelada-por-retiro");
  assert.equal(esEstadoTrucoValido(implicito, contexto()), true);
  assert.equal(esEstadoTrucoValido(cancelado, contexto()), true);
});

test("el validador rechaza historiales adulterados o incoherentes con propuesta y apuesta", () => {
  const pendiente = propuestaPendiente();
  const historial = pendiente.historialPropuestas;
  for (const entrada of [
    { ...historial[0], orden: 2 },
    { ...historial[0], nivel: "retruco" },
    { ...historial[0], equipoProponente: "B" },
    { ...historial[0], proponente: "b" },
    { ...historial[0], respuesta: "quiero" },
  ]) {
    assert.equal(esEstadoTrucoValido({ ...pendiente, historialPropuestas: [entrada] }, contexto()), false);
  }
  assert.equal(
    esEstadoTrucoValido({ ...pendiente, propuestaPendiente: null }, contexto()),
    false,
  );
  const aceptado = trucoAceptado();
  assert.equal(
    esEstadoTrucoValido(
      { ...aceptado, apuestaActiva: { nivel: "retruco", equipoAceptante: "A" } },
      contexto(),
    ),
    false,
  );
  const retruco = retrucoPendiente();
  assert.equal(
    esEstadoTrucoValido(
      {
        ...retruco,
        historialPropuestas: [
          retruco.historialPropuestas[0],
          { ...retruco.historialPropuestas[1], equipoProponente: "A" },
        ],
      },
      contexto(),
    ),
    false,
  );
  const rechazado = responderNoQuieroTruco(propuestaPendiente(), contexto(), "b").estado;
  assert.equal(
    esEstadoTrucoValido(
      {
        ...rechazado,
        historialPropuestas: [{ ...rechazado.historialPropuestas[0], respondedor: "a" }],
      },
      contexto(),
    ),
    false,
  );
});

test("una respuesta terminal del historial no permite reiniciar ni prolongar la secuencia", () => {
  const rechazado = responderNoQuieroTruco(propuestaPendiente(), contexto(), "b").estado;
  assert.equal(proponerTruco(rechazado, contexto(), "a").codigo, "secuencia-finalizada");
  const cancelado = liquidarTrucoPorRetiro(propuestaPendiente(), contexto(), "a").estado;
  assert.equal(proponerRetruco(cancelado, contexto(), "b").codigo, "secuencia-finalizada");
});
