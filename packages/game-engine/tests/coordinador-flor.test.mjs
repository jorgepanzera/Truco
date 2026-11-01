import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crearEstadoManoCoordinada,
  crearMazo,
  ejecutarAccionCoordinada,
  iniciarJuegoCartas,
  iniciarEnvido,
  obtenerContextoEnvido,
  obtenerContextoFlor,
  prepararMano,
} from "../dist/index.js";

const c = (palo, valor) => ({ palo, valor });
function baseFlor(
  contextoInicio = { metaPuntos: 40, puntajesIniciales: { A: 0, B: 0 }, esDesempate: false },
) {
  const primeras = [
    c("copa", 3),
    c("espada", 3),
    c("copa", 6),
    c("espada", 6),
    c("copa", 7),
    c("espada", 7),
    c("oro", 2),
  ];
  const mazo = [
    ...primeras,
    ...crearMazo().filter(
      (carta) => !primeras.some((otra) => otra.palo === carta.palo && otra.valor === carta.valor),
    ),
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
    mazo,
  );
  return {
    mano,
    estado: crearEstadoManoCoordinada(iniciarJuegoCartas(mano), contextoInicio),
  };
}
function baseFlorDosVsDos() {
  const primeras = [
    c("copa", 3),
    c("espada", 3),
    c("basto", 3),
    c("oro", 1),
    c("copa", 6),
    c("espada", 6),
    c("basto", 6),
    c("oro", 4),
    c("copa", 7),
    c("espada", 7),
    c("basto", 7),
    c("oro", 5),
    c("oro", 2),
  ];
  const mazo = [
    ...primeras,
    ...crearMazo().filter(
      (carta) => !primeras.some((otra) => otra.palo === carta.palo && otra.valor === carta.valor),
    ),
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

test("coordinador inicializa Flor desde cartas canónicas y anuncia con prioridad", () => {
  const { estado } = baseFlor();
  assert.deepEqual(estado.flor.anuncios, []);
  assert.equal(
    obtenerContextoFlor(estado.juego, estado.contextoInicio).jugadores[0].jugoPrimeraCarta,
    false,
  );
  assert.equal(
    ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "b" }).aceptada,
    false,
  );
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  assert.equal(a.aceptada, true);
  assert.equal(a.estado.flor.anuncios[0].jugador, "a");
  assert.equal(
    ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "a" }).aceptada,
    false,
  );
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  assert.equal(b.aceptada, true);
  assert.equal(b.estado.flor.anuncios[1].jugador, "b");
});

test("primera carta renuncia a Flor atómicamente y una carta inválida no altera Flor", () => {
  const { mano, estado } = baseFlor();
  const antes = JSON.stringify(estado);
  const invalida = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos.find((m) => m.jugador === "b").cartas[0],
  });
  assert.equal(invalida.aceptada, false);
  assert.equal(JSON.stringify(estado), antes);
  const r = ejecutarAccionCoordinada(estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos.find((m) => m.jugador === "a").cartas[0],
  });
  assert.equal(r.aceptada, true);
  assert.deepEqual(r.estado.flor.derechosPerdidos, ["a"]);
  assert.equal(r.estado.juego.cartasDisponibles.find((m) => m.jugador === "a").cartas.length, 2);
  assert.equal(r.eventos[0].tipo, "derecho-flor-perdido");
});

test("Contra Flor coordinada bloquea cartas y el rechazo las desbloquea adjudicando", () => {
  const { mano, estado } = baseFlor();
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const antes = JSON.stringify(b.estado);
  const desafio = ejecutarAccionCoordinada(b.estado, {
    tipo: "proponer-contra-flor",
    jugador: "a",
  });
  assert.equal(desafio.aceptada, true);
  assert.equal(desafio.eventos[0].tipo, "contra-flor-propuesta");
  assert.equal(JSON.stringify(b.estado), antes);
  const bloqueada = ejecutarAccionCoordinada(desafio.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos.find((m) => m.jugador === "a").cartas[0],
  });
  assert.equal(bloqueada.aceptada, false);
  assert.equal(bloqueada.rechazo.codigo, "flor-pendiente");
  const rechazo = ejecutarAccionCoordinada(desafio.estado, {
    tipo: "no-quiero-contra-flor",
    jugador: "b",
  });
  assert.equal(rechazo.aceptada, true);
  assert.equal(rechazo.eventos[0].tipo, "contra-flor-rechazada");
  assert.deepEqual(rechazo.estado.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "rechazo" },
    { equipo: "B", puntos: 0, motivo: "rechazo" },
  ]);
  assert.equal(
    ejecutarAccionCoordinada(rechazo.estado, {
      tipo: "jugar-carta",
      jugador: "a",
      carta: mano.manos.find((m) => m.jugador === "a").cartas[0],
    }).aceptada,
    true,
  );
});

