import { identificarCarta } from "./cartas.js";
import {
  estimarIncertidumbre,
  evaluarCartaEstrategica,
  politicaEstrategicaCartas,
} from "./estrategia-cartas.js";
import type {
  AccionAutomatica,
  ContextoPoliticaEstrategica,
  ObservacionJugadorAutomatico,
  PoliticaEstrategica,
} from "./jugador-automatico.js";

export type NivelEstrategicoTruco = "truco" | "retruco" | "vale-cuatro";
export type EvaluacionManoTruco = Readonly<{
  confianza: number;
  cartasCompetitivas: number;
  bazasPropias: number;
  bazasRivales: number;
  razon: "ventaja-de-bazas" | "cartas-competitivas" | "incertidumbre";
}>;
export type EvaluacionRiesgoTruco = Readonly<{
  nivel: NivelEstrategicoTruco;
  puntosSiAcepta: 2 | 3 | 4;
  puntosSiRechaza: 1 | 2 | 3;
  confianzaMinimaAceptar: number;
  confianzaMinimaAumentar: number;
}>;

const NIVEL: Readonly<Record<NivelEstrategicoTruco, EvaluacionRiesgoTruco>> = {
  truco: {
    nivel: "truco",
    puntosSiAcepta: 2,
    puntosSiRechaza: 1,
    confianzaMinimaAceptar: 0.55,
    confianzaMinimaAumentar: 0.75,
  },
  retruco: {
    nivel: "retruco",
    puntosSiAcepta: 3,
    puntosSiRechaza: 2,
    confianzaMinimaAceptar: 0.6,
    confianzaMinimaAumentar: 0.82,
  },
  "vale-cuatro": {
    nivel: "vale-cuatro",
    puntosSiAcepta: 4,
    puntosSiRechaza: 3,
    confianzaMinimaAceptar: 0.74,
    confianzaMinimaAumentar: 1,
  },
};

const esTipo = <T extends AccionAutomatica["tipo"]>(
  accion: AccionAutomatica,
  tipo: T,
): accion is Extract<AccionAutomatica, { tipo: T }> => accion.tipo === tipo;

function limitar(valor: number): number {
  return Math.max(0, Math.min(1, valor));
}

/**
 * Estima la capacidad de ganar la mano sin ver cartas ajenas. No es sólo la
 * carta máxima: pondera cada carta restante por su proporción de rivales que
 * puede superar, la amplitud de cartas competitivas y bazas ya resueltas.
 */
export function evaluarManoParaTruco(
  observacion: ObservacionJugadorAutomatico,
): EvaluacionManoTruco {
  const probabilidades = observacion.cartasPropias
    .map((carta) => {
      const incertidumbre = estimarIncertidumbre(observacion, carta);
      return {
        carta,
        exito: incertidumbre.probabilidadRivalMasDebil + incertidumbre.probabilidadRivalIgual * 0.5,
      };
    })
    .sort(
      (a, b) =>
        b.exito - a.exito || identificarCarta(a.carta).localeCompare(identificarCarta(b.carta)),
    );
  const base = probabilidades.reduce(
    (total, item, indice) => total + item.exito * (indice === 0 ? 0.5 : indice === 1 ? 0.32 : 0.18),
    0,
  );
  const cartasCompetitivas = probabilidades.filter((item) => item.exito >= 0.5).length;
  const resultados = observacion.bazas.map((baza) => baza.equipoGanador);
  const bazasPropias = resultados.filter((equipo) => equipo === observacion.equipo).length;
  const bazasRivales = resultados.filter(
    (equipo) => equipo !== null && equipo !== observacion.equipo,
  ).length;
  const ajusteBazas = (bazasPropias - bazasRivales) * 0.22;
  const ajusteAmplitud = (cartasCompetitivas - 1) * 0.07;
  const confianza = limitar(base + ajusteBazas + ajusteAmplitud);
  return {
    confianza,
    cartasCompetitivas,
    bazasPropias,
    bazasRivales,
    razon:
      bazasPropias > bazasRivales
        ? "ventaja-de-bazas"
        : cartasCompetitivas >= 2
          ? "cartas-competitivas"
          : "incertidumbre",
  };
}

