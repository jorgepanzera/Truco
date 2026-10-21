import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anunciarFlor,
  calcularTantoFlor,
  crearEstadoFlor,
  perderDerechoFlor,
  proponerContraFlor,
  responderContraFlor,
} from "../dist/index.js";
const c = (palo, valor) => ({ palo, valor });
const contexto = (turno = "a", jugo = false) => ({
  muestra: c("oro", 2),
  jugadorTurno: turno,
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
  const r = perderDerechoFlor(e, contexto("a", false), "a");
  assert.equal(r.aceptada, true);
  assert.equal(JSON.stringify(e), antes);
  assert.equal(r.estado.cerrado, true);
  assert.equal(anunciarFlor(r.estado, contexto(), "a").aceptada, false);
});
