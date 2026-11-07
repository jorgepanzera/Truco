import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crearEstadoManoCoordinada,
  crearEstadoPartida,
  crearMazo,
  crearObservacionJugadorAutomatico,
  ejecutarAccionPartida,
  evaluarContextoPartido,
  evaluarEnvido,
  evaluarFlor,
  evaluarRiesgoBeneficio,
  iniciarJuegoCartas,
  obtenerAccionesLegalesJugador,
  politicaEstrategicaEnvidoFlor,
  politicaEstrategicaGlobal,
  prepararMano,
  seleccionarAccionEnvido,
  seleccionarAccionFlor,
} from "../dist/index.js";
const c = (palo, valor) => ({ palo, valor });
const mesa = {
  modalidad: "1v1",
  jugadores: [
    { id: "humano", equipo: "H", posicion: 0 },
    { id: "maquina", equipo: "M", posicion: 1 },
  ],
};
function mazoCon(primeras) {
  const ids = new Set(primeras.map((x) => `${x.palo}:${x.valor}`));
  return [...primeras, ...crearMazo().filter((x) => !ids.has(`${x.palo}:${x.valor}`))];
}
function partida(repartidor, primeras, muestra) {
  return crearEstadoPartida(
    crearEstadoManoCoordinada(
      iniciarJuegoCartas(prepararMano(mesa, repartidor, mazoCon([...primeras, muestra]))),
      { metaPuntos: 40, puntajesIniciales: { H: 0, M: 0 }, esDesempate: false },
    ),
  );
}
function aplicar(estado, accion) {
  const r = ejecutarAccionPartida(estado, accion);
  assert.equal(r.aceptada, true, r.aceptada ? "" : r.rechazo.codigo);
  return r.estado;
}
function contexto(estado) {
  const observacion = crearObservacionJugadorAutomatico(estado, "maquina");
  return { observacion, legales: obtenerAccionesLegalesJugador(estado, "maquina") };
}

test("propone y acepta Envido con tantos favorables sin consultar cartas rivales", () => {
  let estado = partida(
    "humano",
    [c("oro", 7), c("copa", 4), c("oro", 6), c("espada", 5), c("espada", 4), c("basto", 2)],
    c("basto", 7),
  );
  let { observacion, legales } = contexto(estado);
  assert.equal(evaluarEnvido(observacion).propio, 33);
  assert.deepEqual(seleccionarAccionEnvido(observacion, legales), {
    tipo: "iniciar-envido",
    canto: "real-envido",
  });
  estado = partida(
    "maquina",
    [c("copa", 4), c("oro", 7), c("espada", 5), c("oro", 6), c("basto", 2), c("espada", 4)],
    c("basto", 7),
  );
  estado = aplicar(estado, { tipo: "iniciar-envido", jugador: "humano", canto: "envido" });
  ({ observacion, legales } = contexto(estado));
  assert.equal(seleccionarAccionEnvido(observacion, legales)?.tipo, "quiero-envido");
});

test("distingue Envido y Falta Envido y no depende del orden de acciones legales", () => {
  const envido = partida(
    "humano",
    [c("oro", 7), c("copa", 4), c("oro", 3), c("espada", 5), c("espada", 4), c("basto", 2)],
    c("basto", 7),
  );
  let { observacion, legales } = contexto(envido);
  assert.deepEqual(seleccionarAccionEnvido(observacion, legales), {
    tipo: "iniciar-envido",
    canto: "envido",
  });
  const falta = partida(
    "humano",
    [c("basto", 2), c("copa", 4), c("oro", 7), c("espada", 5), c("espada", 4), c("basto", 6)],
    c("basto", 7),
  );
  ({ observacion, legales } = contexto(falta));
  const decision = seleccionarAccionEnvido(observacion, legales);
  assert.deepEqual(decision, { tipo: "iniciar-envido", canto: "falta-envido" });
  assert.deepEqual(seleccionarAccionEnvido(observacion, [...legales].reverse()), decision);
});