test("Contra Flor al Resto coordinada aumenta, acepta y resuelve al no haber derechos", () => {
  const { estado } = baseFlor();
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const contra = ejecutarAccionCoordinada(b.estado, { tipo: "proponer-contra-flor", jugador: "a" });
  const resto = ejecutarAccionCoordinada(contra.estado, {
    tipo: "proponer-contra-flor-al-resto",
    jugador: "b",
  });
  assert.equal(resto.aceptada, true);
  assert.equal(resto.estado.flor.pendiente.tipo, "contra-flor-al-resto");
  assert.equal(resto.eventos[0].tipo, "contra-flor-al-resto-propuesta");
  const quiere = ejecutarAccionCoordinada(resto.estado, {
    tipo: "quiero-contra-flor-al-resto",
    jugador: "a",
  });
  assert.equal(quiere.aceptada, true);
  assert.equal(quiere.eventos[0].tipo, "contra-flor-al-resto-aceptada");
  assert.equal(quiere.estado.flor.pendiente, null);
  assert.deepEqual(quiere.estado.flor.adjudicaciones, []);
  assert.equal(quiere.estado.flor.resultadoTerminal.equipo, "A");
  assert.deepEqual(quiere.estado.resultadoPartida, {
    motivo: "contra-flor-al-resto",
    equipoGanador: "A",
  });
  assert.equal(
    quiere.eventos.filter((evento) => evento.tipo === "partida-terminada-contra-flor-al-resto")
      .length,
    1,
  );
  assert.equal(
    ejecutarAccionCoordinada(quiere.estado, { tipo: "anunciar-flor", jugador: "a" }).rechazo.codigo,
    "partida-finalizada",
  );
});

test("Contra Flor al Resto directa coordinada registra propuesta y rechazo sin duplicar eventos", () => {
  const { estado } = baseFlor();
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const propuesta = ejecutarAccionCoordinada(b.estado, {
    tipo: "proponer-contra-flor-al-resto",
    jugador: "a",
  });
  const rechazo = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "no-quiero-contra-flor-al-resto",
    jugador: "b",
  });
  assert.equal(propuesta.eventos[0].tipo, "contra-flor-al-resto-propuesta");
  assert.equal(rechazo.eventos.length, 3);
  assert.equal(rechazo.eventos[0].tipo, "contra-flor-al-resto-rechazada");
  assert.equal(rechazo.estado.flor.pendiente, null);
  assert.equal(rechazo.estado.resultadoPartida, null);
});

test("Contra Flor al Resto aceptada en desempate adjudica tres puntos sin resultado terminal", () => {
  const { estado } = baseFlor({
    metaPuntos: 40,
    puntajesIniciales: { A: 40, B: 40 },
    esDesempate: true,
  });
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const propuesta = ejecutarAccionCoordinada(b.estado, {
    tipo: "proponer-contra-flor-al-resto",
    jugador: "a",
  });
  const r = ejecutarAccionCoordinada(propuesta.estado, {
    tipo: "quiero-contra-flor-al-resto",
    jugador: "b",
  });
  assert.equal(r.estado.resultadoPartida, null);
  assert.deepEqual(r.estado.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "al-resto" },
    { equipo: "B", puntos: 0, motivo: "al-resto" },
  ]);
});

