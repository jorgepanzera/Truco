import type { MetaPuntos } from "@truco/shared";
import {
  aumentarEnvidoEnJuego,
  crearEstadoEnvido,
  esEstadoEnvidoValido,
  iniciarEnvido,
  responderNoQuiero,
  responderQuiero,
  type CantoEnvido,
  type ContextoEnvido,
  type EstadoEnvidoDominio,
} from "./envido.js";
import {
  ejecutarCarta,
  esEstadoJuegoCartasValido,
  estaActivo,
  finalizarManoPorMazo,
  finalizarManoPorRechazoTruco,
  type AccionJuegoCartas,
  type EstadoJuegoCartas,
  type EventoJuegoCartas,
} from "./juego-cartas.js";
import {
  anunciarFlor,
  confirmarFaseFlor,
  consumirOportunidadDesafioFlor,
  crearEstadoFlor,
  esEstadoFlorValido,
  hayDerechosFlor,
  perderDerechoFlor,
  proponerContraFlor,
  proponerContraFlorAlResto,
  responderContraFlor,
  responderContraFlorAlResto,
  tieneFlorCalculada,
  type ContextoFlor,
  type EstadoFlorDominio,
} from "./flor.js";
import {
  crearEstadoTruco,
  esEstadoTrucoValido,
  proponerRetruco,
  proponerTruco,
  proponerValeCuatro,
  responderQuieroRetruco,
  responderQuieroTruco,
  responderQuieroValeCuatro,
  responderNoQuieroRetruco,
  responderNoQuieroTruco,
  responderNoQuieroValeCuatro,
  type ContextoTruco,
  type EstadoTrucoDominio,
  type EventoTruco,
  type NivelApuestaTruco,
} from "./truco.js";

export type EstadoManoCoordinada = Readonly<{
  juego: EstadoJuegoCartas;
  envido: EstadoEnvidoDominio;
  flor: EstadoFlorDominio;
  truco: EstadoTrucoDominio;
  resultadoPartida: Readonly<{ motivo: "contra-flor-al-resto"; equipoGanador: string }> | null;
  liquidacionMazo: EstadoLiquidacionMazo | null;
  ciclo: EstadoCicloMano;
  contextoInicio: ContextoInicioMano;
}>;
/** Hecho canónico reservado para la liquidación diferida posterior a un mazo. */
export type EstadoLiquidacionMazo = Readonly<{
  equipoGanador: string;
  causa: CausaVictoriaCompetitiva;
  puntos: "pendiente" | "realizada";
  adjudicacionTruco: AdjudicacionTrucoPorBazas | null;
  oportunidadFlor: Readonly<{ jugador: string; estado: "pendiente" | "consumida"; duracionMs: 10000 }> | null;
}>;
export type CausaVictoriaCompetitiva = "bazas" | "rechazo-truco" | "mazo" | "contra-flor-al-resto";
/** Separa victoria competitiva, liquidación futura y cierre sin crear adjudicaciones nuevas. */
export type EstadoCicloMano =
  | Readonly<{ fase: "competencia-activa" }>
  | Readonly<{
      fase: "victoria-competitiva-determinada";
      equipoGanador: string;
      causa: CausaVictoriaCompetitiva;
    }>
  | Readonly<{ fase: "liquidacion"; equipoGanador: string; causa: CausaVictoriaCompetitiva }>
  | Readonly<{ fase: "cierre-definitivo"; equipoGanador: string; causa: CausaVictoriaCompetitiva }>;
export type ContextoInicioMano = Readonly<{
  metaPuntos: MetaPuntos;
  puntajesIniciales: Readonly<Record<string, number>>;
  esDesempate: boolean;
}>;
export type AccionCoordinada =
  | AccionJuegoCartas
  | Readonly<{ tipo: "anunciar-flor"; jugador: string }>
  | Readonly<{ tipo: "proponer-contra-flor" | "proponer-contra-flor-al-resto"; jugador: string }>
  | Readonly<{
      tipo: "quiero-contra-flor" | "no-quiero-contra-flor";
      jugador: string;
    }>
  | Readonly<{
      tipo: "quiero-contra-flor-al-resto" | "no-quiero-contra-flor-al-resto";
      jugador: string;
    }>
  | Readonly<{ tipo: "iniciar-envido" | "aumentar-envido"; jugador: string; canto: CantoEnvido }>
  | Readonly<{ tipo: "quiero-envido" | "no-quiero-envido"; jugador: string }>
  | Readonly<{ tipo: "con-flor-quiero"; jugador: string }>
  | Readonly<{ tipo: "vencer-oportunidad-flor"; jugador: string }>
  | Readonly<{ tipo: "liquidar-puntos-mazo" }>
  | Readonly<{ tipo: "irse-al-mazo"; jugador: string }>
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
      jugador: string;
    }>;
