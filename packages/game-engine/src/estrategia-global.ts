import { calcularFaltaEnvido } from "./envido.js";
import { seleccionarCartaEstrategica } from "./estrategia-cartas.js";
import {
  evaluarEnvido,
  seleccionarAccionEnvido,
  seleccionarAccionFlor,
} from "./estrategia-envido-flor.js";
import { seleccionarAccionTruco } from "./estrategia-truco.js";
import type {
  AccionAutomatica,
  ContextoPoliticaEstrategica,
  ObservacionJugadorAutomatico,
  PoliticaEstrategica,
} from "./jugador-automatico.js";

/** Resumen público 1v1 del partido. No es una probabilidad calibrada. */
export type ContextoPartidoEstrategico = Readonly<{
  puntosPropios: number;
  puntosRivales: number;
  distanciaPropia: number;
  distanciaRival: number;
  ventaja: number;
  cercaDeGanar: boolean;
  riesgoDerrotaInmediata: boolean;
  esDesempate: boolean;
}>;
export type ValorRiesgoEstrategico = Readonly<{ valorEsperado: number; utilidadPartido: number }>;

export function evaluarContextoPartido(
  o: ObservacionJugadorAutomatico,
): ContextoPartidoEstrategico {
  const rival = Object.keys(o.tanteador).find((equipo) => equipo !== o.equipo) ?? o.equipo;
  const propios = o.tanteador[o.equipo] ?? 0,
    ajenos = o.tanteador[rival] ?? 0;
  const dp = Math.max(0, o.metaPuntos - propios),
    dr = Math.max(0, o.metaPuntos - ajenos);
  return {
    puntosPropios: propios,
    puntosRivales: ajenos,
    distanciaPropia: dp,
    distanciaRival: dr,
    ventaja: propios - ajenos,
    cercaDeGanar: dp <= 4,
    riesgoDerrotaInmediata: dr <= 4,
    esDesempate: propios === ajenos && propios >= o.metaPuntos,
  };
}

/** Combina EV de puntos con una bonificación explícita por cerrar o evitar perder el partido. */
export function evaluarRiesgoBeneficio(
  contexto: ContextoPartidoEstrategico,
  probabilidad: number,
  gana: number,
  pierde: number,
): ValorRiesgoEstrategico {
  const valorEsperado = probabilidad * gana - (1 - probabilidad) * pierde;
  const cierre = contexto.distanciaPropia <= gana ? 100 : 0;
  const ruina = contexto.distanciaRival <= pierde ? 100 : 0;
  return {
    valorEsperado,
    utilidadPartido: valorEsperado + probabilidad * cierre - (1 - probabilidad) * ruina,
  };
}

function obligatoria(a: readonly AccionAutomatica[]): AccionAutomatica | null {
  return a.find((x) => x.tipo === "anunciar-flor") ?? null;
}

/**
 * Política 6C.5, sólo 1v1: reconstruye memoria pública desde la observación y
 * compara riesgo/beneficio antes de abrir apuestas opcionales. El motor sigue
 * siendo la única autoridad de legalidad y puntuación.
 */
export const politicaEstrategicaGlobal: PoliticaEstrategica = {
  decidir: ({ observacion, accionesLegales, aleatoriedad }: ContextoPoliticaEstrategica) => {
    const contexto = evaluarContextoPartido(observacion);
    const forzosa = obligatoria(accionesLegales);
    if (forzosa) return forzosa;
    const flor = seleccionarAccionFlor(observacion, accionesLegales);
    if (observacion.desafios.flor.pendiente && flor) return flor;
    const envido = seleccionarAccionEnvido(observacion, accionesLegales);
    if (observacion.desafios.envido.pendiente && envido) return envido;
    const truco = seleccionarAccionTruco(observacion, accionesLegales, contexto);
    if (observacion.desafios.truco.pendiente && truco) return truco;
    // Una ventaja amplia no justifica abrir apuestas aisladas: se preserva la
    // alternativa de cartas. Cerca de ganar, Falta sólo se eleva si ya había
    // estimación favorable y el cálculo reglamentario la hace decisiva.
    // Flor opcional conserva prioridad reglamentaria, pero una ventaja amplia
    // permite reservar el riesgo de desafío y continuar con cartas.
    if (flor && contexto.ventaja < 8) return flor;
    if (envido && contexto.ventaja < 8) return envido;
    const e = evaluarEnvido(observacion);
    const rival = Object.keys(observacion.tanteador).find((x) => x !== observacion.equipo);
    const falta = rival
      ? calcularFaltaEnvido(
          observacion.metaPuntos,
          observacion.tanteador,
          [observacion.equipo, rival],
          observacion.equipo,
          contexto.esDesempate,
        )
      : 0;
    const faltaLegal = accionesLegales.find(
      (x) => x.tipo === "iniciar-envido" && x.canto === "falta-envido",
    );
    if (
      contexto.cercaDeGanar &&
      faltaLegal &&
      e.propio !== null &&
      evaluarRiesgoBeneficio(contexto, e.probabilidadGanar, falta, falta).utilidadPartido > 0
    )
      return faltaLegal;
    if (truco && contexto.ventaja < 8) return truco;
    return (
      seleccionarCartaEstrategica(observacion, accionesLegales, aleatoriedad) ??
      accionesLegales.find((x) => x.tipo === "irse-al-mazo") ??
      null
    );
  },
};
