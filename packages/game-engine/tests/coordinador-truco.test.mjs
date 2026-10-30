import assert from "node:assert/strict";
import { test } from "node:test";
import * as motor from "../dist/index.js";
import {
  crearEstadoManoCoordinada,
  crearEstadoTruco,
  crearMazo,
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
  const final = finalizarPorBazas(estado, mano);
  assert.deepEqual(final.eventos.map((evento) => evento.tipo).slice(-4), [
    "carta-jugada",
    "baza-resuelta",
    "mano-decidida-por-bazas",
    "truco-adjudicado-por-bazas",
  ]);
  assert.equal(
    ejecutarAccionCoordinada(final.estado, {
      tipo: "jugar-carta",
      jugador: "a",
      carta: mano.manos[0].cartas[2],
    }).rechazo.codigo,
    "mano-finalizada",
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