export type AdjudicacionTrucoPorBazas = Readonly<{
  equipo: string;
  puntos: 1 | 2 | 3 | 4;
  motivo: "bazas" | "mazo";
  nivel: NivelApuestaTruco | null;
}>;
export type EventoTrucoAdjudicadoPorBazas = Readonly<{
  tipo: "truco-adjudicado-por-bazas";
  adjudicacion: AdjudicacionTrucoPorBazas;
}>;
export type EventoMazoAdjudicado = Readonly<{
  tipo: "mazo-adjudicado";
  adjudicacion: AdjudicacionTrucoPorBazas;
  jugadorRetirado: string;
}>;
export type EventoCoordinado =
  | EventoJuegoCartas
  | import("./envido.js").EventoEnvido
  | EventoTruco
  | EventoTrucoAdjudicadoPorBazas
  | EventoMazoAdjudicado
  | Readonly<{ tipo: string; jugador?: string }>;
export type RechazoCoordinado = Readonly<{ codigo: string; mensaje: string }>;

export function validarContextoInicioMano(
  juego: EstadoJuegoCartas,
  contexto: ContextoInicioMano,
): boolean {
  const equipos = juego?.mano?.equipos;
  if (!contexto || (contexto.metaPuntos !== 30 && contexto.metaPuntos !== 40)) return false;
  if (!Array.isArray(equipos) || equipos.length !== 2 || new Set(equipos).size !== 2) return false;
  if (
    equipos.some(
      (e) =>
        !Number.isInteger(contexto.puntajesIniciales?.[e]) || contexto.puntajesIniciales[e] < 0,
    )
  )
    return false;
  const [a, b] = equipos.map((e) => contexto.puntajesIniciales[e]);
  return !contexto.esDesempate || (a === b && a >= contexto.metaPuntos);
}
export function crearEstadoManoCoordinada(
  juego: EstadoJuegoCartas,
  contextoInicio: ContextoInicioMano,
): EstadoManoCoordinada {
  if (!esEstadoJuegoCartasValido(juego) || !validarContextoInicioMano(juego, contextoInicio))
    throw new TypeError("Contexto inicial inválido.");
  return {
    juego,
    envido: crearEstadoEnvido(),
    flor: crearEstadoFlor(),
    truco: crearEstadoTruco(),
    resultadoPartida: null,
    liquidacionMazo: null,
    ciclo: { fase: "competencia-activa" },
    contextoInicio,
  };
}
export function esEstadoCicloManoValido(
  ciclo: EstadoCicloMano,
  equipos: readonly string[],
): boolean {
  if (!ciclo || typeof ciclo !== "object" || !Array.isArray(equipos)) return false;
  if (ciclo.fase === "competencia-activa") return Object.keys(ciclo).length === 1;
  return (
    (ciclo.fase === "victoria-competitiva-determinada" ||
      ciclo.fase === "liquidacion" ||
      ciclo.fase === "cierre-definitivo") &&
    Object.keys(ciclo).length === 3 &&
    equipos.includes(ciclo.equipoGanador) &&
    (ciclo.causa === "bazas" ||
      ciclo.causa === "rechazo-truco" ||
      ciclo.causa === "mazo" ||
      ciclo.causa === "contra-flor-al-resto")
  );
}
/** Vincula el ciclo con las únicas fuentes canónicas de resultado disponibles hoy. */
export function esCicloCoherenteConEstado(
  ciclo: EstadoCicloMano,
  juego: EstadoJuegoCartas,
  resultadoPartida: EstadoManoCoordinada["resultadoPartida"],
  liquidacionMazo: EstadoLiquidacionMazo | null = null,
  flor?: EstadoFlorDominio,
  truco?: EstadoTrucoDominio,
  envido?: EstadoEnvidoDominio,
): boolean {
  if (liquidacionMazo !== null) {
    const elegible = flor
      ? obtenerElegibleFlorExcepcional({ juego, flor } as EstadoManoCoordinada)
      : null;
    const baseValida =
      juego.finalizada &&
      juego.motivoFinalizacion === "mazo" &&
      juego.equipoGanador === liquidacionMazo.equipoGanador &&
      liquidacionMazo.causa === "mazo";
    if (!baseValida) return false;
    if (liquidacionMazo.puntos === "realizada") {
      const nivel = truco?.apuestaActiva?.nivel ?? null;
      const adjudicacionEsperada = truco
        ? {
            equipo: liquidacionMazo.equipoGanador,
            puntos: puntosPorApuestaTruco(nivel),
            motivo: "mazo" as const,
            nivel,
          }
        : null;
      const adjudicacion = liquidacionMazo.adjudicacionTruco;
      return (
        !!flor &&
        !!truco &&
        !!envido &&
        liquidacionMazo.oportunidadFlor === null &&
        flor.pendiente === null &&
        flor.anuncios.length === 0 &&
        flor.adjudicaciones.length === 0 &&
        envido.pendiente === null &&
        envido.resueltos.length === 0 &&
        truco.propuestaPendiente === null &&
        !!adjudicacion &&
        Object.keys(adjudicacion).length === 4 &&
        adjudicacion.equipo === adjudicacionEsperada?.equipo &&
        adjudicacion.puntos === adjudicacionEsperada?.puntos &&
        adjudicacion.motivo === adjudicacionEsperada?.motivo &&
        adjudicacion.nivel === adjudicacionEsperada?.nivel &&
        ciclo.fase === "liquidacion" &&
        ciclo.equipoGanador === liquidacionMazo.equipoGanador &&
        ciclo.causa === "mazo"
      );
    }
    return (
      liquidacionMazo.puntos === "pendiente" &&
      liquidacionMazo.adjudicacionTruco === null &&
      (liquidacionMazo.oportunidadFlor?.estado === "consumida"
        ? liquidacionMazo.oportunidadFlor.duracionMs === 10000 &&
          !!flor?.anuncios.some((anuncio) => anuncio.jugador === liquidacionMazo.oportunidadFlor?.jugador)
        : elegible === null
        ? liquidacionMazo.oportunidadFlor === null
        : liquidacionMazo.oportunidadFlor?.jugador === elegible &&
          liquidacionMazo.oportunidadFlor.duracionMs === 10000 &&
          liquidacionMazo.oportunidadFlor.estado === "pendiente") &&
      ciclo.fase === "victoria-competitiva-determinada" &&
      ciclo.equipoGanador === liquidacionMazo.equipoGanador &&
      ciclo.causa === "mazo"
    );
  }
  if (!esEstadoCicloManoValido(ciclo, juego.mano.equipos)) return false;
  if (resultadoPartida)
    return (
      ciclo.fase === "cierre-definitivo" &&
      ciclo.causa === "contra-flor-al-resto" &&
      ciclo.equipoGanador === resultadoPartida.equipoGanador
    );
  if (juego.finalizada)
    return (
      ciclo.fase === "cierre-definitivo" &&
      ciclo.causa === juego.motivoFinalizacion &&
      ciclo.equipoGanador === juego.equipoGanador
    );
  // A.1 no posee todavía un hecho canónico que habilite victoria diferida o
  // liquidación: esas fases quedan tipadas, pero no utilizables públicamente.
  return ciclo.fase === "competencia-activa";
}
function cicloCerrado(
  juego: EstadoJuegoCartas,
  resultadoPartida: EstadoManoCoordinada["resultadoPartida"],
  cicloAnterior: EstadoCicloMano,
): EstadoCicloMano {
  if (resultadoPartida)
    return {
      fase: "cierre-definitivo",
      equipoGanador: resultadoPartida.equipoGanador,
      causa: "contra-flor-al-resto",
    };
  if (juego.finalizada && juego.equipoGanador && juego.motivoFinalizacion)
    return {
      fase: "cierre-definitivo",
      equipoGanador: juego.equipoGanador,
      causa: juego.motivoFinalizacion,
    };
  return cicloAnterior;
}
export function obtenerContextoEnvido(
  juego: EstadoJuegoCartas,
  contextoInicio: ContextoInicioMano,
): ContextoEnvido {
  return {
    mesa: juego.mano.mesa,
    manoOriginal: juego.mano.manoOriginal,
    muestra: juego.mano.muestra,
    manos: juego.mano.manos,
    equipos: juego.mano.equipos,
    jugadorTurno: juego.jugadorTurno,
    bazasCompletadas: juego.bazasCompletadas.length,
    finalizada: juego.finalizada,
    falta: {
      meta: contextoInicio.metaPuntos,
      puntajesIniciales: contextoInicio.puntajesIniciales,
      desempate: contextoInicio.esDesempate,
    },
  };
}
export function obtenerContextoFlor(
  juego: EstadoJuegoCartas,
  contextoInicio: ContextoInicioMano,
  faseFlorConfirmada = false,
): ContextoFlor {
  return {
    jugadores: juego.mano.manos.map((mano) => ({
      id: mano.jugador,
      equipo: juego.mano.mesa.jugadores.find((jugador) => jugador.id === mano.jugador)!.equipo,
      cartas: mano.cartas,
      jugoPrimeraCarta:
        (juego.cartasDisponibles.find((disponibles) => disponibles.jugador === mano.jugador)?.cartas
          .length ?? 0) < 3,
    })),
    muestra: juego.mano.muestra,
    jugadorTurno: juego.jugadorTurno,
    ordenMano: juego.mano.ordenReparto,
    desempate: contextoInicio.esDesempate,
    faseFlorConfirmada,
  };
}
/** Contexto de solo lectura de Truco derivado de los dominios canónicos. */
export function obtenerContextoTruco(
  juego: EstadoJuegoCartas,
  envido: EstadoEnvidoDominio,
  flor: EstadoFlorDominio,
): ContextoTruco {
  return {
    jugadores: juego.mano.mesa.jugadores.map((jugador) => ({
      id: jugador.id,
      equipo: jugador.equipo,
    })),
    jugadorTurno: juego.jugadorTurno,
    manoFinalizada: juego.finalizada,
    florPendiente: flor.pendiente !== null,
    envidoPendiente: envido.pendiente !== null,
  };
}
function rechazo(codigo: string, mensaje: string) {
  return { aceptada: false as const, rechazo: { codigo, mensaje } };
}
function faseFlorConfirmable(estado: EstadoFlorDominio, contexto: ContextoFlor): boolean {
  return (
    !estado.cerrado &&
    !estado.pendiente &&
    !hayDerechosFlor(estado, contexto) &&
    (estado.oportunidadDesafioConsumida ||
      estado.historialDesafios.some((desafio) => desafio.respuesta !== null))
  );
}
/**
 * §7.7 y Reglamento v1.4: la única excepción de turno para el primer anuncio
 * queda encapsulada en la acción coordinada Con Flor Quiero.
 */