test("la siguiente carta válida confirma Flor sin desafío una sola vez e impide desafíos tardíos", () => {
  const { mano, estado } = baseFlor();
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const antes = JSON.stringify(b.estado);
  const invalida = ejecutarAccionCoordinada(b.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos.find((m) => m.jugador === "b").cartas[0],
  });
  assert.equal(invalida.aceptada, false);
  assert.equal(JSON.stringify(b.estado), antes);
  const r = ejecutarAccionCoordinada(b.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos.find((m) => m.jugador === "a").cartas[0],
  });
  assert.equal(r.estado.flor.cerrado, true);
  assert.deepEqual(r.estado.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "sin-desafio" },
    { equipo: "B", puntos: 3, motivo: "sin-desafio" },
  ]);
  assert.equal(r.eventos.filter((evento) => evento.tipo === "flor-adjudicada").length, 1);
  assert.equal(
    ejecutarAccionCoordinada(r.estado, { tipo: "proponer-contra-flor", jugador: "a" }).aceptada,
    false,
  );
});

test("2v2 conserva derechos restantes tras consumir la oportunidad sin cerrar Flor", () => {
  const { mano, estado } = baseFlorDosVsDos();
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const r = ejecutarAccionCoordinada(b.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos.find((m) => m.jugador === "a").cartas[0],
  });
  assert.equal(r.aceptada, true);
  assert.equal(r.estado.flor.cerrado, false);
  assert.equal(r.estado.flor.oportunidadDesafioConsumida, true);
  assert.deepEqual(r.estado.flor.adjudicaciones, []);
  assert.equal(
    ejecutarAccionCoordinada(r.estado, { tipo: "anunciar-flor", jugador: "c" }).aceptada,
    true,
  );
});

test("2v2 cierra Flor al anunciar el último derecho luego de consumida la oportunidad", () => {
  const { mano, estado } = baseFlorDosVsDos();
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const oportunidad = ejecutarAccionCoordinada(b.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos.find((m) => m.jugador === "a").cartas[0],
  });
  const antesInvalida = JSON.stringify(oportunidad.estado);
  const invalida = ejecutarAccionCoordinada(oportunidad.estado, {
    tipo: "jugar-carta",
    jugador: "c",
    carta: mano.manos.find((m) => m.jugador === "c").cartas[0],
  });
  assert.equal(invalida.aceptada, false);
  assert.equal(JSON.stringify(oportunidad.estado), antesInvalida);
  const cierre = ejecutarAccionCoordinada(oportunidad.estado, {
    tipo: "anunciar-flor",
    jugador: "c",
  });
  assert.equal(cierre.estado.flor.cerrado, false);
  const ultimo = ejecutarAccionCoordinada(cierre.estado, { tipo: "anunciar-flor", jugador: "d" });
  assert.equal(ultimo.estado.flor.cerrado, true);
  assert.deepEqual(ultimo.estado.flor.adjudicaciones, [
    { equipo: "A", puntos: 6, motivo: "sin-desafio" },
    { equipo: "B", puntos: 6, motivo: "sin-desafio" },
  ]);
  assert.equal(ultimo.eventos.filter((evento) => evento.tipo === "flor-adjudicada").length, 1);
  assert.equal(
    ejecutarAccionCoordinada(ultimo.estado, { tipo: "proponer-contra-flor", jugador: "a" })
      .aceptada,
    false,
  );
});

test("2v2 cierra Flor al perder el último derecho luego de consumida la oportunidad", () => {
  const { mano, estado } = baseFlorDosVsDos();
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const oportunidad = ejecutarAccionCoordinada(b.estado, {
    tipo: "jugar-carta",
    jugador: "a",
    carta: mano.manos.find((m) => m.jugador === "a").cartas[0],
  });
  const juegaB = ejecutarAccionCoordinada(oportunidad.estado, {
    tipo: "jugar-carta",
    jugador: "b",
    carta: mano.manos.find((m) => m.jugador === "b").cartas[0],
  });
  const pierdeC = ejecutarAccionCoordinada(juegaB.estado, {
    tipo: "jugar-carta",
    jugador: "c",
    carta: mano.manos.find((m) => m.jugador === "c").cartas[0],
  });
  assert.equal(pierdeC.estado.flor.cerrado, false);
  const cierre = ejecutarAccionCoordinada(pierdeC.estado, {
    tipo: "jugar-carta",
    jugador: "d",
    carta: mano.manos.find((m) => m.jugador === "d").cartas[0],
  });
  assert.equal(cierre.estado.flor.cerrado, true);
  assert.deepEqual(cierre.estado.flor.derechosPerdidos, ["c", "d"]);
  assert.deepEqual(cierre.estado.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "sin-desafio" },
    { equipo: "B", puntos: 3, motivo: "sin-desafio" },
  ]);
  assert.equal(cierre.eventos.filter((evento) => evento.tipo === "flor-adjudicada").length, 1);
});

