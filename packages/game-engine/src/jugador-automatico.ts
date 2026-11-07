import type { Carta } from "@truco/shared";
import type { AccionCoordinada } from "./coordinador.js";
import {
  ejecutarAccionPartida,
  type EstadoPartida,
  type ResultadoAccionPartida,
} from "./partida.js";

/**
 * Vista de lectura para una política. No contiene EstadoPartida ni las manos
 * de otros jugadores: construirla es la frontera de privacidad de la IA.
 */
export type ObservacionJugadorAutomatico = Readonly<{
  jugador: string;
  asiento: number;
  equipo: string;
  manoOriginal: string;
  turno: string | null;
  muestra: Carta;
  cartasPropias: readonly Carta[];
  retirados: readonly string[];
  bazas: readonly Readonly<{
    salida: string;
    jugadas: readonly Readonly<{ jugador: string; carta: Carta }>[];
    equipoGanador: string | null;
  }>[];
  bazaActual: Readonly<{
    salida: string;
    jugadas: readonly Readonly<{ jugador: string; carta: Carta }>[];
  }>;
  tanteador: Readonly<Record<string, number>>;
  metaPuntos: 30 | 40;
  desafios: Readonly<{
    envido: Readonly<{
      pendiente: boolean;
      valorAceptado: number | null;
      historial: readonly Readonly<{ jugador: string; equipo: string; canto: string }>[];
    }>;
    flor: Readonly<{
      anuncios: readonly Readonly<{ jugador: string; equipo: string }>[];
      pendiente: string | null;
    }>;
    truco: Readonly<{
      nivelAceptado: string | null;
      pendiente: string | null;
      proponente: string | null;
    }>;
  }>;
  cicloMano: string;
}>;

/** Acción que una política puede proponer sin poder suplantar otro asiento. */
export type AccionAutomatica =
  | Readonly<{ tipo: "jugar-carta"; carta: Carta }>
  | Readonly<{ tipo: "anunciar-flor" | "proponer-contra-flor" | "proponer-contra-flor-al-resto" }>
  | Readonly<{ tipo: "quiero-contra-flor" | "no-quiero-contra-flor" }>
  | Readonly<{ tipo: "quiero-contra-flor-al-resto" | "no-quiero-contra-flor-al-resto" }>
  | Readonly<{
      tipo: "iniciar-envido" | "aumentar-envido";
      canto: "envido" | "real-envido" | "falta-envido";
    }>
  | Readonly<{ tipo: "quiero-envido" | "no-quiero-envido" | "con-flor-quiero" | "irse-al-mazo" }>
  | Readonly<{
      tipo:
        | "proponer-truco"
        | "quiero-truco"
        | "no-quiero-truco"
        | "proponer-retruco"
        | "quiero-retruco"
        | "no-quiero-retruco"
        | "proponer-vale-cuatro"
        | "quiero-vale-cuatro"
        | "no-quiero-vale-cuatro";
    }>;

/** Fuente inyectable: ninguna política debe depender de Math.random(). */
export type FuenteAleatoria = Readonly<{ siguiente: () => number }>;
export type ContextoPoliticaEstrategica = Readonly<{
  observacion: ObservacionJugadorAutomatico;
  accionesLegales: readonly AccionAutomatica[];
  aleatoriedad: FuenteAleatoria;
}>;
export type PoliticaEstrategica = Readonly<{
  decidir: (contexto: ContextoPoliticaEstrategica) => AccionAutomatica | null;
}>;

const copiarCarta = (carta: Carta): Carta => ({ palo: carta.palo, valor: carta.valor });
const copiarJugada = (jugada: { jugador: string; carta: Carta }) => ({
  jugador: jugada.jugador,
  carta: copiarCarta(jugada.carta),
});

/** Proyección privada deliberada; no serializa ni devuelve el estado canónico. */
export function crearObservacionJugadorAutomatico(
  estado: EstadoPartida,
  jugador: string,
): ObservacionJugadorAutomatico {
  const juego = estado.mano.juego;
  const participante = estado.mesa.jugadores.find((item) => item.id === jugador);
  const mano = juego.cartasDisponibles.find((item) => item.jugador === jugador);
  if (!participante || !mano) throw new TypeError("El jugador no pertenece a la partida.");
  return {
    jugador,
    asiento: participante.posicion,
    equipo: participante.equipo,
    manoOriginal: juego.mano.manoOriginal,
    turno: juego.jugadorTurno,
    muestra: copiarCarta(juego.mano.muestra),
    cartasPropias: mano.cartas.map(copiarCarta),
    retirados: [...juego.retirados],
    bazas: juego.bazasCompletadas.map((baza) => ({
      salida: baza.salida,
      jugadas: baza.jugadas.map(copiarJugada),
      equipoGanador: baza.resultado.equipoGanador,
    })),
    bazaActual: {
      salida: juego.bazaActual.salida,
      jugadas: juego.bazaActual.jugadas.map(copiarJugada),
    },
    tanteador: { ...estado.puntajes },
    metaPuntos: estado.metaPuntos,
    desafios: {
      envido: {
        pendiente: estado.mano.envido.pendiente !== null,
        valorAceptado: estado.mano.envido.pendiente?.valorAceptado ?? null,
        historial: (estado.mano.envido.pendiente?.cantos ?? []).map((canto) => ({ ...canto })),
      },
      flor: {
        anuncios: estado.mano.flor.anuncios.map((anuncio) => ({ ...anuncio })),
        pendiente: estado.mano.flor.pendiente?.tipo ?? null,
      },
      truco: {
        nivelAceptado: estado.mano.truco.apuestaActiva?.nivel ?? null,
        pendiente: estado.mano.truco.propuestaPendiente?.nivel ?? null,
        proponente: estado.mano.truco.propuestaPendiente?.proponente ?? null,
      },
    },
    cicloMano: estado.mano.ciclo.fase,
  };
}

