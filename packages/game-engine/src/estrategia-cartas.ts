import type { Carta } from "@truco/shared";
import { compararCartas, crearMazo, identificarCarta, obtenerJerarquia } from "./cartas.js";
import { evaluarResultadosBazas } from "./juego-cartas.js";
import type {
  AccionAutomatica,
  ContextoPoliticaEstrategica,
  ObservacionJugadorAutomatico,
  PoliticaEstrategica,
} from "./jugador-automatico.js";

export type ResultadoBazaEstrategico = "ganar" | "perder" | "parda";
export type EstimacionIncertidumbre = Readonly<{
  cartasPosibles: readonly Carta[];
  probabilidadRivalMasFuerte: number;
  probabilidadRivalIgual: number;
  probabilidadRivalMasDebil: number;
}>;
export type EvaluacionCartaEstrategica = Readonly<{
  carta: Carta;
  jerarquia: number;
  resultadoInmediato: ResultadoBazaEstrategico | null;
  decisiva: "ganar-mano" | "perder-mano" | null;
  incertidumbre: EstimacionIncertidumbre;
  valor: number;
}>;

const copiarCarta = (carta: Carta): Carta => ({ palo: carta.palo, valor: carta.valor });
const esJugadaCarta = (
  accion: AccionAutomatica,
): accion is Extract<AccionAutomatica, { tipo: "jugar-carta" }> => accion.tipo === "jugar-carta";

/** Usa la jerarquía canónica: 1 es la carta más fuerte. */
export function evaluarFuerzaCarta(carta: Carta, muestra: Carta): number {
  return obtenerJerarquia(carta, muestra);
}

function cartasPublicas(observacion: ObservacionJugadorAutomatico): Carta[] {
  return [
    ...observacion.bazas.flatMap((baza) => baza.jugadas.map((jugada) => jugada.carta)),
    ...observacion.bazaActual.jugadas.map((jugada) => jugada.carta),
  ];
}

/**
 * Universo legítimo de incertidumbre: mazo menos muestra, cartas propias y
 * cartas públicas. Incluye tanto cartas rivales aún ocultas como las que
 * siguen fuera del reparto; no pretende conocer cuál de ellas tiene el rival.
 */
export function estimarIncertidumbre(
  observacion: ObservacionJugadorAutomatico,
  carta: Carta,
): EstimacionIncertidumbre {
  const conocidas = new Set([
    identificarCarta(observacion.muestra),
    ...observacion.cartasPropias.map(identificarCarta),
    ...cartasPublicas(observacion).map(identificarCarta),
  ]);
  const cartasPosibles = crearMazo().filter((posible) => !conocidas.has(identificarCarta(posible)));
  const total = cartasPosibles.length || 1;
  const conteos = cartasPosibles.reduce(
    (resultado, posible) => {
      const comparacion = compararCartas(carta, posible, observacion.muestra);
      if (comparacion === 1) resultado.masDebil += 1;
      else if (comparacion === -1) resultado.masFuerte += 1;
      else resultado.igual += 1;
      return resultado;
    },
    { masFuerte: 0, igual: 0, masDebil: 0 },
  );
  return {
    cartasPosibles: cartasPosibles.map(copiarCarta),
    probabilidadRivalMasFuerte: conteos.masFuerte / total,
    probabilidadRivalIgual: conteos.igual / total,
    probabilidadRivalMasDebil: conteos.masDebil / total,
  };
}

function resultadoContra(carta: Carta, rival: Carta, muestra: Carta): ResultadoBazaEstrategico {
  const comparacion = compararCartas(carta, rival, muestra);
  return comparacion === 1 ? "ganar" : comparacion === -1 ? "perder" : "parda";
}

function resultadosPrevios(
  observacion: ObservacionJugadorAutomatico,
): ("propio" | "rival" | null)[] {
  return observacion.bazas.map((baza) =>
    baza.equipoGanador === null
      ? null
      : baza.equipoGanador === observacion.equipo
        ? "propio"
        : "rival",
  );
}

