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

export type EstadoManoCoordinada = Readonly<{
  juego: EstadoJuegoCartas;
  envido: EstadoEnvidoDominio;
  flor: EstadoFlorDominio;
  resultadoPartida: Readonly<{ motivo: "contra-flor-al-resto"; equipoGanador: string }> | null;
  contextoInicio: ContextoInicioMano;
}>;
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
  | Readonly<{ tipo: "quiero-envido" | "no-quiero-envido"; jugador: string }>;
export type EventoCoordinado =
  | EventoJuegoCartas
  | import("./envido.js").EventoEnvido
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
    resultadoPartida: null,
    contextoInicio,
  };
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
function integrarResultadoFlor(estado: EstadoManoCoordinada, flor: EstadoFlorDominio) {
  const resultadoPartida = flor.resultadoTerminal
    ? {
        motivo: "contra-flor-al-resto" as const,
        equipoGanador: flor.resultadoTerminal.equipo,
      }
    : null;
  return {
    estado: { ...estado, flor, resultadoPartida },
    eventos: resultadoPartida
      ? [{ tipo: "partida-terminada-contra-flor-al-resto" as const, ...resultadoPartida }]
      : [],
  };
}
export function ejecutarAccionCoordinada(estado: EstadoManoCoordinada, accion: AccionCoordinada) {
  if (!estado || !esEstadoJuegoCartasValido(estado.juego))
    return rechazo("estado-invalido", "Estado de cartas inválido.");
  if (!validarContextoInicioMano(estado.juego, estado.contextoInicio))
    return rechazo("contexto-inicial-invalido", "Contexto inicial inválido.");
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
  if (accion?.tipo === "jugar-carta") {
    if (estado.envido.pendiente)
      return rechazo("envido-pendiente", "El Envido debe resolverse antes de jugar carta.");
    if (estado.flor.pendiente)
      return rechazo("flor-pendiente", "La Flor debe resolverse antes de jugar carta.");
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
    return {
      aceptada: true as const,
      estado: { ...integrado.estado, juego: resultado.estado },
      eventos: [
        ...flor.eventos,
        ...oportunidad.eventos,
        ...cierre.eventos,
        ...integrado.eventos,
        ...resultado.eventos,
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