test("aumenta a Falta Envido sólo con tantos sobresalientes y rechaza el desafío débil", () => {
  let estado = partida(
    "maquina",
    [c("copa", 4), c("basto", 2), c("espada", 5), c("oro", 7), c("basto", 6), c("espada", 4)],
    c("basto", 7),
  );
  estado = aplicar(estado, { tipo: "iniciar-envido", jugador: "humano", canto: "envido" });
  let { observacion, legales } = contexto(estado);
  const aumento = seleccionarAccionEnvido(observacion, legales);
  assert.deepEqual(aumento, { tipo: "aumentar-envido", canto: "falta-envido" });
  assert.deepEqual(seleccionarAccionEnvido(observacion, [...legales].reverse()), aumento);
  estado = partida(
    "maquina",
    [c("oro", 4), c("copa", 4), c("basto", 5), c("oro", 5), c("basto", 6), c("espada", 6)],
    c("basto", 7),
  );
  estado = aplicar(estado, { tipo: "iniciar-envido", jugador: "humano", canto: "envido" });
  ({ observacion, legales } = contexto(estado));
  assert.equal(seleccionarAccionEnvido(observacion, legales)?.tipo, "no-quiero-envido");
});

test("renuncia al Envido débil y anuncia Flor legal antes que otras apuestas", () => {
  let estado = partida(
    "humano",
    [c("espada", 4), c("copa", 1), c("oro", 5), c("espada", 7), c("basto", 6), c("copa", 2)],
    c("basto", 7),
  );
  let { observacion, legales } = contexto(estado);
  assert.equal(seleccionarAccionEnvido(observacion, legales), null);
  estado = partida(
    "humano",
    [c("oro", 4), c("copa", 7), c("oro", 5), c("espada", 6), c("oro", 6), c("basto", 2)],
    c("basto", 7),
  );
  ({ observacion, legales } = contexto(estado));
  assert.equal(evaluarFlor(observacion).propio !== null, true);
  assert.equal(seleccionarAccionFlor(observacion, legales)?.tipo, "anunciar-flor");
  assert.equal(
    politicaEstrategicaEnvidoFlor.decidir({
      observacion,
      accionesLegales: legales,
      aleatoriedad: { siguiente: () => 0 },
    })?.tipo,
    "anunciar-flor",
  );
});

test("Flor simple se valora como puntos seguros sin comparación rival", () => {
  const estado = partida(
    "humano",
    [c("oro", 4), c("copa", 7), c("oro", 5), c("espada", 6), c("oro", 6), c("basto", 2)],
    c("basto", 7),
  );
  const { observacion } = contexto(estado);
  const flor = evaluarFlor(observacion);
  assert.equal(flor.modo, "flor-simple");
  assert.equal(flor.probabilidadGanar, 1);
  assert.equal(flor.muestras, 0);
});

test("el evaluador global distingue cierre y riesgo terminal con la misma mano", () => {
  const estado = partida(
    "humano",
    [c("oro", 7), c("copa", 4), c("oro", 6), c("espada", 5), c("espada", 4), c("basto", 2)],
    c("basto", 7),
  );
  const { observacion } = contexto(estado);
  const cerca = evaluarContextoPartido({ ...observacion, tanteador: { H: 37, M: 36 } });
  const amenazado = evaluarContextoPartido({ ...observacion, tanteador: { H: 37, M: 25 } });
  assert.equal(cerca.cercaDeGanar, true);
  assert.equal(amenazado.riesgoDerrotaInmediata, true);
  assert.ok(evaluarRiesgoBeneficio(cerca, 0.6, 4, 4).utilidadPartido > 0);
  assert.ok(evaluarRiesgoBeneficio(amenazado, 0.6, 4, 4).utilidadPartido < 0);
});

test("la política global compara una apuesta opcional con jugar carta según tanteador", () => {
  const estado = partida(
    "humano",
    [c("oro", 7), c("copa", 4), c("oro", 6), c("espada", 5), c("espada", 4), c("basto", 2)],
    c("basto", 7),
  );
  const { observacion, legales } = contexto(estado);
  const decidir = (tanteador) =>
    politicaEstrategicaGlobal.decidir({
      observacion: { ...observacion, tanteador },
      accionesLegales: [...legales].reverse(),
      aleatoriedad: { siguiente: () => 0 },
    });
  assert.deepEqual(decidir({ H: 0, M: 0 }), { tipo: "iniciar-envido", canto: "real-envido" });
  assert.equal(decidir({ H: 0, M: 25 })?.tipo, "jugar-carta");
});
