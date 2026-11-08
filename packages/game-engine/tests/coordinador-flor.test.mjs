import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contabilizarManoCerrada,
  crearEstadoPartida,
  crearEstadoManoCoordinada,
  crearMazo,
  ejecutarAccionPartida,
  ejecutarAccionCoordinada,
  iniciarJuegoCartas,
  iniciarEnvido,
  obtenerAccionesLegalesJugador,
  obtenerContextoEnvido,
  obtenerContextoFlor,
  prepararMano,
  tieneFlor,
} from "../dist/index.js";

const c = (palo, valor) => ({ palo, valor });
function baseFlorUnilateral(repartidor, jugadorConFlor) {
  const manos = {
    a: [c("espada", 1), c("espada", 3), c("espada", 7)],
    b: [c("copa", 4), c("oro", 6), c("basto", 6)],
  };
  if (jugadorConFlor === "b") [manos.a, manos.b] = [manos.b, manos.a];
  const orden = repartidor === "a" ? ["b", "a"] : ["a", "b"];
  const primeras = [
    manos[orden[0]][0],
    manos[orden[1]][0],
    manos[orden[0]][1],
    manos[orden[1]][1],
    manos[orden[0]][2],
    manos[orden[1]][2],
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
    repartidor,
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
function baseSinFlores(repartidor = "b") {
  const manos = {
    a: [c("espada", 1), c("basto", 3), c("oro", 7)],
    b: [c("copa", 4), c("oro", 6), c("basto", 6)],
  };
  const orden = repartidor === "a" ? ["b", "a"] : ["a", "b"];
  const primeras = [
    manos[orden[0]][0],
    manos[orden[1]][0],
    manos[orden[0]][1],
    manos[orden[1]][1],
    manos[orden[0]][2],
    manos[orden[1]][2],
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
    repartidor,
    mazo,
  );
  return crearEstadoPartida(
    crearEstadoManoCoordinada(iniciarJuegoCartas(mano), {
      metaPuntos: 40,
      puntajesIniciales: { A: 0, B: 0 },
      esDesempate: false,
    }),
  );
}
function ejecutarAccionPartidaValida(partida, accion) {
  const resultado = ejecutarAccionPartida(partida, accion);
  assert.equal(resultado.aceptada, true);
  return resultado.estado;
}
function jugarPrimeraDisponible(partida, jugador) {
  const carta = partida.mano.juego.cartasDisponibles.find((mano) => mano.jugador === jugador)
    .cartas[0];
  return ejecutarAccionPartidaValida(partida, { tipo: "jugar-carta", jugador, carta });
}
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

test("Flor unilateral adjudicada bloquea toda cadena posterior de Envido", () => {
  const { estado } = baseFlorUnilateral("b", "a");
  const partida = crearEstadoPartida(estado);
  const flor = ejecutarAccionPartida(partida, { tipo: "anunciar-flor", jugador: "a" });
  assert.equal(flor.aceptada, true);
  assert.deepEqual(flor.estado.mano.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "sin-desafio" },
    { equipo: "B", puntos: 0, motivo: "sin-desafio" },
  ]);
  const legales = obtenerAccionesLegalesJugador(flor.estado, "a");
  assert.equal(legales.some((accion) => accion.tipo === "iniciar-envido"), false);
  const antesDeIntentos = JSON.stringify(flor.estado);
  for (const canto of ["envido", "real-envido", "falta-envido"]) {
    const intento = ejecutarAccionPartida(flor.estado, {
      tipo: "iniciar-envido",
      jugador: "a",
      canto,
    });
    assert.equal(intento.aceptada, false, canto);
    assert.equal(intento.rechazo.codigo, "flor-ya-anunciada", canto);
    assert.equal(JSON.stringify(flor.estado), antesDeIntentos, canto);
  }
});

test("Flor rival adjudicada bloquea Envido aun al responder Truco pendiente", () => {
  const { estado } = baseFlorUnilateral("b", "b");
  let partida = crearEstadoPartida(estado);
  partida = jugarPrimeraDisponible(partida, "a");
  partida = ejecutarAccionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "b" });
  assert.deepEqual(partida.mano.flor.adjudicaciones, [
    { equipo: "A", puntos: 0, motivo: "sin-desafio" },
    { equipo: "B", puntos: 3, motivo: "sin-desafio" },
  ]);
  partida = ejecutarAccionPartidaValida(partida, { tipo: "proponer-truco", jugador: "b" });
  const trucoAntes = partida.mano.truco;
  const turnoAntes = partida.mano.juego.jugadorTurno;
  const legales = obtenerAccionesLegalesJugador(partida, "a");
  assert.equal(legales.some((accion) => accion.tipo === "iniciar-envido"), false);
  assert.ok(legales.some((accion) => accion.tipo === "quiero-truco"));
  assert.ok(legales.some((accion) => accion.tipo === "no-quiero-truco"));
  assert.ok(legales.some((accion) => accion.tipo === "proponer-retruco"));
  const antesDeIntentos = JSON.stringify(partida);
  for (const canto of ["envido", "real-envido", "falta-envido"]) {
    const intento = ejecutarAccionPartida(partida, {
      tipo: "iniciar-envido",
      jugador: "a",
      canto,
    });
    assert.equal(intento.aceptada, false, canto);
    assert.equal(intento.rechazo.codigo, "flor-ya-anunciada", canto);
    assert.equal(JSON.stringify(partida), antesDeIntentos, canto);
    assert.deepEqual(partida.mano.truco, trucoAntes, canto);
    assert.equal(partida.mano.juego.jugadorTurno, turnoAntes, canto);
  }
});

