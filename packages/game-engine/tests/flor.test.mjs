import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anunciarFlor,
  calcularTantoFlor,
  consumirOportunidadDesafioFlor,
  crearEstadoFlor,
  esEstadoFlorValido,
  perderDerechoFlor,
  proponerContraFlor,
  proponerContraFlorAlResto,
  responderContraFlor,
  responderContraFlorAlResto,
  liquidarFlorPorRetiro,
} from "../dist/index.js";
const c = (palo, valor) => ({ palo, valor });
const contexto = (turno = "a", jugo = false) => ({
  muestra: c("oro", 2),
  jugadorTurno: turno,
  ordenMano: ["a", "b"],
  desempate: false,
  faseFlorConfirmada: false,
  jugadores: [
    {
      id: "a",
      equipo: "A",
      cartas: [c("copa", 3), c("copa", 6), c("copa", 7)],
      jugoPrimeraCarta: jugo,
    },
    {
      id: "b",
      equipo: "B",
      cartas: [c("espada", 1), c("basto", 6), c("oro", 7)],
      jugoPrimeraCarta: false,
    },
  ],
});
const contextoContra = () => ({
  muestra: c("oro", 2),
  jugadorTurno: "a",
  ordenMano: ["a", "b"],
  desempate: false,
  faseFlorConfirmada: false,
  jugadores: [
    {
      id: "a",
      equipo: "A",
      cartas: [c("copa", 3), c("copa", 6), c("copa", 7)],
      jugoPrimeraCarta: false,
    },
    {
      id: "b",
      equipo: "B",
      cartas: [c("espada", 3), c("espada", 6), c("espada", 7)],
      jugoPrimeraCarta: false,
    },
  ],
});
const florPorEquipo = () => {
  const x = contextoContra();
  const a = anunciarFlor(crearEstadoFlor(), x, "a");
  return { x, estado: anunciarFlor(a.estado, x, "b").estado };
};
test("retiro en Contra Flor pendiente cancela al proponente y rechaza implícitamente al respondedor", () => {
  const { x, estado } = florPorEquipo();
  const pendiente = proponerContraFlor(estado, x, "a").estado;
  const antes = JSON.stringify(pendiente);
  const cancelado = liquidarFlorPorRetiro(pendiente, x, "a");
  assert.equal(cancelado.aceptada, true);
  assert.equal(cancelado.estado.historialDesafios[0].respuesta, "cancelado-por-retiro");
  assert.deepEqual(
    cancelado.estado.adjudicaciones.map((a) => a.puntos),
    [0, 3],
  );
  assert.equal(esEstadoFlorValido(cancelado.estado, x), true);
  assert.equal(JSON.stringify(pendiente), antes);
  const rechazo = liquidarFlorPorRetiro(pendiente, x, "b");
  assert.equal(rechazo.aceptada, true);
  assert.equal(rechazo.estado.historialDesafios[0].respuesta, "rechazo-implicito-por-retiro");
  assert.deepEqual(
    rechazo.estado.adjudicaciones.map((a) => a.puntos),
    [3, 0],
  );
  assert.equal(esEstadoFlorValido(rechazo.estado, x), true);
});
test("retiro conserva Flor ordinaria anunciada sin desafío", () => {
  const x = contexto();
  const una = anunciarFlor(crearEstadoFlor(), x, "a").estado;
  const r = liquidarFlorPorRetiro(una, x, "a");
  assert.equal(r.aceptada, true);
  assert.deepEqual(
    r.estado.adjudicaciones.map((a) => a.puntos),
    [3, 0],
  );
  assert.equal(esEstadoFlorValido(r.estado, x), true);
  const ambas = florPorEquipo();
  const dos = liquidarFlorPorRetiro(ambas.estado, ambas.x, "a");
  assert.equal(dos.aceptada, true);
  assert.deepEqual(
    dos.estado.adjudicaciones.map((a) => a.puntos),
    [3, 3],
  );
  assert.equal(esEstadoFlorValido(dos.estado, ambas.x), true);
});

