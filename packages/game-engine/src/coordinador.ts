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

export type EstadoManoCoordinada = Readonly<{
  juego: EstadoJuegoCartas;
  envido: EstadoEnvidoDominio;
  contextoInicio: ContextoInicioMano;
}>;
export type ContextoInicioMano = Readonly<{
  metaPuntos: MetaPuntos;
  puntajesIniciales: Readonly<Record<string, number>>;
  esDesempate: boolean;
}>;
export type AccionCoordinada =
  | AccionJuegoCartas
  | Readonly<{ tipo: "iniciar-envido" | "aumentar-envido"; jugador: string; canto: CantoEnvido }>
  | Readonly<{ tipo: "quiero-envido" | "no-quiero-envido"; jugador: string }>;
export type EventoCoordinado = EventoJuegoCartas | import("./envido.js").EventoEnvido;
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
  return { juego, envido: crearEstadoEnvido(), contextoInicio };
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
function rechazo(codigo: string, mensaje: string) {
  return { aceptada: false as const, rechazo: { codigo, mensaje } };
}
export function ejecutarAccionCoordinada(estado: EstadoManoCoordinada, accion: AccionCoordinada) {
  if (!estado || !esEstadoJuegoCartasValido(estado.juego))
    return rechazo("estado-invalido", "Estado de cartas inválido.");
  if (!validarContextoInicioMano(estado.juego, estado.contextoInicio))
    return rechazo("contexto-inicial-invalido", "Contexto inicial inválido.");
  const contexto = obtenerContextoEnvido(estado.juego, estado.contextoInicio);
  if (!esEstadoEnvidoValido(estado.envido, contexto))
    return rechazo("estado-invalido", "Estado de Envido inválido.");
  if (accion?.tipo === "jugar-carta") {
    if (estado.envido.pendiente)
      return rechazo("envido-pendiente", "El Envido debe resolverse antes de jugar carta.");
    const resultado = ejecutarCarta(estado.juego, accion, undefined);
    return resultado.aceptada
      ? {
          aceptada: true as const,
          estado: { ...estado, juego: resultado.estado },
          eventos: resultado.eventos,
        }
      : resultado;
  }
  if (
    !accion ||
    !["iniciar-envido", "aumentar-envido", "quiero-envido", "no-quiero-envido"].includes(
      accion.tipo,
    )
  )
    return rechazo("accion-invalida", "Acción coordinada inválida.");
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