export function evaluarRiesgoTruco(nivel: NivelEstrategicoTruco): EvaluacionRiesgoTruco {
  return NIVEL[nivel];
}

function nivelPendiente(observacion: ObservacionJugadorAutomatico): NivelEstrategicoTruco | null {
  const pendiente = observacion.desafios.truco.pendiente;
  return pendiente === "truco" || pendiente === "retruco" || pendiente === "vale-cuatro"
    ? pendiente
    : null;
}

function hayCartaDecisiva(
  observacion: ObservacionJugadorAutomatico,
  acciones: readonly AccionAutomatica[],
): boolean {
  return acciones
    .filter((accion) => accion.tipo === "jugar-carta")
    .some((accion) => evaluarCartaEstrategica(observacion, accion.carta).decisiva === "ganar-mano");
}

/**
 * Elige sólo entre opciones de Truco ya declaradas legales por el motor. La
 * estimación de aceptación rival es deliberadamente conservadora: para subir
 * exige más confianza que para aceptar, sin asumir que el rival siempre quiere.
 */
export function seleccionarAccionTruco(
  observacion: ObservacionJugadorAutomatico,
  accionesLegales: readonly AccionAutomatica[],
  contextoPartido?: Readonly<{
    ventaja: number;
    cercaDeGanar: boolean;
    riesgoDerrotaInmediata: boolean;
  }>,
): AccionAutomatica | null {
  const mano = evaluarManoParaTruco(observacion);
  const pendiente = nivelPendiente(observacion);
  if (pendiente) {
    const riesgo = evaluarRiesgoTruco(pendiente);
    const aumento =
      pendiente === "truco"
        ? "proponer-retruco"
        : pendiente === "retruco"
          ? "proponer-vale-cuatro"
          : null;
    if (aumento && mano.confianza >= riesgo.confianzaMinimaAumentar) {
      const accion = accionesLegales.find((item) => esTipo(item, aumento));
      if (accion) return accion;
    }
    const ajuste = contextoPartido
      ? (contextoPartido.ventaja >= 8 ? 0.1 : 0) +
        (contextoPartido.riesgoDerrotaInmediata ? -0.06 : 0)
      : 0;
    if (mano.confianza >= riesgo.confianzaMinimaAceptar + ajuste) {
      const tipo =
        pendiente === "truco"
          ? "quiero-truco"
          : pendiente === "retruco"
            ? "quiero-retruco"
            : "quiero-vale-cuatro";
      const accion = accionesLegales.find((item) => esTipo(item, tipo));
      if (accion) return accion;
    }
    const tipo =
      pendiente === "truco"
        ? "no-quiero-truco"
        : pendiente === "retruco"
          ? "no-quiero-retruco"
          : "no-quiero-vale-cuatro";
    return accionesLegales.find((item) => esTipo(item, tipo)) ?? null;
  }

  if (hayCartaDecisiva(observacion, accionesLegales)) return null;
  const propuestas: readonly Readonly<{
    tipo: "proponer-truco" | "proponer-retruco" | "proponer-vale-cuatro";
    nivel: NivelEstrategicoTruco;
    minimo: number;
  }>[] = [
    { tipo: "proponer-vale-cuatro", nivel: "vale-cuatro", minimo: 0.9 },
    { tipo: "proponer-retruco", nivel: "retruco", minimo: 0.85 },
    { tipo: "proponer-truco", nivel: "truco", minimo: 0.62 },
  ];
  for (const propuesta of propuestas) {
    const ajustePropuesta = contextoPartido
      ? (contextoPartido.ventaja >= 8 ? 0.08 : 0) +
        (contextoPartido.riesgoDerrotaInmediata ? -0.04 : 0)
      : 0;
    if (mano.confianza >= propuesta.minimo + ajustePropuesta) {
      const accion = accionesLegales.find((item) => esTipo(item, propuesta.tipo));
      if (accion) return accion;
    }
  }
  return null;
}

/** Política compuesta 6C.3: Truco primero cuando lo justifica, luego cartas 6C.2. */
export const politicaEstrategicaTruco: PoliticaEstrategica = {
  decidir: (contexto: ContextoPoliticaEstrategica) =>
    seleccionarAccionTruco(contexto.observacion, contexto.accionesLegales) ??
    politicaEstrategicaCartas.decidir(contexto),
};
