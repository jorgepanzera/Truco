import type { MetaPuntos } from "@truco/shared";
import {
  aumentarEnvidoEnJuego,
  cancelarEnvidoPorFlor,
  crearEstadoEnvido,
  esEstadoEnvidoValido,
  iniciarEnvido,
  liquidarEnvidoPorRetiro,
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
  liquidarFlorPorRetiro,
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
  liquidarTrucoPorRetiro,
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
  adjudicacionTruco: AdjudicacionTrucoCanonica | null;
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
  | Readonly<{ tipo: "cerrar-mano-mazo" }>
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
/** Registro único por mano; se extenderá con bazas, mazo y rechazo implícito. */
export type AdjudicacionTrucoCanonica =
  | Readonly<{
      causa: "rechazo-voluntario";
      equipo: string;
      puntos: 1 | 2 | 3;
      nivelPropuesto: NivelApuestaTruco;
      propuestaOrden: 1 | 2 | 3;
      respondedor: string;
    }>
  | Readonly<{
      causa: "mano-por-bazas";
      equipo: string;
      puntos: 1 | 2 | 3 | 4;
      nivelAceptado: NivelApuestaTruco | null;
    }>
  | Readonly<{
      causa: "mano-por-mazo";
      equipo: string;
      puntos: 1 | 2 | 3 | 4;
      nivelAceptado: NivelApuestaTruco | null;
    }>
  | Readonly<{
      causa: "rechazo-implicito-por-retiro";
      equipo: string;
      puntos: 1 | 2 | 3;
      nivelPropuesto: NivelApuestaTruco;
      propuestaOrden: 1 | 2 | 3;
      jugadorRetirado: string;
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
    adjudicacionTruco: null,
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
  adjudicacionTruco: AdjudicacionTrucoCanonica | null = null,
): boolean {
  const liquidacionEnvido = envido?.liquidacionPorRetiro;
  if (liquidacionEnvido != null && liquidacionMazo === null) return false;
  const retiradoEnvido = liquidacionEnvido
    ? juego.mano.mesa.jugadores.find((jugador) => jugador.id === liquidacionEnvido.jugadorRetirado)
    : undefined;
  if (liquidacionEnvido != null) {
    const retiroEnvidoCoherente =
      juego.mano.mesa.modalidad === "1v1" &&
      juego.retirados.length === 1 &&
      juego.retirados[0] === liquidacionEnvido.jugadorRetirado &&
      !!retiradoEnvido &&
      juego.equipoGanador !== null &&
      juego.equipoGanador !== retiradoEnvido.equipo &&
      (liquidacionEnvido.causa === "propuesta-cancelada-por-retiro"
        ? liquidacionEnvido.equipo === retiradoEnvido.equipo
        : liquidacionEnvido.equipo === juego.equipoGanador);
    if (!retiroEnvidoCoherente) return false;
  }
  if (liquidacionMazo !== null) {
    const propuestaCancelada = Array.isArray(truco?.historialPropuestas)
      ? truco.historialPropuestas.at(-1)
      : undefined;
    const cancelacionPorRetiroCoherente =
      propuestaCancelada?.respuesta !== "cancelada-por-retiro" ||
      (juego.mano.mesa.modalidad === "1v1" &&
        juego.retirados.length === 1 &&
        juego.retirados.includes(propuestaCancelada.proponente) &&
        juego.mano.mesa.jugadores.some(
          (jugador) =>
            jugador.id === propuestaCancelada.proponente &&
            jugador.equipo === propuestaCancelada.equipoProponente &&
            jugador.equipo !== juego.equipoGanador,
        ));
    const elegible = flor
      ? obtenerElegibleFlorExcepcional({ juego, flor } as EstadoManoCoordinada)
      : null;
    const baseValida =
      juego.finalizada &&
      juego.motivoFinalizacion === "mazo" &&
      juego.equipoGanador === liquidacionMazo.equipoGanador &&
      liquidacionMazo.causa === "mazo" &&
      cancelacionPorRetiroCoherente &&
      (liquidacionEnvido === null || liquidacionMazo.equipoGanador === juego.equipoGanador);
    if (!baseValida) return false;
    if (liquidacionMazo.puntos === "realizada") {
      const nivel = truco?.apuestaActiva?.nivel ?? null;
      const adjudicacionEsperada = truco
        ? {
            equipo: liquidacionMazo.equipoGanador,
            puntos: puntosPorApuestaTruco(nivel),
            causa: "mano-por-mazo" as const,
            nivelAceptado: nivel,
          }
        : null;
      return (
        !!flor &&
        !!truco &&
        !!envido &&
        (liquidacionMazo.oportunidadFlor === null ||
          esOportunidadFlorConsumidaCoherente(juego, flor, liquidacionMazo.oportunidadFlor)) &&
        flor.pendiente === null &&
        (flor.anuncios.length === 0
          ? flor.adjudicaciones.length === 0
          : flor.cerrado && flor.adjudicaciones.length > 0) &&
        envido.pendiente === null &&
        // Las adjudicaciones de Envido son hechos canónicos previos al mazo:
        // se conservan, pero nunca se vuelven a emitir ni liquidar aquí.
        truco.propuestaPendiente === null &&
        adjudicacionTruco?.causa === "mano-por-mazo" &&
        adjudicacionTruco.equipo === adjudicacionEsperada?.equipo &&
        adjudicacionTruco.puntos === adjudicacionEsperada?.puntos &&
        adjudicacionTruco.nivelAceptado === adjudicacionEsperada?.nivelAceptado &&
        (ciclo.fase === "liquidacion" || ciclo.fase === "cierre-definitivo") &&
        ciclo.equipoGanador === liquidacionMazo.equipoGanador &&
        ciclo.causa === "mazo"
      );
    }
    return (
      liquidacionMazo.puntos === "pendiente" &&
      adjudicacionTruco === null &&
      (liquidacionMazo.oportunidadFlor?.estado === "consumida"
        ? !!flor && esOportunidadFlorConsumidaCoherente(juego, flor, liquidacionMazo.oportunidadFlor)
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
  const propuestaRechazada = Array.isArray(truco?.historialPropuestas)
    ? truco.historialPropuestas.at(-1)
    : undefined;
  const adjudicacionRechazoVoluntario =
    adjudicacionTruco?.causa === "rechazo-voluntario" ? adjudicacionTruco : null;
  const rechazoVoluntarioCoherente =
    !!adjudicacionRechazoVoluntario &&
    !!truco &&
    propuestaRechazada?.respuesta === "no-quiero" &&
    propuestaRechazada.orden === adjudicacionRechazoVoluntario.propuestaOrden &&
    propuestaRechazada.nivel === adjudicacionRechazoVoluntario.nivelPropuesto &&
    propuestaRechazada.equipoProponente === adjudicacionRechazoVoluntario.equipo &&
    propuestaRechazada.respondedor === adjudicacionRechazoVoluntario.respondedor &&
    juego.mano.mesa.jugadores.some(
      (jugador) =>
        jugador.id === adjudicacionRechazoVoluntario.respondedor &&
        jugador.equipo !== adjudicacionRechazoVoluntario.equipo,
    ) &&
    adjudicacionRechazoVoluntario.puntos ===
      (adjudicacionRechazoVoluntario.nivelPropuesto === "truco"
        ? 1
        : adjudicacionRechazoVoluntario.nivelPropuesto === "retruco"
          ? 2
          : 3) &&
    juego.finalizada &&
    juego.motivoFinalizacion === "rechazo-truco" &&
    juego.equipoGanador === adjudicacionRechazoVoluntario.equipo;
  const adjudicacionRechazoImplicito =
    adjudicacionTruco?.causa === "rechazo-implicito-por-retiro" ? adjudicacionTruco : null;
  const rechazoImplicitoCoherente =
    !!adjudicacionRechazoImplicito &&
    !!truco &&
    propuestaRechazada?.respuesta === "rechazo-implicito-por-retiro" &&
    propuestaRechazada.orden === adjudicacionRechazoImplicito.propuestaOrden &&
    propuestaRechazada.nivel === adjudicacionRechazoImplicito.nivelPropuesto &&
    propuestaRechazada.equipoProponente === adjudicacionRechazoImplicito.equipo &&
    propuestaRechazada.jugadorRetirado === adjudicacionRechazoImplicito.jugadorRetirado &&
    juego.mano.mesa.jugadores.some(
      (jugador) =>
        jugador.id === adjudicacionRechazoImplicito.jugadorRetirado &&
        jugador.equipo !== adjudicacionRechazoImplicito.equipo,
    ) &&
    adjudicacionRechazoImplicito.puntos ===
      (adjudicacionRechazoImplicito.nivelPropuesto === "truco"
        ? 1
        : adjudicacionRechazoImplicito.nivelPropuesto === "retruco"
          ? 2
          : 3) &&
    juego.finalizada &&
    juego.motivoFinalizacion === "rechazo-truco" &&
    juego.equipoGanador === adjudicacionRechazoImplicito.equipo;
  if (juego.motivoFinalizacion === "rechazo-truco") {
    const equipoGanador = rechazoVoluntarioCoherente
      ? adjudicacionRechazoVoluntario!.equipo
      : rechazoImplicitoCoherente
        ? adjudicacionRechazoImplicito!.equipo
        : null;
    return (
      equipoGanador !== null &&
      ciclo.fase === "cierre-definitivo" &&
      ciclo.causa === "rechazo-truco" &&
      ciclo.equipoGanador === equipoGanador
    );
  }
  const adjudicacionPorBazasEsperada = truco
    ? adjudicacionTrucoPorBazas(juego, truco)
    : null;
  const bazasCoherente =
    adjudicacionTruco?.causa === "mano-por-bazas" &&
    !!adjudicacionPorBazasEsperada &&
    adjudicacionTruco.equipo === adjudicacionPorBazasEsperada.equipo &&
    adjudicacionTruco.puntos === adjudicacionPorBazasEsperada.puntos &&
    adjudicacionTruco.nivelAceptado === adjudicacionPorBazasEsperada.nivel &&
    juego.finalizada &&
    juego.motivoFinalizacion === "bazas" &&
    juego.equipoGanador === adjudicacionTruco.equipo;
  if (juego.motivoFinalizacion === "bazas") {
    return (
      bazasCoherente &&
      ciclo.fase === "cierre-definitivo" &&
      ciclo.causa === "bazas" &&
      ciclo.equipoGanador === adjudicacionTruco!.equipo
    );
  }
  if (adjudicacionTruco !== null) return false;
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
function esCancelacionEnvidoPorFlorCoherente(
  envido: EstadoEnvidoDominio,
  flor: EstadoFlorDominio,
): boolean {
  const cancelacion = envido.cancelacionPorFlor;
  return (
    cancelacion === null ||
    flor.anuncios.some(
      (anuncio) =>
        anuncio.jugador === cancelacion.jugadorFlor && anuncio.equipo === cancelacion.equipoFlor,
    )
  );
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
function esOportunidadFlorConsumidaCoherente(
  juego: EstadoJuegoCartas,
  flor: EstadoFlorDominio,
  oportunidad: NonNullable<EstadoLiquidacionMazo["oportunidadFlor"]>,
): boolean {
  if (
    oportunidad.estado !== "consumida" ||
    oportunidad.duracionMs !== 10000 ||
    juego.mano.mesa.modalidad !== "1v1" ||
    !juego.finalizada ||
    juego.motivoFinalizacion !== "mazo" ||
    !juego.equipoGanador
  )
    return false;
  const jugador = juego.mano.mesa.jugadores.find((item) => item.id === oportunidad.jugador);
  const mano = juego.mano.manos.find((item) => item.jugador === oportunidad.jugador);
  return (
    !!jugador &&
    jugador.equipo === juego.equipoGanador &&
    estaActivo(juego, jugador.id) &&
    !!mano &&
    tieneFlorCalculada(mano.cartas, juego.mano.muestra) &&
    flor.anuncios.some((anuncio) => anuncio.jugador === jugador.id)
  );
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
    estado.adjudicacionTruco,
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
  if (!esCancelacionEnvidoPorFlorCoherente(estado.envido, estado.flor))
    return rechazo("estado-invalido", "Cancelación de Envido por Flor sin respaldo canónico.");
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
    estado.liquidacionMazo === null &&
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
    if (accion?.tipo === "cerrar-mano-mazo") {
      const liquidacion = estado.liquidacionMazo;
      if (
        !liquidacion ||
        estado.juego.mano.mesa.modalidad !== "1v1" ||
        liquidacion.puntos !== "realizada" ||
        estado.adjudicacionTruco?.causa !== "mano-por-mazo" ||
        estado.ciclo.fase !== "liquidacion" ||
        estado.ciclo.equipoGanador !== liquidacion.equipoGanador ||
        estado.ciclo.causa !== "mazo" ||
        estado.flor.pendiente !== null ||
        estado.envido.pendiente !== null ||
        estado.truco.propuestaPendiente !== null
      )
        return rechazo("cierre-mano-mazo-no-disponible", "El cierre definitivo por mazo no está disponible.");
      return {
        aceptada: true as const,
        estado: {
          ...estado,
          ciclo: {
            fase: "cierre-definitivo",
            equipoGanador: liquidacion.equipoGanador,
            causa: "mazo",
          },
        },
        eventos: [] as const,
      };
    }
    if (accion?.tipo === "liquidar-puntos-mazo") {
      const liquidacion = estado.liquidacionMazo;
      if (
        !liquidacion ||
        estado.juego.mano.mesa.modalidad !== "1v1" ||
        liquidacion.puntos !== "pendiente" ||
        estado.adjudicacionTruco !== null ||
        liquidacion.oportunidadFlor?.estado === "pendiente" ||
        estado.flor.pendiente !== null ||
        estado.envido.pendiente !== null ||
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
      const flor = estado.flor.anuncios.length > 0 &&
        !estado.flor.cerrado &&
        estado.flor.adjudicaciones.length === 0
        ? liquidarFlorPorRetiro(estado.flor, contextoFlor, jugadorRetirado)
        : { aceptada: true as const, estado: estado.flor, eventos: [] as const };
      if (!flor.aceptada)
        return rechazo(flor.codigo, "No se pudo liquidar la Flor por mazo.");
      return {
        aceptada: true as const,
        estado: {
          ...estado,
          flor: flor.estado,
          liquidacionMazo: {
            ...liquidacion,
            puntos: "realizada",
          },
          adjudicacionTruco: {
            causa: "mano-por-mazo",
            equipo: adjudicacion.equipo,
            puntos: adjudicacion.puntos,
            nivelAceptado: adjudicacion.nivel,
          },
          ciclo: { fase: "liquidacion", equipoGanador: liquidacion.equipoGanador, causa: "mazo" },
        },
        eventos: [...flor.eventos, { tipo: "mazo-adjudicado", jugadorRetirado, adjudicacion }],
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
    const retirado = estado.juego.mano.mesa.jugadores.find(
      (jugador) => jugador.id === accion.jugador,
    );
    if (!retirado) return rechazo("jugador-inexistente", "Jugador inexistente.");
    const liquidacionFlor = estado.flor.pendiente
      ? liquidarFlorPorRetiro(estado.flor, contextoFlor, accion.jugador)
      : { aceptada: true as const, estado: estado.flor, eventos: [] as const };
    if (!liquidacionFlor.aceptada)
      return rechazo(liquidacionFlor.codigo, "No se pudo liquidar la Flor por retiro.");
    const flor = liquidacionFlor.estado;
    const liquidacionEnvido = estado.envido.pendiente
      ? liquidarEnvidoPorRetiro(estado.envido, contexto, accion.jugador)
      : { aceptada: true as const, estado: estado.envido, eventos: [] as const };
    if (!liquidacionEnvido.aceptada)
      return rechazo(liquidacionEnvido.codigo, "No se pudo liquidar el Envido por retiro.");
    const envido = liquidacionEnvido.estado;
    if (estado.truco.propuestaPendiente) {
      const contextoTruco = obtenerContextoTruco(estado.juego, envido, flor);
      const liquidacionTruco = liquidarTrucoPorRetiro(
        estado.truco,
        contextoTruco,
        accion.jugador,
      );
      if (!liquidacionTruco.aceptada)
        return rechazo(liquidacionTruco.codigo, "No se pudo liquidar el Truco por retiro.");
      if (liquidacionTruco.liquidacion.causa === "propuesta-cancelada-por-retiro") {
        const propuestaCancelada = liquidacionTruco.estado.historialPropuestas.at(-1);
        if (propuestaCancelada?.respuesta !== "cancelada-por-retiro")
          return rechazo("resultado-invalido", "El retiro no tiene respaldo histórico de Truco.");
        const equipoGanador = estado.juego.mano.equipos.find((equipo) => equipo !== retirado.equipo)!;
        const cierre = finalizarManoPorMazo(estado.juego, equipoGanador, accion.jugador);
        if (!cierre.aceptada)
          return rechazo(cierre.rechazo.codigo, "No se pudo finalizar la mano por mazo.");
        return {
          aceptada: true as const,
          estado: {
            ...estado,
            juego: cierre.estado,
            envido,
            flor,
            truco: liquidacionTruco.estado,
            adjudicacionTruco: null,
            liquidacionMazo: {
              equipoGanador,
              causa: "mazo",
              puntos: "pendiente",
              oportunidadFlor: (() => {
                const jugador = obtenerElegibleFlorExcepcional({
                  ...estado,
                  juego: cierre.estado,
                  truco: liquidacionTruco.estado,
                });
                return jugador
                  ? { jugador, estado: "pendiente" as const, duracionMs: 10000 as const }
                  : null;
              })(),
            },
            ciclo: { fase: "victoria-competitiva-determinada", equipoGanador, causa: "mazo" },
          },
          eventos: [...liquidacionFlor.eventos, ...liquidacionEnvido.eventos, ...liquidacionTruco.eventos, ...cierre.eventos],
        };
      }
      if (liquidacionTruco.liquidacion.causa !== "rechazo-implicito-por-retiro")
        return rechazo(
          "retiro-proponente-truco-pendiente-no-implementado",
          "El retiro del proponente con Truco pendiente aún no está implementado.",
        );
      const propuestaRechazada = liquidacionTruco.estado.historialPropuestas.at(-1);
      if (propuestaRechazada?.respuesta !== "rechazo-implicito-por-retiro")
        return rechazo("resultado-invalido", "El retiro no tiene respaldo histórico de Truco.");
      const cierre = finalizarManoPorRechazoTruco(
        estado.juego,
        liquidacionTruco.liquidacion.equipo,
      );
      if (!cierre.aceptada)
        return rechazo(cierre.rechazo.codigo, "No se pudo finalizar la mano por rechazo implícito.");
      const adjudicacionTruco: AdjudicacionTrucoCanonica = {
        causa: "rechazo-implicito-por-retiro",
        equipo: liquidacionTruco.liquidacion.equipo,
        puntos: liquidacionTruco.liquidacion.puntos as 1 | 2 | 3,
        nivelPropuesto: propuestaRechazada.nivel,
        propuestaOrden: propuestaRechazada.orden,
        jugadorRetirado: propuestaRechazada.jugadorRetirado,
      };
      const integrado = {
        ...estado,
        juego: cierre.estado,
        envido,
        flor,
        truco: liquidacionTruco.estado,
        adjudicacionTruco,
        liquidacionMazo: null,
        ciclo: cicloCerrado(cierre.estado, estado.resultadoPartida, estado.ciclo),
      };
      if (!esEstadoTrucoValido(integrado.truco, contextoTruco))
        return rechazo("resultado-invalido", "Resultado de Truco inválido.");
      return {
        aceptada: true as const,
        estado: integrado,
        eventos: [...liquidacionFlor.eventos, ...liquidacionEnvido.eventos, ...liquidacionTruco.eventos, ...cierre.eventos],
      };
    }
    const equipoGanador = estado.juego.mano.equipos.find((equipo) => equipo !== retirado.equipo)!;
    const cierre = finalizarManoPorMazo(estado.juego, equipoGanador, accion.jugador);
    if (!cierre.aceptada)
      return rechazo(cierre.rechazo.codigo, "No se pudo finalizar la mano por mazo.");
    return {
      aceptada: true as const,
      estado: {
        ...estado,
        juego: cierre.estado,
        envido,
        flor,
        liquidacionMazo: {
          equipoGanador,
          causa: "mazo",
          puntos: "pendiente",
          oportunidadFlor: (() => {
            const jugador = obtenerElegibleFlorExcepcional({ ...estado, juego: cierre.estado });
            return jugador ? { jugador, estado: "pendiente" as const, duracionMs: 10000 as const } : null;
          })(),
        },
        ciclo: { fase: "victoria-competitiva-determinada", equipoGanador, causa: "mazo" },
      },
      eventos: [...liquidacionFlor.eventos, ...liquidacionEnvido.eventos, ...cierre.eventos],
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
    const respaldoFlor = cierre.estado.anuncios.find((anuncio) => anuncio.jugador === accion.jugador);
    const cancelacionEnvido = cancelarEnvidoPorFlor(estado.envido, contexto, respaldoFlor!);
    if (!cancelacionEnvido.aceptada)
      return rechazo(cancelacionEnvido.codigo, "No se pudo cancelar el Envido por Flor.");
    const envido = cancelacionEnvido.estado;
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
        ...cancelacionEnvido.eventos,
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
    const propuestaRechazada = resultado.estado.historialPropuestas.at(-1);
    const adjudicacionTruco = esRechazo
      ? propuestaRechazada?.respuesta === "no-quiero"
        ? {
            causa: "rechazo-voluntario" as const,
            equipo: propuestaRechazada.equipoProponente,
            puntos: (propuestaRechazada.nivel === "truco"
              ? 1
              : propuestaRechazada.nivel === "retruco"
                ? 2
                : 3) as 1 | 2 | 3,
            nivelPropuesto: propuestaRechazada.nivel,
            propuestaOrden: propuestaRechazada.orden,
            respondedor: propuestaRechazada.respondedor,
          }
        : null
      : estado.adjudicacionTruco;
    if (esRechazo && adjudicacionTruco === null)
      return rechazo("resultado-invalido", "El rechazo de Truco no tiene respaldo histórico.");
    const integrado = {
      ...estado,
      juego: juegoIntegrado,
      truco: resultado.estado,
      adjudicacionTruco,
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
    const adjudicacionCanonica = adjudicacionTruco
      ? {
          causa: "mano-por-bazas" as const,
          equipo: adjudicacionTruco.equipo,
          puntos: adjudicacionTruco.puntos,
          nivelAceptado: adjudicacionTruco.nivel,
        }
      : estado.adjudicacionTruco;
    return {
      aceptada: true as const,
      estado: {
        ...integrado.estado,
        juego: resultado.estado,
        adjudicacionTruco: adjudicacionCanonica,
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
    const respaldoFlor = cierre.estado.anuncios.find((anuncio) => anuncio.jugador === accion.jugador);
    const cancelacionEnvido = cancelarEnvidoPorFlor(estado.envido, contexto, respaldoFlor!);
    if (!cancelacionEnvido.aceptada)
      return rechazo(cancelacionEnvido.codigo, "No se pudo cancelar el Envido por Flor.");
    const envidoCancelado = cancelacionEnvido.estado;
    const integrado = integrarResultadoFlor(estado, cierre.estado);
    return {
      aceptada: true as const,
      estado: { ...integrado.estado, envido: envidoCancelado },
      eventos: [
        ...resultado.eventos,
        ...cierre.eventos,
        ...integrado.eventos,
        ...cancelacionEnvido.eventos,
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
  if (accion.tipo === "cerrar-mano-mazo")
    return rechazo("cierre-mano-mazo-no-disponible", "El cierre definitivo por mazo no está disponible.");
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