test("Flor no anunciada del rival no bloquea globalmente un Envido legal", () => {
  const { estado } = baseFlorUnilateral("b", "b");
  const partida = crearEstadoPartida(estado);
  const envido = ejecutarAccionPartida(partida, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  assert.equal(envido.aceptada, true);
  assert.equal(envido.estado.mano.envido.pendiente?.proponente, "a");
});

test("Flor responde Envido, Real Envido y Falta Envido sin cambiar el turno", () => {
  for (const canto of ["envido", "real-envido", "falta-envido"]) {
    const { estado } = baseFlorUnilateral("b", "b");
    let partida = crearEstadoPartida(estado);
    partida = ejecutarAccionPartidaValida(partida, {
      tipo: "iniciar-envido",
      jugador: "a",
      canto,
    });
    assert.equal(partida.mano.envido.pendiente?.equipoRespondedor, "B", canto);
    const turnoAntes = partida.mano.juego.jugadorTurno;
    assert.ok(
      obtenerAccionesLegalesJugador(partida, "b").some((accion) => accion.tipo === "anunciar-flor"),
      canto,
    );
    const flor = ejecutarAccionPartida(partida, { tipo: "anunciar-flor", jugador: "b" });
    assert.equal(flor.aceptada, true, canto);
    assert.equal(flor.estado.mano.juego.jugadorTurno, turnoAntes, canto);
    assert.equal(flor.estado.mano.envido.pendiente, null, canto);
    assert.equal(flor.estado.mano.envido.resueltos.length, 0, canto);
    assert.equal(flor.estado.mano.envido.cancelacionPorFlor?.causa, "cancelado-por-flor", canto);
    assert.deepEqual(flor.estado.mano.flor.adjudicaciones, [
      { equipo: "A", puntos: 0, motivo: "sin-desafio" },
      { equipo: "B", puntos: 3, motivo: "sin-desafio" },
    ]);
    assert.ok(flor.eventos.some((evento) => evento.tipo === "flor-anunciada"), canto);
    assert.ok(flor.eventos.some((evento) => evento.tipo === "envido-cancelado-por-flor"), canto);
    partida = flor.estado;
  }
});

test("Flor ante Envido pendiente no restituye derechos ni habilita al proponente", () => {
  const { estado } = baseFlorUnilateral("a", "b");
  let partida = crearEstadoPartida(estado);
  partida = jugarPrimeraDisponible(partida, "b");
  partida = ejecutarAccionPartidaValida(partida, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const antes = JSON.stringify(partida);
  const perdida = ejecutarAccionPartida(partida, { tipo: "anunciar-flor", jugador: "b" });
  assert.equal(perdida.aceptada, false);
  assert.equal(perdida.rechazo.codigo, "derecho-perdido");
  assert.equal(JSON.stringify(partida), antes);
  const proponente = ejecutarAccionPartida(partida, { tipo: "anunciar-flor", jugador: "a" });
  assert.equal(proponente.aceptada, false);
  assert.equal(proponente.rechazo.codigo, "flor-envido-respondedor-invalido");
  assert.equal(JSON.stringify(partida), antes);
});

test("Flor ante Envido pendiente exige Flor y no habilita anuncio ordinario fuera de turno", () => {
  let sinFlor = baseSinFlores();
  sinFlor = ejecutarAccionPartidaValida(sinFlor, {
    tipo: "iniciar-envido",
    jugador: "a",
    canto: "envido",
  });
  const antesSinFlor = JSON.stringify(sinFlor);
  const inexistente = ejecutarAccionPartida(sinFlor, { tipo: "anunciar-flor", jugador: "b" });
  assert.equal(inexistente.aceptada, false);
  assert.equal(inexistente.rechazo.codigo, "flor-inexistente");
  assert.equal(JSON.stringify(sinFlor), antesSinFlor);

  const { estado } = baseFlorUnilateral("b", "b");
  const fueraDeTurno = ejecutarAccionPartida(crearEstadoPartida(estado), {
    tipo: "anunciar-flor",
    jugador: "b",
  });
  assert.equal(fueraDeTurno.aceptada, false);
  assert.equal(fueraDeTurno.rechazo.codigo, "primer-anuncio-fuera-de-turno");
});

test("un retirado no puede anunciar Flor ante Envido pendiente de su equipo", () => {
  const { estado } = baseFlorDosVsDos();
  const pendiente = iniciarEnvido(
    estado.envido,
    obtenerContextoEnvido(estado.juego, estado.contextoInicio),
    "a",
    "envido",
  );
  assert.equal(pendiente.aceptada, true);
  const partida = crearEstadoPartida({ ...estado, envido: pendiente.estado });
  const retiro = ejecutarAccionPartida(partida, { tipo: "irse-al-mazo", jugador: "b" });
  assert.equal(retiro.aceptada, true);
  assert.ok(retiro.estado.mano.envido.pendiente);
  const intento = ejecutarAccionPartida(retiro.estado, { tipo: "anunciar-flor", jugador: "b" });
  assert.equal(intento.aceptada, false);
  assert.equal(intento.rechazo.codigo, "flor-envido-respondedor-invalido");
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
  assert.equal(b.estado.flor.cerrado, false);
  assert.deepEqual(b.estado.flor.adjudicaciones, []);
  assert.equal(
    ejecutarAccionCoordinada(b.estado, { tipo: "proponer-contra-flor", jugador: "a" }).aceptada,
    true,
  );
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

test("Flor propia sin desafio se liquida antes de rechazar Truco rival", () => {
  const { estado } = baseFlorUnilateral("b", "a");
  let partida = crearEstadoPartida(estado);
  partida = ejecutarAccionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "a" });
  assert.deepEqual(partida.mano.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "sin-desafio" },
    { equipo: "B", puntos: 0, motivo: "sin-desafio" },
  ]);
  partida = jugarPrimeraDisponible(partida, "a");
  partida = ejecutarAccionPartidaValida(partida, { tipo: "proponer-truco", jugador: "b" });
  partida = ejecutarAccionPartidaValida(partida, { tipo: "no-quiero-truco", jugador: "a" });
  const contabilizada = contabilizarManoCerrada(partida);
  assert.equal(contabilizada.aceptada, true);
  assert.deepEqual(contabilizada.estado.manosContabilizadas[0].puntos, { A: 3, B: 1 });
});

