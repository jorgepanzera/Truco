import type { Carta } from "@truco/shared";
import { calcularFaltaEnvido, calcularTantoEnvido } from "./envido.js";
import { calcularTantoFlor } from "./flor.js";
import { crearMazo, identificarCarta } from "./cartas.js";
import { politicaEstrategicaTruco } from "./estrategia-truco.js";
import type {
  AccionAutomatica,
  ContextoPoliticaEstrategica,
  ObservacionJugadorAutomatico,
  PoliticaEstrategica,
} from "./jugador-automatico.js";

export type EvaluacionComparacion = Readonly<{
  propio: number | null;
  probabilidadGanar: number;
  probabilidadEmpatar: number;
  probabilidadPerder: number;
  muestras: number;
}>;
export type EvaluacionFlor = EvaluacionComparacion &
  Readonly<{ modo: "sin-flor" | "flor-simple" | "desafio"; esDesempate: boolean }>;
const tipo = (acciones: readonly AccionAutomatica[], nombre: AccionAutomatica["tipo"]) =>
  acciones.find((accion) => accion.tipo === nombre) ?? null;
const cartasPublicas = (o: ObservacionJugadorAutomatico) => [
  ...o.bazas.flatMap((b) => b.jugadas),
  ...o.bazaActual.jugadas,
];
const propiasOriginales = (o: ObservacionJugadorAutomatico) => [
  ...o.cartasPropias,
  ...cartasPublicas(o)
    .filter((j) => j.jugador === o.jugador)
    .map((j) => j.carta),
];
function combinaciones(cartas: readonly Carta[], cantidad: number): Carta[][] {
  if (cantidad === 0) return [[]];
  const resultado: Carta[][] = [];
  for (let indice = 0; indice <= cartas.length - cantidad; indice++)
    for (const resto of combinaciones(cartas.slice(indice + 1), cantidad - 1))
      resultado.push([cartas[indice]!, ...resto]);
  return resultado;
}
function universoRival(o: ObservacionJugadorAutomatico): Carta[][] {
  const publicas = cartasPublicas(o);
  const rivalPublicas = publicas.filter((j) => j.jugador !== o.jugador).map((j) => j.carta);
  const conocidas = new Set([
    identificarCarta(o.muestra),
    ...propiasOriginales(o).map(identificarCarta),
    ...rivalPublicas.map(identificarCarta),
  ]);
  return combinaciones(
    crearMazo().filter((c) => !conocidas.has(identificarCarta(c))),
    3 - rivalPublicas.length,
  ).map((resto) => [...rivalPublicas, ...resto]);
}
/** Enumeración aproximada sobre combinaciones desconocidas; no conoce el reparto ni la mano rival. */
export function evaluarEnvido(o: ObservacionJugadorAutomatico): EvaluacionComparacion {
  const propio = calcularTantoEnvido(propiasOriginales(o), o.muestra);
  if (propio.tieneFlor)
    return {
      propio: null,
      probabilidadGanar: 0,
      probabilidadEmpatar: 0,
      probabilidadPerder: 1,
      muestras: 0,
    };
  let ganar = 0,
    empatar = 0,
    perder = 0;
  for (const mano of universoRival(o)) {
    const rival = calcularTantoEnvido(mano, o.muestra);
    if (rival.tieneFlor || rival.tanto > propio.tanto) perder++;
    else if (rival.tanto < propio.tanto) ganar++;
    else if (o.manoOriginal === o.jugador) ganar++;
    else empatar++;
  }
  const total = ganar + empatar + perder || 1;
  return {
    propio: propio.tanto,
    probabilidadGanar: ganar / total,
    probabilidadEmpatar: empatar / total,
    probabilidadPerder: perder / total,
    muestras: total,
  };
}
export function evaluarFlor(o: ObservacionJugadorAutomatico): EvaluacionFlor {
  const propio = calcularTantoFlor(propiasOriginales(o), o.muestra);
  const empate = esDesempate(o);
  if (!propio.tieneFlor)
    return {
      propio: null,
      probabilidadGanar: 0,
      probabilidadEmpatar: 0,
      probabilidadPerder: 1,
      muestras: 0,
      modo: "sin-flor",
      esDesempate: empate,
    };
  const rivalAnuncio = o.desafios.flor.anuncios.some((anuncio) => anuncio.equipo !== o.equipo);
  if (!rivalAnuncio && o.desafios.flor.pendiente === null)
    return {
      propio: propio.tanto,
      probabilidadGanar: 1,
      probabilidadEmpatar: 0,
      probabilidadPerder: 0,
      muestras: 0,
      modo: "flor-simple",
      esDesempate: empate,
    };
  let ganar = 0,
    empatar = 0,
    perder = 0;
  for (const mano of universoRival(o)) {
    const rival = calcularTantoFlor(mano, o.muestra);
    if (!rival.tieneFlor || propio.tanto! > rival.tanto!) ganar++;
    else if (propio.tanto! < rival.tanto!) perder++;
    else if (o.manoOriginal === o.jugador) ganar++;
    else empatar++;
  }
  const total = ganar + empatar + perder || 1;
  return {
    propio: propio.tanto,
    probabilidadGanar: ganar / total,
    probabilidadEmpatar: empatar / total,
    probabilidadPerder: perder / total,
    muestras: total,
    modo: "desafio",
    esDesempate: empate,
  };
}
function elegirEnvido(
  a: readonly AccionAutomatica[],
  tipoAccion: "iniciar-envido" | "aumentar-envido",
  canto: "envido" | "real-envido" | "falta-envido",
) {
  return (
    a.find((accion) => accion.tipo === tipoAccion && "canto" in accion && accion.canto === canto) ??
    null
  );
}
function esDesempate(o: ObservacionJugadorAutomatico): boolean {
  const puntajes = Object.values(o.tanteador);
  return puntajes.length === 2 && puntajes[0] === puntajes[1] && puntajes[0] >= o.metaPuntos;
}
export function seleccionarAccionFlor(
  o: ObservacionJugadorAutomatico,
  a: readonly AccionAutomatica[],
): AccionAutomatica | null {
  const flor = evaluarFlor(o);
  const anuncio = tipo(a, "anunciar-flor");
  if (anuncio) return anuncio; // anuncio reglamentario: no es una apuesta opcional.
  const pendiente = o.desafios.flor.pendiente;
  if (pendiente) {
    const quiero =
      pendiente === "contra-flor"
        ? tipo(a, "quiero-contra-flor")
        : tipo(a, "quiero-contra-flor-al-resto");
    const noQuiero =
      pendiente === "contra-flor"
        ? tipo(a, "no-quiero-contra-flor")
        : tipo(a, "no-quiero-contra-flor-al-resto");
    const minimo = pendiente === "contra-flor-al-resto" ? 0.78 : 0.58;
    return flor.probabilidadGanar >= minimo ? (quiero ?? noQuiero) : (noQuiero ?? quiero);
  }
  if (flor.modo !== "desafio") return null;
  // En desempate Contra Flor al Resto no termina el partido: aumenta su umbral
  // de riesgo, pero no se prohíbe. El motor conserva la adjudicación de 3 puntos.
  if (
    flor.probabilidadGanar >= (flor.esDesempate ? 0.93 : 0.86) &&
    flor.propio !== null &&
    flor.propio >= 45
  )
    return tipo(a, "proponer-contra-flor-al-resto") ?? tipo(a, "proponer-contra-flor");
  if (flor.probabilidadGanar >= 0.67) return tipo(a, "proponer-contra-flor");
  return null;
}
export function seleccionarAccionEnvido(
  o: ObservacionJugadorAutomatico,
  a: readonly AccionAutomatica[],
): AccionAutomatica | null {
  const evaluacion = evaluarEnvido(o);
  if (evaluacion.propio === null) return null; // Flor bloquea Envido.
  if (o.desafios.envido.pendiente) {
    if (evaluacion.probabilidadGanar >= 0.84 && evaluacion.propio >= 32)
      return (
        elegirEnvido(
          a,
          "aumentar-envido",
          evaluacion.propio >= 34 ? "falta-envido" : "real-envido",
        ) ?? tipo(a, "quiero-envido")
      );
    return evaluacion.probabilidadGanar >= 0.55
      ? tipo(a, "quiero-envido")
      : tipo(a, "no-quiero-envido");
  }
  if (evaluacion.probabilidadGanar < 0.62) return null;
  const rival = Object.keys(o.tanteador).find((equipo) => equipo !== o.equipo);
  const falta = rival
    ? calcularFaltaEnvido(o.metaPuntos, o.tanteador, [o.equipo, rival], o.equipo, esDesempate(o))
    : 0;
  if (evaluacion.propio >= 33 && evaluacion.probabilidadGanar >= 0.86 && falta >= 2)
    return (
      elegirEnvido(a, "iniciar-envido", "falta-envido") ??
      elegirEnvido(a, "iniciar-envido", "real-envido")
    );
  if (evaluacion.propio >= 30 && evaluacion.probabilidadGanar >= 0.74)
    return (
      elegirEnvido(a, "iniciar-envido", "real-envido") ??
      elegirEnvido(a, "iniciar-envido", "envido")
    );
  return evaluacion.propio >= 27 ? elegirEnvido(a, "iniciar-envido", "envido") : null;
}
/** Política compuesta 6C.4: Flor, Envido, Truco y finalmente cartas. */
export const politicaEstrategicaEnvidoFlor: PoliticaEstrategica = {
  decidir: (c: ContextoPoliticaEstrategica) =>
    seleccionarAccionFlor(c.observacion, c.accionesLegales) ??
    seleccionarAccionEnvido(c.observacion, c.accionesLegales) ??
    politicaEstrategicaTruco.decidir(c),
};