test("retiro en Contra Flor al Resto pendiente no crea victoria automática", () => {
  const { x, estado } = florPorEquipo();
  const pendiente = proponerContraFlorAlResto(estado, x, "a").estado;
  const cancelado = liquidarFlorPorRetiro(pendiente, x, "a");
  assert.equal(cancelado.aceptada, true);
  assert.equal(cancelado.estado.resultadoTerminal, null);
  assert.deepEqual(
    cancelado.estado.adjudicaciones.map((a) => a.puntos),
    [0, 3],
  );
  const rechazo = liquidarFlorPorRetiro(pendiente, x, "b");
  assert.equal(rechazo.aceptada, true);
  assert.equal(rechazo.estado.resultadoTerminal, null);
  assert.deepEqual(
    rechazo.estado.adjudicaciones.map((a) => a.puntos),
    [3, 0],
  );
});
test("validación histórica de Flor rechaza anuncios, desafíos y cierres adulterados", () => {
  const sinFlor = contexto();
  assert.equal(
    esEstadoFlorValido(
      { ...crearEstadoFlor(), anuncios: [{ jugador: "b", equipo: "B" }] },
      sinFlor,
    ),
    false,
  );
  const { x, estado } = florPorEquipo();
  assert.equal(esEstadoFlorValido(estado, x), true);
  assert.equal(
    esEstadoFlorValido(
      {
        ...estado,
        pendiente: {
          tipo: "contra-flor",
          proponente: "a",
          equipoProponente: "A",
          equipoRespondedor: "B",
        },
        historialDesafios: [
          { tipo: "contra-flor-al-resto", proponente: "a", equipo: "A", respuesta: null },
        ],
      },
      x,
    ),
    false,
  );
  const propuesta = proponerContraFlor(estado, x, "a");
  const cerrada = responderContraFlor(
    propuesta.estado,
    { ...x, faseFlorConfirmada: true },
    "b",
    "quiero",
  );
  assert.equal(cerrada.aceptada, true);
  assert.equal(
    esEstadoFlorValido(
      {
        ...cerrada.estado,
        adjudicaciones: [{ equipo: "A", puntos: 99, motivo: "aceptacion" }],
      },
      { ...x, faseFlorConfirmada: true },
    ),
    false,
  );
  assert.equal(
    esEstadoFlorValido(
      {
        ...cerrada.estado,
        adjudicaciones: [],
        resultadoTerminal: { tipo: "contra-flor-al-resto-ganada", equipo: "A" },
      },
      { ...x, faseFlorConfirmada: true },
    ),
    false,
  );
});
test("validación histórica conserva estados intermedios legítimos", () => {
  const { x, estado } = florPorEquipo();
  const pendiente = proponerContraFlor(estado, x, "a");
  assert.equal(esEstadoFlorValido(pendiente.estado, x), true);
  const oportunidad = consumirOportunidadDesafioFlor(estado, x);
  assert.equal(oportunidad.aceptada, true);
  assert.equal(esEstadoFlorValido(oportunidad.estado, x), true);
});
test("Contra Flor: propuesta válida crea pendiente sin mutar", () => {
  const { x, estado } = florPorEquipo(),
    antes = JSON.stringify(estado),
    r = proponerContraFlor(estado, x, "a");
  assert.equal(r.aceptada, true);
  assert.equal(r.estado.pendiente.tipo, "contra-flor");
  assert.equal(r.eventos[0].tipo, "contra-flor-propuesta");
  assert.equal(JSON.stringify(estado), antes);
});
test("Contra Flor: Quiero registra historial y elimina pendiente", () => {
  const { x, estado } = florPorEquipo(),
    p = proponerContraFlor(estado, x, "a"),
    antes = JSON.stringify(p.estado),
    r = responderContraFlor(p.estado, x, "b", "quiero");
  assert.equal(r.aceptada, true);
  assert.equal(r.estado.pendiente, null);
  assert.equal(r.estado.historialDesafios[0].respuesta, "quiero");
  assert.equal(JSON.stringify(p.estado), antes);
});
test("Contra Flor: No Quiero bloquea receptor y conserva proponente", () => {
  const x = {
    ...contextoContra(),
    ordenMano: ["a", "b", "c"],
    jugadores: [
      ...contextoContra().jugadores,
      {
        id: "c",
        equipo: "B",
        cartas: [c("basto", 3), c("basto", 6), c("basto", 7)],
        jugoPrimeraCarta: false,
      },
    ],
  };
  const a = anunciarFlor(crearEstadoFlor(), x, "a"),
    estado = anunciarFlor(a.estado, x, "b").estado,
    p = proponerContraFlor(estado, x, "a"),
    antes = JSON.stringify(p.estado),
    r = responderContraFlor(p.estado, x, "b", "no-quiero");
  assert.equal(r.aceptada, true);
  assert.ok(r.estado.derechosPerdidos.includes("c"));
  assert.ok(!r.estado.derechosPerdidos.includes("a"));
  assert.equal(JSON.stringify(p.estado), antes);
});
test("Contra Flor rechaza requisitos, duplicados y proponente inválido sin mutar", () => {
  const x = contextoContra(),
    e = crearEstadoFlor(),
    antes = JSON.stringify(e);
  assert.equal(proponerContraFlor(e, x, "a").aceptada, false);
  assert.equal(JSON.stringify(e), antes);
  const { estado } = florPorEquipo(),
    p = proponerContraFlor(estado, x, "a");
  assert.equal(proponerContraFlor(p.estado, x, "a").aceptada, false);
  assert.equal(proponerContraFlor(estado, x, "nadie").aceptada, false);
});
test("Contra Flor rechaza respuesta incorrecta o repetida", () => {
  const { x, estado } = florPorEquipo(),
    p = proponerContraFlor(estado, x, "a"),
    antes = JSON.stringify(p.estado);
  assert.equal(responderContraFlor(p.estado, x, "a", "quiero").aceptada, false);
  assert.equal(JSON.stringify(p.estado), antes);
  const q = responderContraFlor(p.estado, x, "b", "quiero");
  assert.equal(responderContraFlor(q.estado, x, "b", "quiero").aceptada, false);
});
test("Contra Flor al Resto: propuesta directa válida registra historial y evento sin mutar", () => {
  const { x, estado } = florPorEquipo(),
    antes = JSON.stringify(estado),
    r = proponerContraFlorAlResto(estado, x, "a");
  assert.equal(r.aceptada, true);
  assert.equal(r.estado.pendiente.tipo, "contra-flor-al-resto");
  assert.deepEqual(r.estado.historialDesafios[0], {
    tipo: "contra-flor-al-resto",
    proponente: "a",
    equipo: "A",
    respuesta: null,
  });
  assert.equal(r.eventos[0].tipo, "contra-flor-al-resto-propuesta");
  assert.equal(JSON.stringify(estado), antes);
});
test("Contra Flor al Resto: puede aumentar Contra Flor y solo responde el equipo original", () => {
  const { x, estado } = florPorEquipo(),
    contra = proponerContraFlor(estado, x, "a"),
    r = proponerContraFlorAlResto(contra.estado, x, "b");
  assert.equal(r.aceptada, true);
  assert.equal(r.estado.pendiente.proponente, "b");
  assert.equal(r.estado.pendiente.equipoRespondedor, "A");
  assert.equal(responderContraFlorAlResto(r.estado, x, "b", "quiero").aceptada, false);
  const aceptada = responderContraFlorAlResto(r.estado, x, "a", "quiero");
  assert.equal(aceptada.aceptada, true);
  assert.equal(aceptada.estado.pendiente, null);
  assert.equal(aceptada.estado.historialDesafios[0].respuesta, "quiero");
  assert.equal(aceptada.eventos[0].tipo, "contra-flor-al-resto-aceptada");
});
test("Contra Flor al Resto: rechazo bloquea receptor, conserva proponente y evita duplicados", () => {
  const x = {
    ...contextoContra(),
    ordenMano: ["a", "b", "c"],
    jugadores: [
      ...contextoContra().jugadores,
      {
        id: "c",
        equipo: "B",
        cartas: [c("basto", 3), c("basto", 6), c("basto", 7)],
        jugoPrimeraCarta: false,
      },
    ],
  };
  const a = anunciarFlor(crearEstadoFlor(), x, "a"),
    estado = anunciarFlor(a.estado, x, "b").estado,
    propuesta = proponerContraFlorAlResto(estado, x, "a"),
    antes = JSON.stringify(propuesta.estado),
    r = responderContraFlorAlResto(propuesta.estado, x, "b", "no-quiero");
  assert.equal(r.aceptada, true);
  assert.ok(r.estado.derechosPerdidos.includes("c"));
  assert.ok(!r.estado.derechosPerdidos.includes("a"));
  assert.equal(r.eventos[0].tipo, "contra-flor-al-resto-rechazada");
  assert.equal(JSON.stringify(propuesta.estado), antes);
  assert.equal(proponerContraFlorAlResto(propuesta.estado, x, "a").aceptada, false);
  assert.equal(responderContraFlorAlResto(r.estado, x, "b", "no-quiero").aceptada, false);
});
test("Contra Flor al Resto rechaza secuencias, jugadores y equipos inválidos", () => {
  const x = contextoContra(),
    vacio = crearEstadoFlor(),
    { estado } = florPorEquipo();
  assert.equal(proponerContraFlorAlResto(vacio, x, "a").aceptada, false);
  assert.equal(proponerContraFlorAlResto(estado, x, "nadie").aceptada, false);
  const propuesta = proponerContraFlorAlResto(estado, x, "a");
  assert.equal(proponerContraFlorAlResto(propuesta.estado, x, "b").aceptada, false);
  assert.equal(responderContraFlorAlResto(propuesta.estado, x, "nadie", "quiero").aceptada, false);
});
test("rechazo impide anuncios y derechos múltiples cierran al último", () => {
  const x = {
    ...contextoContra(),
    jugadores: [
      ...contextoContra().jugadores,
      {
        id: "c",
        equipo: "B",
        cartas: [c("basto", 3), c("basto", 6), c("basto", 7)],
        jugoPrimeraCarta: false,
      },
    ],
  };
  let s = anunciarFlor(crearEstadoFlor(), x, "a").estado;
  s = anunciarFlor(s, x, "b").estado;
  const r = responderContraFlor(proponerContraFlor(s, x, "a").estado, x, "b", "no-quiero");
  assert.equal(anunciarFlor(r.estado, x, "c").aceptada, false);
  const y = {
    ...contextoContra(),
    faseFlorConfirmada: true,
    jugadores: contextoContra().jugadores.map((j) => (j.id === "b" ? { ...j, equipo: "A" } : j)),
  };
  let z = anunciarFlor(crearEstadoFlor(), y, "a");
  assert.equal(z.estado.cerrado, false);
  z = perderDerechoFlor(z.estado, y, "b");
  assert.equal(z.estado.cerrado, true);
});
test("Flor detecta tanto, anuncio, turno y duplicación", () => {
  assert.deepEqual(calcularTantoFlor(contexto().jugadores[0].cartas, c("oro", 2)), {
    tieneFlor: true,
    tanto: 36,
  });
  const e = crearEstadoFlor();
  assert.equal(anunciarFlor(e, contexto("b"), "a").aceptada, false);
  const a = anunciarFlor(e, contexto(), "a");
  assert.equal(a.aceptada, true);
  assert.equal(anunciarFlor(a.estado, contexto(), "a").aceptada, false);
});
test("Flor pierde derecho sin mutar y cierra al agotarlo", () => {
  const e = crearEstadoFlor(),
    antes = JSON.stringify(e);
  const r = perderDerechoFlor(e, { ...contexto("a", false), faseFlorConfirmada: true }, "a");
  assert.equal(r.aceptada, true);
  assert.equal(JSON.stringify(e), antes);
  assert.equal(r.estado.cerrado, true);
  assert.equal(anunciarFlor(r.estado, contexto(), "a").aceptada, false);
});
test("Flor sin desafío se adjudica una vez al cerrar todos los derechos", () => {
  const x = {
    ...contextoContra(),
    faseFlorConfirmada: true,
    jugadores: contextoContra().jugadores.map((j) => ({ ...j, equipo: "A" })),
  };
  const a = anunciarFlor(crearEstadoFlor(), x, "a"),
    antes = JSON.stringify(a.estado),
    r = anunciarFlor(a.estado, x, "b");
  assert.equal(r.aceptada, true);
  assert.equal(r.estado.cerrado, true);
  assert.deepEqual(r.estado.adjudicaciones, [{ equipo: "A", puntos: 6, motivo: "sin-desafio" }]);
  assert.equal(r.eventos.at(-1).tipo, "flor-adjudicada");
  assert.equal(JSON.stringify(a.estado), antes);
  assert.equal(perderDerechoFlor(r.estado, x, "a").aceptada, false);
});
test("1v1 con dos Flores espera confirmación y luego adjudica sin desafío", () => {
  const x = contextoContra(),
    a = anunciarFlor(crearEstadoFlor(), x, "a"),
    r = anunciarFlor(a.estado, { ...x, faseFlorConfirmada: true }, "b");
  assert.equal(a.estado.cerrado, false);
  assert.equal(r.estado.cerrado, true);
  assert.deepEqual(r.estado.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "sin-desafio" },
    { equipo: "B", puntos: 3, motivo: "sin-desafio" },
  ]);
});
test("1v1 con dos Flores conserva Contra Flor hasta que se confirma al responder", () => {
  const x = contextoContra(),
    a = anunciarFlor(crearEstadoFlor(), x, "a"),
    flores = anunciarFlor(a.estado, x, "b"),
    propuesta = proponerContraFlor(flores.estado, x, "a"),
    r = responderContraFlor(propuesta.estado, { ...x, faseFlorConfirmada: true }, "b", "quiero");
  assert.equal(flores.estado.cerrado, false);
  assert.equal(propuesta.estado.adjudicaciones.length, 0);
  assert.equal(r.estado.cerrado, true);
  assert.equal(r.estado.adjudicaciones.length, 2);
});
test("Contra Flor aceptada adjudica al máximo y desempata por orden de mano", () => {
  const { x, estado } = florPorEquipo(),
    empateFavoreceB = { ...x, ordenMano: ["b", "a"] },
    propuesta = proponerContraFlor(estado, empateFavoreceB, "a"),
    r = responderContraFlor(
      propuesta.estado,
      { ...empateFavoreceB, faseFlorConfirmada: true },
      "b",
      "quiero",
    );
  assert.equal(r.aceptada, true);
  assert.equal(r.estado.cerrado, true);
  assert.deepEqual(r.estado.adjudicaciones, [
    { equipo: "A", puntos: 0, motivo: "aceptacion" },
    { equipo: "B", puntos: 3, motivo: "aceptacion" },
  ]);
  assert.equal(r.eventos.at(-1).tipo, "flor-adjudicada");
});
test("rechazo de Contra Flor cuenta anuncios posteriores del proponente antes de adjudicar", () => {
  const x = {
    ...contextoContra(),
    ordenMano: ["a", "b", "c"],
    faseFlorConfirmada: true,
    jugadores: [
      ...contextoContra().jugadores,
      {
        id: "c",
        equipo: "A",
        cartas: [c("basto", 3), c("basto", 6), c("basto", 7)],
        jugoPrimeraCarta: false,
      },
    ],
  };
  const a = anunciarFlor(crearEstadoFlor(), x, "a"),
    flores = anunciarFlor(a.estado, x, "b"),
    desafio = proponerContraFlor(flores.estado, x, "a"),
    rechazo = responderContraFlor(desafio.estado, x, "b", "no-quiero"),
    r = anunciarFlor(rechazo.estado, x, "c");
  assert.equal(rechazo.estado.cerrado, false);
  assert.equal(r.estado.cerrado, true);
  assert.deepEqual(r.estado.adjudicaciones, [
    { equipo: "A", puntos: 6, motivo: "rechazo" },
    { equipo: "B", puntos: 0, motivo: "rechazo" },
  ]);
});
test("Contra Flor al Resto aceptada declara victoria o tres puntos en desempate", () => {
  const { x, estado } = florPorEquipo(),
    propuesta = proponerContraFlorAlResto(estado, x, "a"),
    antes = JSON.stringify(propuesta.estado),
    ordinaria = responderContraFlorAlResto(
      propuesta.estado,
      { ...x, faseFlorConfirmada: true },
      "b",
      "quiero",
    );
  assert.equal(ordinaria.estado.resultadoTerminal.equipo, "A");
  assert.deepEqual(ordinaria.estado.adjudicaciones, []);
  assert.equal(ordinaria.eventos.at(-1).tipo, "contra-flor-al-resto-victoria");
  assert.equal(JSON.stringify(propuesta.estado), antes);
  const desempate = { ...x, desempate: true, faseFlorConfirmada: true },
    p = proponerContraFlorAlResto(estado, desempate, "a"),
    r = responderContraFlorAlResto(p.estado, desempate, "b", "quiero");
  assert.deepEqual(r.estado.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "al-resto" },
    { equipo: "B", puntos: 0, motivo: "al-resto" },
  ]);
  assert.equal(r.estado.resultadoTerminal, null);
});
test("Contra Flor al Resto rechazada adjudica sin victoria y estados adjudicados son inmutables", () => {
  const { x, estado } = florPorEquipo(),
    propuesta = proponerContraFlorAlResto(estado, x, "a"),
    r = responderContraFlorAlResto(
      propuesta.estado,
      { ...x, faseFlorConfirmada: true },
      "b",
      "no-quiero",
    );
  assert.deepEqual(r.estado.adjudicaciones, [
    { equipo: "A", puntos: 3, motivo: "rechazo" },
    { equipo: "B", puntos: 0, motivo: "rechazo" },
  ]);
  assert.equal(r.estado.resultadoTerminal, null);
  assert.equal(proponerContraFlorAlResto(r.estado, x, "a").aceptada, false);
  const inconsistente = { ...r.estado, cerrado: false };
  assert.equal(anunciarFlor(inconsistente, x, "a").aceptada, false);
});