function anunciarFlorDentroDeConFlorQuiero(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
) {
  const contextoDeAnuncio =
    estado.anuncios.length === 0 && contexto.jugadorTurno !== jugador
      ? { ...contexto, jugadorTurno: jugador }
      : contexto;
  return anunciarFlor(estado, contextoDeAnuncio, jugador);
}
function integrarResultadoFlor(estado: EstadoManoCoordinada, flor: EstadoFlorDominio) {
  const resultadoPartida = flor.resultadoTerminal
    ? {
        motivo: "contra-flor-al-resto" as const,
        equipoGanador: flor.resultadoTerminal.equipo,
      }
    : null;
  return {
    estado: {
      ...estado,
      flor,
      resultadoPartida,
      ciclo: cicloCerrado(estado.juego, resultadoPartida, estado.ciclo),
    },
    eventos: resultadoPartida
      ? [{ tipo: "partida-terminada-contra-flor-al-resto" as const, ...resultadoPartida }]
      : [],
  };
}
function adjudicacionTrucoPorBazas(
  juego: EstadoJuegoCartas,
  truco: EstadoTrucoDominio,
): AdjudicacionTrucoPorBazas | null {
  if (juego.motivoFinalizacion !== "bazas" || !juego.equipoGanador || truco.propuestaPendiente)
    return null;
  const nivel = truco.apuestaActiva?.nivel ?? null;
  const puntos = puntosPorApuestaTruco(nivel);
  return { equipo: juego.equipoGanador, puntos, motivo: "bazas", nivel };
}
function puntosPorApuestaTruco(nivel: NivelApuestaTruco | null): 1 | 2 | 3 | 4 {
  return nivel === "truco" ? 2 : nivel === "retruco" ? 3 : nivel === "vale-cuatro" ? 4 : 1;
}
/** AUD-07: consulta pura; no crea ni consume la oportunidad excepcional. */
export function obtenerElegibleFlorExcepcional(
  estado: EstadoManoCoordinada,
): string | null {
  const juego = estado?.juego;
  if (
    !juego ||
    juego.mano.mesa.modalidad !== "1v1" ||
    !juego.finalizada ||
    juego.motivoFinalizacion !== "mazo" ||
    !juego.equipoGanador
  )
    return null;
  const ganador = juego.mano.mesa.jugadores.find((jugador) => jugador.equipo === juego.equipoGanador);
  if (!ganador || !estaActivo(juego, ganador.id)) return null;
  const mano = juego.mano.manos.find((item) => item.jugador === ganador.id);
  return mano &&
    tieneFlorCalculada(mano.cartas, juego.mano.muestra) &&
    !estado.flor.anuncios.some((anuncio) => anuncio.jugador === ganador.id)
    ? ganador.id
    : null;
}
export function ejecutarAccionCoordinada(estado: EstadoManoCoordinada, accion: AccionCoordinada) {
  if (!estado || !esEstadoJuegoCartasValido(estado.juego))
    return rechazo("estado-invalido", "Estado de cartas inválido.");
  if (!validarContextoInicioMano(estado.juego, estado.contextoInicio))
    return rechazo("contexto-inicial-invalido", "Contexto inicial inválido.");
  if (!esCicloCoherenteConEstado(
    estado.ciclo,
    estado.juego,
    estado.resultadoPartida,
    estado.liquidacionMazo,
    estado.flor,
    estado.truco,
    estado.envido,
  ))
    return rechazo("estado-invalido", "Ciclo de mano incoherente con el estado canónico.");
  if (
    estado.resultadoPartida !== null &&
    (!estado.resultadoPartida ||
      estado.resultadoPartida.motivo !== "contra-flor-al-resto" ||
      !estado.juego.mano.equipos.includes(estado.resultadoPartida.equipoGanador))
  )
    return rechazo("estado-invalido", "Resultado de partida inválido.");
  const contexto = obtenerContextoEnvido(estado.juego, estado.contextoInicio);
  if (!esEstadoEnvidoValido(estado.envido, contexto))
    return rechazo("estado-invalido", "Estado de Envido inválido.");
  const contextoFlor = obtenerContextoFlor(estado.juego, estado.contextoInicio);
  if (!esEstadoFlorValido(estado.flor, contextoFlor))
    return rechazo("estado-invalido", "Estado de Flor invÃ¡lido.");
  if (
    !esEstadoTrucoValido(
      estado.truco,
      obtenerContextoTruco(estado.juego, estado.envido, estado.flor),
    )
  )
    return rechazo("estado-invalido", "Estado de Truco inválido.");
  if (
    estado.resultadoPartida !== null
      ? estado.flor.resultadoTerminal?.equipo !== estado.resultadoPartida.equipoGanador
      : estado.flor.resultadoTerminal !== null
  )
    return rechazo("estado-invalido", "Resultado terminal de Flor incoherente.");
  if (
    estado.flor.derechosPerdidos.some(
      (jugador) =>
        (estado.juego.cartasDisponibles.find((disponibles) => disponibles.jugador === jugador)
          ?.cartas.length ?? 3) === 3,
    )
  )
    return rechazo("estado-invalido", "Derecho de Flor perdido sin primera carta jugada.");
  if (estado.envido.pendiente && estado.flor.anuncios.length > 0)
    return rechazo("estado-invalido", "Envido pendiente incompatible con Flor anunciada.");
  if (estado.resultadoPartida)
    return rechazo("partida-finalizada", "La partida ya tiene un resultado terminal.");
  const oportunidad = estado.liquidacionMazo?.oportunidadFlor;
  if (estado.juego.finalizada) {
    if (accion?.tipo === "liquidar-puntos-mazo") {
      const liquidacion = estado.liquidacionMazo;
      if (
        !liquidacion ||
        estado.juego.mano.mesa.modalidad !== "1v1" ||
        liquidacion.puntos !== "pendiente" ||
        liquidacion.adjudicacionTruco !== null ||
        liquidacion.oportunidadFlor !== null ||
        estado.flor.pendiente !== null ||
        estado.flor.anuncios.length !== 0 ||
        estado.flor.adjudicaciones.length !== 0 ||
        estado.envido.pendiente !== null ||
        estado.envido.resueltos.length !== 0 ||
        estado.truco.propuestaPendiente !== null
      )
        return rechazo("liquidacion-mazo-no-disponible", "La liquidación de mano por mazo no está disponible.");
      const nivel = estado.truco.apuestaActiva?.nivel ?? null;
      const adjudicacion: AdjudicacionTrucoPorBazas = {
        equipo: liquidacion.equipoGanador,
        puntos: puntosPorApuestaTruco(nivel),
        motivo: "mazo",
        nivel,
      };
      const jugadorRetirado = estado.juego.retirados[0];
      if (!jugadorRetirado)
        return rechazo("estado-invalido", "No existe un jugador retirado para liquidar el mazo.");
      return {
        aceptada: true as const,
        estado: {
          ...estado,
          liquidacionMazo: {
            ...liquidacion,
            puntos: "realizada",
            adjudicacionTruco: adjudicacion,
          },
          ciclo: { fase: "liquidacion", equipoGanador: liquidacion.equipoGanador, causa: "mazo" },
        },
        eventos: [{ tipo: "mazo-adjudicado", jugadorRetirado, adjudicacion }],
      };
    }
    if ((accion?.tipo !== "anunciar-flor" && accion?.tipo !== "vencer-oportunidad-flor") || !oportunidad || oportunidad.estado !== "pendiente")
      return rechazo("mano-finalizada", "La mano ya finalizó.");
    if (accion.jugador !== oportunidad.jugador)
      return rechazo("oportunidad-flor-invalida", "La oportunidad pertenece a otro jugador.");
    const anuncio = anunciarFlorDentroDeConFlorQuiero(estado.flor, contextoFlor, accion.jugador);
    if (!anuncio.aceptada) return rechazo(anuncio.codigo, "Anuncio excepcional rechazado.");
    return {
      aceptada: true as const,
      estado: {
        ...estado,
        flor: anuncio.estado,
        liquidacionMazo: { ...estado.liquidacionMazo!, oportunidadFlor: { ...oportunidad, estado: "consumida" } },
      },
      eventos: anuncio.eventos,
    };
  }
  if (accion?.tipo === "liquidar-puntos-mazo")
    return rechazo("liquidacion-mazo-no-disponible", "La mano aún no está disponible para liquidación por mazo.");
  if (accion?.tipo === "irse-al-mazo") {
    if (estado.juego.mano.mesa.modalidad !== "1v1")
      return rechazo("mazo-2v2-no-implementado", "Irse al mazo en 2v2 aún no está implementado.");
    if (estado.envido.pendiente)
      return rechazo("envido-pendiente", "El Envido debe resolverse antes del mazo.");
    if (estado.flor.pendiente)
      return rechazo("flor-pendiente", "La Flor debe resolverse antes del mazo.");
    if (estado.truco.propuestaPendiente)
      return rechazo("truco-pendiente", "El Truco debe resolverse antes del mazo.");
    const retirado = estado.juego.mano.mesa.jugadores.find(
      (jugador) => jugador.id === accion.jugador,
    );
    if (!retirado) return rechazo("jugador-inexistente", "Jugador inexistente.");
    const equipoGanador = estado.juego.mano.equipos.find((equipo) => equipo !== retirado.equipo)!;
    const cierre = finalizarManoPorMazo(estado.juego, equipoGanador, accion.jugador);
    if (!cierre.aceptada)
      return rechazo(cierre.rechazo.codigo, "No se pudo finalizar la mano por mazo.");
    return {
      aceptada: true as const,
      estado: {
        ...estado,
        juego: cierre.estado,
        liquidacionMazo: {
          equipoGanador,
          causa: "mazo",
          puntos: "pendiente",
          adjudicacionTruco: null,
          oportunidadFlor: (() => {
            const jugador = obtenerElegibleFlorExcepcional({ ...estado, juego: cierre.estado });
            return jugador ? { jugador, estado: "pendiente" as const, duracionMs: 10000 as const } : null;
          })(),
        },
        ciclo: { fase: "victoria-competitiva-determinada", equipoGanador, causa: "mazo" },
      },
      eventos: [...cierre.eventos],
    };
  }
  if (accion?.tipo === "con-flor-quiero") {
    const propuesta = estado.truco.propuestaPendiente;
    if (!propuesta)
      return rechazo("sin-propuesta-pendiente", "No hay propuesta de Truco pendiente.");
    if (estado.flor.pendiente)
      return rechazo("flor-pendiente", "La Flor debe resolverse antes de responder Truco.");
    const flor = anunciarFlorDentroDeConFlorQuiero(estado.flor, contextoFlor, accion.jugador);
    if (!flor.aceptada) return rechazo(flor.codigo, "Acción Con Flor Quiero rechazada.");
    const contextoCierre = obtenerContextoFlor(
      estado.juego,
      estado.contextoInicio,
      faseFlorConfirmable(flor.estado, contextoFlor),
    );
    const cierre = contextoCierre.faseFlorConfirmada
      ? confirmarFaseFlor(flor.estado, contextoCierre)
      : { aceptada: true as const, estado: flor.estado, eventos: [] as const };
    if (!cierre.aceptada) return rechazo(cierre.codigo, "No se pudo confirmar la fase de Flor.");
    const envido = estado.envido.pendiente
      ? { ...estado.envido, pendiente: null, iniciado: true }
      : estado.envido;
    const contextoTruco = obtenerContextoTruco(estado.juego, envido, cierre.estado);
    const truco =
      propuesta.nivel === "truco"
        ? responderQuieroTruco(estado.truco, contextoTruco, accion.jugador)
        : propuesta.nivel === "retruco"
          ? responderQuieroRetruco(estado.truco, contextoTruco, accion.jugador)
          : responderQuieroValeCuatro(estado.truco, contextoTruco, accion.jugador);
    if (!truco.aceptada) return rechazo(truco.codigo, "Respuesta de Truco rechazada.");
    const integradoFlor = integrarResultadoFlor(estado, cierre.estado);
    const integrado = { ...integradoFlor.estado, envido, truco: truco.estado };
    if (
      !esEstadoFlorValido(integrado.flor, contextoCierre) ||
      !esEstadoTrucoValido(integrado.truco, contextoTruco)
    )
      return rechazo("resultado-invalido", "Resultado de Con Flor Quiero inválido.");
    return {
      aceptada: true as const,
      estado: integrado,
      eventos: [
        ...flor.eventos,
        ...cierre.eventos,
        ...integradoFlor.eventos,
        ...(estado.envido.pendiente ? [{ tipo: "envido-cancelado-por-flor" as const }] : []),
        ...truco.eventos,
      ],
    };
  }
  if (
    accion?.tipo === "proponer-truco" ||
    accion?.tipo === "quiero-truco" ||
    accion?.tipo === "no-quiero-truco" ||
    accion?.tipo === "proponer-retruco" ||
    accion?.tipo === "quiero-retruco" ||
    accion?.tipo === "no-quiero-retruco" ||
    accion?.tipo === "proponer-vale-cuatro" ||
    accion?.tipo === "quiero-vale-cuatro" ||
    accion?.tipo === "no-quiero-vale-cuatro"
  ) {
    const contextoTruco = obtenerContextoTruco(estado.juego, estado.envido, estado.flor);
    const resultado =
      accion.tipo === "proponer-truco"
        ? proponerTruco(estado.truco, contextoTruco, accion.jugador)
        : accion.tipo === "quiero-truco"
          ? responderQuieroTruco(estado.truco, contextoTruco, accion.jugador)
          : accion.tipo === "no-quiero-truco"
            ? responderNoQuieroTruco(estado.truco, contextoTruco, accion.jugador)
            : accion.tipo === "proponer-retruco"
              ? proponerRetruco(estado.truco, contextoTruco, accion.jugador)
              : accion.tipo === "quiero-retruco"
                ? responderQuieroRetruco(estado.truco, contextoTruco, accion.jugador)
                : accion.tipo === "no-quiero-retruco"
                  ? responderNoQuieroRetruco(estado.truco, contextoTruco, accion.jugador)
                  : accion.tipo === "proponer-vale-cuatro"
                    ? proponerValeCuatro(estado.truco, contextoTruco, accion.jugador)
                    : accion.tipo === "quiero-vale-cuatro"
                      ? responderQuieroValeCuatro(estado.truco, contextoTruco, accion.jugador)
                      : responderNoQuieroValeCuatro(estado.truco, contextoTruco, accion.jugador);
    if (!resultado.aceptada) return rechazo(resultado.codigo, "AcciÃ³n de Truco rechazada.");
    const eventoRechazo = resultado.eventos[0];
    const esRechazo =
      "adjudicacion" in eventoRechazo &&
      eventoRechazo.manoFinalizada === true &&
      eventoRechazo.adjudicacion.motivo === "rechazo";
    const cierre = esRechazo
      ? finalizarManoPorRechazoTruco(estado.juego, eventoRechazo.adjudicacion.equipo)
      : null;
    if (cierre && !cierre.aceptada)
      return rechazo(cierre.rechazo.codigo, "No se pudo finalizar la mano por rechazo de Truco.");
    const juegoIntegrado = cierre?.estado ?? estado.juego;
    const integrado = {
      ...estado,
      juego: juegoIntegrado,
      truco: resultado.estado,
      ciclo: cicloCerrado(juegoIntegrado, estado.resultadoPartida, estado.ciclo),
    };
    if (!esEstadoTrucoValido(integrado.truco, contextoTruco))
      return rechazo("resultado-invalido", "Resultado de Truco invÃ¡lido.");
    return {
      aceptada: true as const,
      estado: integrado,
      eventos: [...resultado.eventos, ...(cierre?.eventos ?? [])],
    };
  }
  if (accion?.tipo === "jugar-carta") {
    if (estado.envido.pendiente)
      return rechazo("envido-pendiente", "El Envido debe resolverse antes de jugar carta.");
    if (estado.flor.pendiente)
      return rechazo("flor-pendiente", "La Flor debe resolverse antes de jugar carta.");
    if (estado.truco.propuestaPendiente)
      return rechazo("truco-pendiente", "El Truco debe resolverse antes de jugar carta.");
    const jugador = contextoFlor.jugadores.find(
      (participante) => participante.id === accion.jugador,
    );
    const pierdeFlor =
      !!jugador &&
      !jugador.jugoPrimeraCarta &&
      tieneFlorCalculada(jugador.cartas, contextoFlor.muestra) &&
      !estado.flor.anuncios.some((anuncio) => anuncio.jugador === jugador.id) &&
      !estado.flor.derechosPerdidos.includes(jugador.id);
    const flor = pierdeFlor
      ? perderDerechoFlor(estado.flor, contextoFlor, accion.jugador)
      : { aceptada: true as const, estado: estado.flor, eventos: [] as const };
    if (!flor.aceptada) return rechazo(flor.codigo, "No se pudo actualizar el derecho de Flor.");
    const resultado = ejecutarCarta(estado.juego, accion, undefined);
    if (!resultado.aceptada) return resultado;
    const ambosEquiposAnunciaron =
      new Set(flor.estado.anuncios.map((anuncio) => anuncio.equipo)).size === 2;
    const consumeOportunidad =
      ambosEquiposAnunciaron &&
      !flor.estado.cerrado &&
      !flor.estado.pendiente &&
      !flor.estado.oportunidadDesafioConsumida;
    const oportunidad = consumeOportunidad
      ? consumirOportunidadDesafioFlor(flor.estado, contextoFlor)
      : { aceptada: true as const, estado: flor.estado, eventos: [] as const };
    if (!oportunidad.aceptada)
      return rechazo(oportunidad.codigo, "No se pudo consumir la oportunidad de desafío.");
    const contextoPosterior = obtenerContextoFlor(
      resultado.estado,
      estado.contextoInicio,
      faseFlorConfirmable(
        oportunidad.estado,
        obtenerContextoFlor(resultado.estado, estado.contextoInicio),
      ),
    );
    const cierre = contextoPosterior.faseFlorConfirmada
      ? confirmarFaseFlor(oportunidad.estado, contextoPosterior)
      : { aceptada: true as const, estado: oportunidad.estado, eventos: [] as const };
    if (!cierre.aceptada) return rechazo(cierre.codigo, "No se pudo confirmar la fase de Flor.");
    const integrado = integrarResultadoFlor(estado, cierre.estado);
    const adjudicacionTruco = adjudicacionTrucoPorBazas(resultado.estado, estado.truco);
    return {
      aceptada: true as const,
      estado: {
        ...integrado.estado,
        juego: resultado.estado,
        ciclo: cicloCerrado(
          resultado.estado,
          integrado.estado.resultadoPartida,
          integrado.estado.ciclo,
        ),
      },
      eventos: [
        ...flor.eventos,
        ...oportunidad.eventos,
        ...cierre.eventos,
        ...integrado.eventos,
        ...resultado.eventos,
        ...(adjudicacionTruco
          ? [{ tipo: "truco-adjudicado-por-bazas" as const, adjudicacion: adjudicacionTruco }]
          : []),
      ],
    };
  }
  if (accion?.tipo === "anunciar-flor") {
    const resultado = anunciarFlor(estado.flor, contextoFlor, accion.jugador);
    if (!resultado.aceptada) return rechazo(resultado.codigo, "AcciÃ³n de Flor rechazada.");
    const contextoCierre = obtenerContextoFlor(
      estado.juego,
      estado.contextoInicio,
      faseFlorConfirmable(resultado.estado, contextoFlor),
    );
    const cierre = contextoCierre.faseFlorConfirmada
      ? confirmarFaseFlor(resultado.estado, contextoCierre)
      : { aceptada: true as const, estado: resultado.estado, eventos: [] as const };
    if (!cierre.aceptada) return rechazo(cierre.codigo, "No se pudo confirmar la fase de Flor.");
    const envidoCancelado = estado.envido.pendiente
      ? { ...estado.envido, pendiente: null, iniciado: true }
      : estado.envido;
    const integrado = integrarResultadoFlor(estado, cierre.estado);
    return {
      aceptada: true as const,
      estado: { ...integrado.estado, envido: envidoCancelado },
      eventos: [
        ...resultado.eventos,
        ...cierre.eventos,
        ...integrado.eventos,
        ...(estado.envido.pendiente ? [{ tipo: "envido-cancelado-por-flor" as const }] : []),
      ],
    };
  }
  if (accion?.tipo === "proponer-contra-flor" || accion?.tipo === "proponer-contra-flor-al-resto") {
    const resultado =
      accion.tipo === "proponer-contra-flor"
        ? proponerContraFlor(estado.flor, contextoFlor, accion.jugador)
        : proponerContraFlorAlResto(estado.flor, contextoFlor, accion.jugador);
    if (!resultado.aceptada) return rechazo(resultado.codigo, "Desafío de Flor rechazado.");
    return {
      aceptada: true as const,
      estado: { ...estado, flor: resultado.estado },
      eventos: resultado.eventos,
    };
  }
  if (
    accion?.tipo === "quiero-contra-flor" ||
    accion?.tipo === "no-quiero-contra-flor" ||
    accion?.tipo === "quiero-contra-flor-al-resto" ||
    accion?.tipo === "no-quiero-contra-flor-al-resto"
  ) {
    const respuesta = accion.tipo.startsWith("quiero") ? "quiero" : "no-quiero";
    const resultado = accion.tipo.endsWith("al-resto")
      ? responderContraFlorAlResto(estado.flor, contextoFlor, accion.jugador, respuesta)
      : responderContraFlor(estado.flor, contextoFlor, accion.jugador, respuesta);
    if (!resultado.aceptada) return rechazo(resultado.codigo, "Respuesta de Flor rechazada.");
    const contextoCierre = obtenerContextoFlor(
      estado.juego,
      estado.contextoInicio,
      faseFlorConfirmable(resultado.estado, contextoFlor),
    );
    const cierre = contextoCierre.faseFlorConfirmada
      ? confirmarFaseFlor(resultado.estado, contextoCierre)
      : { aceptada: true as const, estado: resultado.estado, eventos: [] as const };
    if (!cierre.aceptada) return rechazo(cierre.codigo, "No se pudo confirmar la fase de Flor.");
    const integrado = integrarResultadoFlor(estado, cierre.estado);
    return {
      aceptada: true as const,
      estado: integrado.estado,
      eventos: [...resultado.eventos, ...cierre.eventos, ...integrado.eventos],
    };
  }
  if (
    !accion ||
    !["iniciar-envido", "aumentar-envido", "quiero-envido", "no-quiero-envido"].includes(
      accion.tipo,
    )
  )
    return rechazo("accion-invalida", "Acción coordinada inválida.");
  if (estado.flor.pendiente)
    return rechazo("flor-pendiente", "La Flor debe resolverse antes de Envido.");
  if (accion.tipo === "iniciar-envido") {
    const participante = contextoFlor.jugadores.find((jugador) => jugador.id === accion.jugador);
    const conservaDerechoFlor =
      !!participante &&
      !participante.jugoPrimeraCarta &&
      tieneFlorCalculada(participante.cartas, contextoFlor.muestra) &&
      !estado.flor.anuncios.some((anuncio) => anuncio.jugador === participante.id) &&
      !estado.flor.derechosPerdidos.includes(participante.id);
    if (conservaDerechoFlor)
      return rechazo("flor-no-anunciada", "Debe anunciar Flor antes de proponer Envido.");
    if (estado.flor.anuncios.length > 0 && !estado.flor.cerrado)
      return rechazo("flor-prioritaria", "La fase de Flor tiene prioridad sobre Envido.");
  }
  const resultado =
    accion.tipo === "iniciar-envido"
      ? iniciarEnvido(estado.envido, contexto, accion.jugador, accion.canto)
      : accion.tipo === "aumentar-envido"
        ? aumentarEnvidoEnJuego(estado.envido, contexto, accion.jugador, accion.canto)
        : accion.tipo === "quiero-envido"
          ? responderQuiero(estado.envido, contexto, accion.jugador)
          : responderNoQuiero(estado.envido, contexto, accion.jugador);
  if (!resultado.aceptada) return rechazo(resultado.codigo, "Acción de Envido rechazada.");
  const integrado = { ...estado, envido: resultado.estado };
  if (!esEstadoEnvidoValido(integrado.envido, contexto))
    return rechazo("resultado-invalido", "Resultado de Envido inválido.");
  return { aceptada: true as const, estado: integrado, eventos: resultado.eventos };
}