test("Contra Flor al Resto diferida integra el resultado terminal al cerrar por anuncio o carta", () => {
  for (const cierrePor of ["anuncio", "carta"]) {
    const { mano, estado } = baseFlorDosVsDos();
    const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
    const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
    const propuesta = ejecutarAccionCoordinada(b.estado, {
      tipo: "proponer-contra-flor-al-resto",
      jugador: "a",
    });
    const aceptada = ejecutarAccionCoordinada(propuesta.estado, {
      tipo: "quiero-contra-flor-al-resto",
      jugador: "b",
    });
    const oportunidad = ejecutarAccionCoordinada(aceptada.estado, {
      tipo: "jugar-carta",
      jugador: "a",
      carta: mano.manos.find((m) => m.jugador === "a").cartas[0],
    });
    const cierre =
      cierrePor === "anuncio"
        ? ejecutarAccionCoordinada(
            ejecutarAccionCoordinada(oportunidad.estado, { tipo: "anunciar-flor", jugador: "c" })
              .estado,
            { tipo: "anunciar-flor", jugador: "d" },
          )
        : ejecutarAccionCoordinada(
            ejecutarAccionCoordinada(
              ejecutarAccionCoordinada(oportunidad.estado, {
                tipo: "jugar-carta",
                jugador: "b",
                carta: mano.manos.find((m) => m.jugador === "b").cartas[0],
              }).estado,
              {
                tipo: "jugar-carta",
                jugador: "c",
                carta: mano.manos.find((m) => m.jugador === "c").cartas[0],
              },
            ).estado,
            {
              tipo: "jugar-carta",
              jugador: "d",
              carta: mano.manos.find((m) => m.jugador === "d").cartas[0],
            },
          );
    assert.deepEqual(cierre.estado.resultadoPartida, {
      motivo: "contra-flor-al-resto",
      equipoGanador: cierrePor === "anuncio" ? "B" : "A",
    });
    assert.equal(cierre.estado.flor.resultadoTerminal.equipo, cierrePor === "anuncio" ? "B" : "A");
    assert.equal(
      cierre.eventos.filter((evento) => evento.tipo === "partida-terminada-contra-flor-al-resto")
        .length,
      1,
    );
    const antes = JSON.stringify(cierre.estado);
    const posterior = ejecutarAccionCoordinada(cierre.estado, {
      tipo: "jugar-carta",
      jugador: "b",
      carta: mano.manos.find((m) => m.jugador === "b").cartas[1],
    });
    assert.equal(posterior.rechazo.codigo, "partida-finalizada");
    assert.equal(JSON.stringify(cierre.estado), antes);
  }
});