function resultadoDeManoSiCierra(
  observacion: ObservacionJugadorAutomatico,
  resultado: ResultadoBazaEstrategico,
): "ganar-mano" | "perder-mano" | null {
  const propio = "propio";
  const rival = "rival";
  const resultados = [
    ...resultadosPrevios(observacion).map((valor) =>
      valor === "propio" ? propio : valor === "rival" ? rival : null,
    ),
    resultado === "ganar" ? propio : resultado === "perder" ? rival : null,
  ];
  const manoOriginal = observacion.manoOriginal === observacion.jugador ? propio : rival;
  const evaluacion = evaluarResultadosBazas([propio, rival], manoOriginal, resultados);
  if (!evaluacion.finalizada) return null;
  return evaluacion.equipoGanador === propio ? "ganar-mano" : "perder-mano";
}

/** Evalúa una carta sin mirar cartas no presentes en la observación. */
export function evaluarCartaEstrategica(
  observacion: ObservacionJugadorAutomatico,
  carta: Carta,
): EvaluacionCartaEstrategica {
  const rivalEnMesa = observacion.bazaActual.jugadas.find(
    (jugada) => jugada.jugador !== observacion.jugador,
  );
  const resultadoInmediato = rivalEnMesa
    ? resultadoContra(carta, rivalEnMesa.carta, observacion.muestra)
    : null;
  const decisiva = resultadoInmediato
    ? resultadoDeManoSiCierra(observacion, resultadoInmediato)
    : null;
  const incertidumbre = estimarIncertidumbre(observacion, carta);
  const jerarquia = evaluarFuerzaCarta(carta, observacion.muestra);

  // Al responder, ganar/pardar vale más que conservar; entre alternativas con
  // igual resultado se prefiere la carta más débil (jerarquía mayor).
  if (resultadoInmediato) {
    const base =
      decisiva === "ganar-mano"
        ? 10_000
        : decisiva === "perder-mano"
          ? -10_000
          : resultadoInmediato === "ganar"
            ? 1_000
            : resultadoInmediato === "parda"
              ? 700
              : 0;
    return {
      carta: copiarCarta(carta),
      jerarquia,
      resultadoInmediato,
      decisiva,
      incertidumbre,
      valor: base + jerarquia,
    };
  }

  // Al salir, una baza potencialmente decisiva justifica invertir fuerza;
  // de otro modo se sacrifica la más débil y se reserva capital de cartas.
  const potencialDecisivo = resultadosPrevios(observacion).length === 1;
  const probabilidadExito =
    incertidumbre.probabilidadRivalMasDebil + incertidumbre.probabilidadRivalIgual * 0.5;
  const valor = potencialDecisivo
    ? probabilidadExito * 1_000 - jerarquia
    : jerarquia * 100 + probabilidadExito;
  return {
    carta: copiarCarta(carta),
    jerarquia,
    resultadoInmediato,
    decisiva,
    incertidumbre,
    valor,
  };
}

/** Selecciona una carta legal; los empates usan solamente la fuente inyectada. */
export function seleccionarCartaEstrategica(
  observacion: ObservacionJugadorAutomatico,
  accionesLegales: readonly AccionAutomatica[],
  aleatoriedad: ContextoPoliticaEstrategica["aleatoriedad"],
): Extract<AccionAutomatica, { tipo: "jugar-carta" }> | null {
  const candidatas = accionesLegales.filter(esJugadaCarta);
  if (!candidatas.length) return null;
  const evaluadas = candidatas.map((accion) => ({
    accion,
    evaluacion: evaluarCartaEstrategica(observacion, accion.carta),
  }));
  const maximo = Math.max(...evaluadas.map(({ evaluacion }) => evaluacion.valor));
  const mejores = evaluadas
    .filter(({ evaluacion }) => evaluacion.valor === maximo)
    .sort((a, b) =>
      identificarCarta(a.accion.carta).localeCompare(identificarCarta(b.accion.carta)),
    );
  const indice = Math.min(
    mejores.length - 1,
    Math.floor(aleatoriedad.siguiente() * mejores.length),
  );
  return { tipo: "jugar-carta", carta: copiarCarta(mejores[indice]!.accion.carta) };
}

/**
 * Política 6C.2: estratégica sólo para cartas. Ante cantos o respuestas sin
 * carta disponible conserva un fallback legal neutral, sin estrategia de apuestas.
 */
export const politicaEstrategicaCartas: PoliticaEstrategica = {
  decidir: ({ observacion, accionesLegales, aleatoriedad }) =>
    seleccionarCartaEstrategica(observacion, accionesLegales, aleatoriedad) ??
    accionesLegales[0] ??
    null,
};