function conJugador(accion: AccionAutomatica, jugador: string): AccionCoordinada {
  return { ...accion, jugador } as AccionCoordinada;
}

function candidatas(estado: EstadoPartida, jugador: string): AccionAutomatica[] {
  const cartas =
    estado.mano.juego.cartasDisponibles.find((mano) => mano.jugador === jugador)?.cartas ?? [];
  return [
    ...cartas.map((carta) => ({ tipo: "jugar-carta" as const, carta: copiarCarta(carta) })),
    { tipo: "anunciar-flor" },
    { tipo: "proponer-contra-flor" },
    { tipo: "proponer-contra-flor-al-resto" },
    { tipo: "quiero-contra-flor" },
    { tipo: "no-quiero-contra-flor" },
    { tipo: "quiero-contra-flor-al-resto" },
    { tipo: "no-quiero-contra-flor-al-resto" },
    ...(["envido", "real-envido", "falta-envido"] as const).flatMap((canto) => [
      { tipo: "iniciar-envido" as const, canto },
      { tipo: "aumentar-envido" as const, canto },
    ]),
    { tipo: "quiero-envido" },
    { tipo: "no-quiero-envido" },
    { tipo: "con-flor-quiero" },
    { tipo: "irse-al-mazo" },
    { tipo: "proponer-truco" },
    { tipo: "quiero-truco" },
    { tipo: "no-quiero-truco" },
    { tipo: "proponer-retruco" },
    { tipo: "quiero-retruco" },
    { tipo: "no-quiero-retruco" },
    { tipo: "proponer-vale-cuatro" },
    { tipo: "quiero-vale-cuatro" },
    { tipo: "no-quiero-vale-cuatro" },
  ];
}

/**
 * La legalidad sigue siendo propiedad del motor: cada candidata se verifica
 * con ejecutarAccionPartida y sólo se expone si esa transición la acepta.
 */
export function obtenerAccionesLegalesJugador(
  estado: EstadoPartida,
  jugador: string,
): readonly AccionAutomatica[] {
  return candidatas(estado, jugador).filter(
    (accion) => ejecutarAccionPartida(estado, conJugador(accion, jugador)).aceptada,
  );
}

function mismaAccion(a: AccionAutomatica, b: AccionAutomatica): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type ResultadoDecisionAutomatica =
  | ResultadoAccionPartida
  | Readonly<{
      aceptada: false;
      rechazo: Readonly<{ codigo: "decision-ilegal" | "sin-accion"; mensaje: string }>;
    }>;

/** Orquestador puro: la política decide; el motor ejecuta y conserva autoridad. */
export function ejecutarDecisionAutomatica(
  estado: EstadoPartida,
  jugador: string,
  politica: PoliticaEstrategica,
  aleatoriedad: FuenteAleatoria,
): ResultadoDecisionAutomatica {
  const accionesLegales = obtenerAccionesLegalesJugador(estado, jugador);
  const decision = politica.decidir({
    observacion: crearObservacionJugadorAutomatico(estado, jugador),
    accionesLegales,
    aleatoriedad,
  });
  if (decision === null)
    return {
      aceptada: false,
      rechazo: { codigo: "sin-accion", mensaje: "La política no eligió una acción." },
    };
  if (!accionesLegales.some((accion) => mismaAccion(accion, decision)))
    return {
      aceptada: false,
      rechazo: { codigo: "decision-ilegal", mensaje: "La política eligió una acción no legal." },
    };
  return ejecutarAccionPartida(estado, conJugador(decision, jugador));
}

/** Política de prueba, determinista y deliberadamente no estratégica. */
export const politicaPrimeraAccionLegal: PoliticaEstrategica = {
  decidir: ({ accionesLegales }) => accionesLegales[0] ?? null,
};