test("Flor cancela Envido pendiente sin puntos y no permite reabrirlo", () => {
  const { estado } = baseFlor();
  const pendiente = iniciarEnvido(
    estado.envido,
    obtenerContextoEnvido(estado.juego, estado.contextoInicio),
    "a",
    "envido",
  );
  assert.equal(pendiente.aceptada, true);
  const preparado = { ...estado, envido: pendiente.estado };
  const antes = JSON.stringify(preparado);
  const flor = ejecutarAccionCoordinada(preparado, { tipo: "anunciar-flor", jugador: "a" });
  assert.equal(flor.aceptada, true);
  assert.equal(flor.estado.envido.pendiente, null);
  assert.deepEqual(flor.estado.envido.resueltos, []);
  assert.deepEqual(flor.estado.envido.cancelacionPorFlor, {
    causa: "cancelado-por-flor",
    jugadorFlor: "a",
    equipoFlor: "A",
    historial: pendiente.estado.pendiente.cantos,
  });
  assert.equal(flor.eventos.at(-1).tipo, "envido-cancelado-por-flor");
  assert.equal(JSON.stringify(preparado), antes);
  for (const estadoAdulterado of [
    { ...flor.estado, flor: { ...flor.estado.flor, anuncios: [] } },
    {
      ...flor.estado,
      envido: {
        ...flor.estado.envido,
        cancelacionPorFlor: { ...flor.estado.envido.cancelacionPorFlor, jugadorFlor: "b", equipoFlor: "B" },
      },
    },
  ]) {
    const antesAdulterado = JSON.stringify(estadoAdulterado);
    assert.equal(
      ejecutarAccionCoordinada(estadoAdulterado, { tipo: "anunciar-flor", jugador: "a" }).rechazo
        .codigo,
      "estado-invalido",
    );
    assert.equal(JSON.stringify(estadoAdulterado), antesAdulterado);
  }
  assert.equal(
    ejecutarAccionCoordinada(flor.estado, {
      tipo: "iniciar-envido",
      jugador: "a",
      canto: "envido",
    }).aceptada,
    false,
  );
});

test("Flor no anunciada o desafío pendiente rechazan Envido sin mutar", () => {
  const { estado } = baseFlor();
  const antes = JSON.stringify(estado);
  const bloqueado = ejecutarAccionCoordinada(estado, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  assert.equal(bloqueado.rechazo.codigo, "flor-no-anunciada");
  assert.equal(JSON.stringify(estado), antes);
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const desafio = ejecutarAccionCoordinada(b.estado, {
    tipo: "proponer-contra-flor",
    jugador: "a",
  });
  const envido = ejecutarAccionCoordinada(desafio.estado, {
    tipo: "no-quiero-envido",
    jugador: "b",
  });
  assert.equal(envido.rechazo.codigo, "flor-pendiente");
});

test("coordinador rechaza historiales terminales y derechos de Flor incoherentes sin mutar", () => {
  const { estado } = baseFlor();
  const terminalSinFlor = {
    ...estado,
    resultadoPartida: { motivo: "contra-flor-al-resto", equipoGanador: "A" },
  };
  const antesTerminal = JSON.stringify(terminalSinFlor);
  const rTerminal = ejecutarAccionCoordinada(terminalSinFlor, {
    tipo: "anunciar-flor",
    jugador: "a",
  });
  assert.equal(rTerminal.rechazo.codigo, "estado-invalido");
  assert.equal(JSON.stringify(terminalSinFlor), antesTerminal);
  const a = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const b = ejecutarAccionCoordinada(a.estado, { tipo: "anunciar-flor", jugador: "b" });
  const propuestaTerminal = ejecutarAccionCoordinada(b.estado, {
    tipo: "proponer-contra-flor-al-resto",
    jugador: "a",
  });
  const terminal = ejecutarAccionCoordinada(propuestaTerminal.estado, {
    tipo: "quiero-contra-flor-al-resto",
    jugador: "b",
  });
  const ganadorIncorrecto = {
    ...terminal.estado,
    resultadoPartida: { motivo: "contra-flor-al-resto", equipoGanador: "B" },
  };
  assert.equal(
    ejecutarAccionCoordinada(ganadorIncorrecto, { tipo: "anunciar-flor", jugador: "a" }).rechazo
      .codigo,
    "estado-invalido",
  );
  const derechoSinCarta = { ...estado, flor: { ...estado.flor, derechosPerdidos: ["a"] } };
  assert.equal(
    ejecutarAccionCoordinada(derechoSinCarta, { tipo: "anunciar-flor", jugador: "a" }).rechazo
      .codigo,
    "estado-invalido",
  );
  const anuncio = ejecutarAccionCoordinada(estado, { tipo: "anunciar-flor", jugador: "a" });
  const pendiente = iniciarEnvido(
    estado.envido,
    obtenerContextoEnvido(estado.juego, estado.contextoInicio),
    "a",
    "envido",
  );
  const conflicto = { ...anuncio.estado, envido: pendiente.estado };
  assert.equal(
    ejecutarAccionCoordinada(conflicto, { tipo: "anunciar-flor", jugador: "b" }).rechazo.codigo,
    "estado-invalido",
  );
});