test("Con Flor Quiero liquida Flor una vez y conserva Truco ganado por bazas", () => {
  const { estado } = baseFlorUnilateral("a", "a");
  let partida = crearEstadoPartida(estado);
  partida = ejecutarAccionPartidaValida(partida, { tipo: "proponer-truco", jugador: "b" });
  partida = ejecutarAccionPartidaValida(partida, { tipo: "con-flor-quiero", jugador: "a" });
  assert.deepEqual(partida.mano.flor.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "sin-desafio" },
    { equipo: "B", puntos: 0, motivo: "sin-desafio" },
  ]);
  partida = jugarPrimeraDisponible(partida, "b");
  partida = jugarPrimeraDisponible(partida, "a");
  partida = jugarPrimeraDisponible(partida, "a");
  partida = jugarPrimeraDisponible(partida, "b");
  assert.deepEqual(partida.mano.adjudicacionTruco, {
    causa: "mano-por-bazas",
    equipo: "A",
    puntos: 2,
    nivelAceptado: "truco",
  });
  const contabilizada = contabilizarManoCerrada(partida);
  assert.equal(contabilizada.aceptada, true);
  assert.deepEqual(contabilizada.estado.manosContabilizadas[0].puntos, { A: 5, B: 0 });
  assert.equal(contabilizarManoCerrada(contabilizada.estado).aceptada, false);
});

test("Flor de la maquina se liquida junto al Truco que el humano rechaza", () => {
  const { estado } = baseFlorUnilateral("a", "b");
  const cartasJorge = estado.juego.mano.manos.find((mano) => mano.jugador === "a")?.cartas;
  assert.ok(cartasJorge);
  assert.equal(tieneFlor(cartasJorge, estado.juego.mano.muestra), false);
  let partida = crearEstadoPartida(estado);
  partida = ejecutarAccionPartidaValida(partida, { tipo: "anunciar-flor", jugador: "b" });
  assert.equal(partida.mano.flor.cerrado, true);
  assert.equal(partida.mano.flor.pendiente, null);
  partida = ejecutarAccionPartidaValida(partida, { tipo: "proponer-truco", jugador: "b" });
  partida = ejecutarAccionPartidaValida(partida, { tipo: "no-quiero-truco", jugador: "a" });
  const contabilizada = contabilizarManoCerrada(partida);
  assert.equal(contabilizada.aceptada, true);
  assert.deepEqual(contabilizada.estado.manosContabilizadas[0].puntos, { A: 0, B: 4 });
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
  const flor = ejecutarAccionCoordinada(preparado, { tipo: "anunciar-flor", jugador: "b" });
  assert.equal(flor.aceptada, true);
  assert.equal(flor.estado.envido.pendiente, null);
  assert.deepEqual(flor.estado.envido.resueltos, []);
  assert.deepEqual(flor.estado.envido.cancelacionPorFlor, {
    causa: "cancelado-por-flor",
    jugadorFlor: "b",
    equipoFlor: "B",
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
        cancelacionPorFlor: {
          ...flor.estado.envido.cancelacionPorFlor,
          jugadorFlor: "a",
          equipoFlor: "A",
        },
      },
    },
  ]) {
    const antesAdulterado = JSON.stringify(estadoAdulterado);
    assert.equal(
      ejecutarAccionCoordinada(estadoAdulterado, { tipo: "anunciar-flor", jugador: "b" }).rechazo
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
