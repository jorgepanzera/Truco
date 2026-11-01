import type { MetaPuntos } from "@truco/shared";
import {
  crearEstadoManoCoordinada,
  ejecutarAccionCoordinada,
  type AccionCoordinada,
  type EventoCoordinado,
  type EstadoManoCoordinada,
} from "./coordinador.js";
import { iniciarJuegoCartas } from "./juego-cartas.js";
import { prepararMano, siguienteRepartidor, validarMesa, type Mesa } from "./mano.js";
import type { Carta } from "@truco/shared";

export type RegistroManoContabilizada = Readonly<{
  ordinal: number;
  idMano: string;
  puntos: Readonly<Record<string, number>>;
  puntajesAntes: Readonly<Record<string, number>>;
  mano: EstadoManoCoordinada;
}>;

export type EstadoPartida = Readonly<{
  mesa: Mesa;
  metaPuntos: MetaPuntos;
  puntajesIniciales: Readonly<Record<string, number>>;
  puntajes: Readonly<Record<string, number>>;
  mano: EstadoManoCoordinada;
  ordinalMano: number;
  manosContabilizadas: readonly RegistroManoContabilizada[];
  fase: "mano-activa" | "mano-contabilizada" | "partida-finalizada";
  equipoGanador: string | null;
  desempatePendiente: boolean;
}>;

type ResultadoPartida =
  | Readonly<{ aceptada: true; estado: EstadoPartida }>
  | Readonly<{ aceptada: false; rechazo: Readonly<{ codigo: string; mensaje: string }> }>;
export type ResultadoAccionPartida =
  | Readonly<{ aceptada: true; estado: EstadoPartida; eventos: readonly EventoCoordinado[] }>
  | Readonly<{ aceptada: false; rechazo: Readonly<{ codigo: string; mensaje: string }> }>;

function rechazo(codigo: string, mensaje: string): ResultadoPartida {
  return { aceptada: false, rechazo: { codigo, mensaje } };
}
function rechazoAccion(codigo: string, mensaje: string): ResultadoAccionPartida {
  return { aceptada: false, rechazo: { codigo, mensaje } };
}

/** Identidad reproducible de una mano, derivada exclusivamente de su reparto canónico. */
export function obtenerIdManoCanonico(mano: EstadoManoCoordinada): string {
  const reparto = mano.juego.mano;
  return JSON.stringify({
    repartidor: reparto.repartidor,
    jugadores: reparto.mesa.jugadores.map(({ id, equipo, posicion }) => ({ id, equipo, posicion })),
    entregas: reparto.entregas,
    muestra: reparto.muestra,
  });
}

/** Identidad de instancia: ordinal verificable + identidad del reparto. */
export function obtenerIdInstanciaMano(ordinal: number, mano: EstadoManoCoordinada): string {
  return JSON.stringify({ ordinal, reparto: obtenerIdManoCanonico(mano) });
}

function manoEsValida(mano: EstadoManoCoordinada): boolean {
  const jugador = mano?.juego?.mano?.mesa?.jugadores?.[0]?.id;
  if (!jugador) return false;
  const verificacion = ejecutarAccionCoordinada(mano, { tipo: "proponer-truco", jugador });
  return verificacion.aceptada || verificacion.rechazo.codigo !== "estado-invalido";
}

function puntosDeMano(mano: EstadoManoCoordinada): Record<string, number> {
  const puntos = Object.fromEntries(mano.juego.mano.equipos.map((equipo) => [equipo, 0])) as Record<string, number>;
  for (const adjudicacion of mano.flor.adjudicaciones) puntos[adjudicacion.equipo] += adjudicacion.puntos;
  for (const adjudicacion of mano.envido.resueltos) puntos[adjudicacion.equipo] += adjudicacion.puntos;
  if (mano.adjudicacionTruco) puntos[mano.adjudicacionTruco.equipo] += mano.adjudicacionTruco.puntos;
  return puntos;
}

function marcadorEsperado(estado: EstadoPartida): Record<string, number> {
  const resultado = { ...estado.puntajesIniciales } as Record<string, number>;
  for (const registro of estado.manosContabilizadas)
    for (const equipo of estado.mano.juego.mano.equipos) resultado[equipo] += registro.puntos[equipo];
  return resultado;
}

function puntajesIguales(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>, equipos: readonly string[]): boolean {
  return equipos.every((equipo) => a[equipo] === b[equipo]);
}

function esMesaIgual(a: Mesa, b: Mesa): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function esEstadoPartidaValido(estado: EstadoPartida): boolean {
  try {
    validarMesa(estado.mesa);
  } catch {
    return false;
  }
  const equipos = estado.mano?.juego?.mano?.equipos;
  if (
    !estado ||
    estado.mesa.modalidad !== "1v1" ||
    (estado.metaPuntos !== 30 && estado.metaPuntos !== 40) ||
    !manoEsValida(estado.mano) ||
    !esMesaIgual(estado.mesa, estado.mano.juego.mano.mesa) ||
    estado.mano.contextoInicio.metaPuntos !== estado.metaPuntos ||
    !Array.isArray(equipos) ||
    equipos.length !== 2 ||
    !Array.isArray(estado.manosContabilizadas) ||
    !Number.isInteger(estado.ordinalMano) || estado.ordinalMano < 1 ||
    !["mano-activa", "mano-contabilizada", "partida-finalizada"].includes(estado.fase) ||
    typeof estado.desempatePendiente !== "boolean"
  ) return false;
  if (equipos.some((equipo) => !Number.isInteger(estado.puntajesIniciales?.[equipo]) || estado.puntajesIniciales[equipo] < 0)) return false;
  if (estado.manosContabilizadas.some((registro) =>
    !registro || !Number.isInteger(registro.ordinal) || registro.ordinal < 1 || typeof registro.idMano !== "string" || equipos.some((equipo) =>
      !Number.isInteger(registro.puntos?.[equipo]) || registro.puntos[equipo] < 0 ||
      !Number.isInteger(registro.puntajesAntes?.[equipo]) || registro.puntajesAntes[equipo] < 0,
    ),
  )) return false;
  if (new Set(estado.manosContabilizadas.map((registro) => registro.idMano)).size !== estado.manosContabilizadas.length) return false;
  let marcador = { ...estado.puntajesIniciales } as Record<string, number>;
  for (const [indice, registro] of estado.manosContabilizadas.entries()) {
    const anterior = estado.manosContabilizadas[indice - 1];
    if (
      !manoEsValida(registro.mano) ||
      registro.mano.ciclo.fase !== "cierre-definitivo" ||
      registro.ordinal !== indice + 1 ||
      registro.idMano !== obtenerIdInstanciaMano(registro.ordinal, registro.mano) ||
      !puntajesIguales(registro.puntajesAntes, marcador, equipos) ||
      !puntajesIguales(registro.mano.contextoInicio.puntajesIniciales, marcador, equipos) ||
      registro.mano.contextoInicio.metaPuntos !== estado.metaPuntos ||
      !puntajesIguales(registro.puntos, puntosDeMano(registro.mano), equipos) ||
      (anterior !== undefined && registro.mano.juego.mano.repartidor !== siguienteRepartidor(estado.mesa, anterior.mano.juego.mano.repartidor))
    ) return false;
    for (const equipo of equipos) marcador[equipo] += registro.puntos[equipo];
  }
  if (JSON.stringify(marcadorEsperado(estado)) !== JSON.stringify(estado.puntajes)) return false;
  const alMeta = equipos.filter((equipo) => estado.puntajes[equipo] >= estado.metaPuntos);
  const empate = alMeta.length === 2 && estado.puntajes[equipos[0]] === estado.puntajes[equipos[1]];
  const manoActualContabilizada =
    estado.manosContabilizadas.at(-1)?.idMano === obtenerIdInstanciaMano(estado.ordinalMano, estado.mano);
  const directo = manoActualContabilizada ? estado.mano.resultadoPartida?.equipoGanador ?? null : null;
  const ganadorEsperado = directo ?? (!empate && alMeta.length > 0
    ? equipos.reduce((mejor, equipo) => estado.puntajes[equipo] > estado.puntajes[mejor] ? equipo : mejor, equipos[0])
    : null);
  return (
    estado.equipoGanador === ganadorEsperado &&
    estado.desempatePendiente === (ganadorEsperado === null && empate) &&
    (estado.fase === "mano-activa"
      ? estado.ordinalMano === estado.manosContabilizadas.length + 1 &&
        estado.equipoGanador === null &&
        (estado.manosContabilizadas.length === 0 || estado.mano.juego.mano.repartidor === siguienteRepartidor(estado.mesa, estado.manosContabilizadas.at(-1).mano.juego.mano.repartidor)) &&
        puntajesIguales(estado.mano.contextoInicio.puntajesIniciales, estado.puntajes, equipos) &&
        estado.mano.contextoInicio.esDesempate === estado.desempatePendiente
      : estado.ordinalMano === estado.manosContabilizadas.length &&
        estado.manosContabilizadas.at(-1)?.idMano === obtenerIdInstanciaMano(estado.ordinalMano, estado.mano)) &&
    (estado.fase === "partida-finalizada") === (estado.equipoGanador !== null)
  );
}

export function crearEstadoPartida(mano: EstadoManoCoordinada): EstadoPartida {
  if (!manoEsValida(mano) || mano.juego.mano.mesa.modalidad !== "1v1")
    throw new TypeError("La mano inicial de partida 1v1 es inválida.");
  const equipos = mano.juego.mano.equipos;
  const puntajesIniciales = { ...mano.contextoInicio.puntajesIniciales };
  return {
    mesa: mano.juego.mano.mesa,
    metaPuntos: mano.contextoInicio.metaPuntos,
    puntajesIniciales,
    puntajes: { ...puntajesIniciales },
    mano,
    ordinalMano: 1,
    manosContabilizadas: [],
    fase: "mano-activa",
    equipoGanador: null,
    desempatePendiente: mano.contextoInicio.esDesempate,
  };
}

export function contabilizarManoCerrada(estado: EstadoPartida): ResultadoPartida {
  if (!esEstadoPartidaValido(estado)) return rechazo("estado-partida-invalido", "Estado de partida inválido.");
  if (estado.fase === "partida-finalizada") return rechazo("partida-finalizada", "La partida ya finalizó.");
  if (estado.mano.ciclo.fase !== "cierre-definitivo")
    return rechazo("mano-no-cerrada", "La mano debe estar definitivamente cerrada.");
  const idMano = obtenerIdInstanciaMano(estado.ordinalMano, estado.mano);
  if (estado.manosContabilizadas.some((registro) => registro.idMano === idMano))
    return rechazo("mano-ya-contabilizada", "La mano ya fue contabilizada.");
  const puntos = puntosDeMano(estado.mano);
  const puntajes = Object.fromEntries(
    estado.mano.juego.mano.equipos.map((equipo) => [equipo, estado.puntajes[equipo] + puntos[equipo]]),
  ) as Record<string, number>;
  const equipos = estado.mano.juego.mano.equipos;
  const alMeta = equipos.filter((equipo) => puntajes[equipo] >= estado.metaPuntos);
  const empate = alMeta.length === 2 && puntajes[equipos[0]] === puntajes[equipos[1]];
  const directo = estado.mano.resultadoPartida?.equipoGanador ?? null;
  const equipoGanador = directo ?? (!empate && alMeta.length > 0
    ? equipos.reduce((mejor, equipo) => puntajes[equipo] > puntajes[mejor] ? equipo : mejor, equipos[0])
    : null);
  return {
    aceptada: true,
    estado: {
      ...estado,
      puntajes,
      manosContabilizadas: [...estado.manosContabilizadas, { ordinal: estado.ordinalMano, idMano, puntos, puntajesAntes: { ...estado.puntajes }, mano: estado.mano }],
      fase: equipoGanador ? "partida-finalizada" : "mano-contabilizada",
      equipoGanador,
      desempatePendiente: equipoGanador === null && empate,
    },
  };
}

export function ejecutarAccionPartida(estado: EstadoPartida, accion: AccionCoordinada): ResultadoAccionPartida {
  if (!esEstadoPartidaValido(estado)) return rechazoAccion("estado-partida-invalido", "Estado de partida inválido.");
  if (estado.fase === "partida-finalizada") return rechazoAccion("partida-finalizada", "La partida ya finalizó.");
  if (estado.fase !== "mano-activa") return rechazoAccion("mano-no-activa", "La mano actual debe avanzar antes de iniciar otra acción.");
  const resultado = ejecutarAccionCoordinada(estado.mano, accion);
  return resultado.aceptada
    ? { aceptada: true, estado: { ...estado, mano: resultado.estado } as EstadoPartida, eventos: resultado.eventos }
    : resultado;
}

export function siguienteMano(estado: EstadoPartida, mazo: readonly Carta[]): ResultadoPartida {
  if (!esEstadoPartidaValido(estado)) return rechazo("estado-partida-invalido", "Estado de partida inválido.");
  if (estado.fase === "partida-finalizada") return rechazo("partida-finalizada", "La partida ya finalizó.");
  if (estado.fase !== "mano-contabilizada" || estado.mano.ciclo.fase !== "cierre-definitivo")
    return rechazo("mano-no-contabilizada", "La mano actual debe estar cerrada y contabilizada.");
  try {
    const repartidor = siguienteRepartidor(estado.mesa, estado.mano.juego.mano.repartidor);
    const preparada = prepararMano(estado.mesa, repartidor, mazo);
    const mano = crearEstadoManoCoordinada(iniciarJuegoCartas(preparada), {
      metaPuntos: estado.metaPuntos,
      puntajesIniciales: stateCopy(estado.puntajes),
      esDesempate: estado.desempatePendiente,
    });
    return { aceptada: true, estado: { ...estado, mano, ordinalMano: estado.ordinalMano + 1, fase: "mano-activa" } };
  } catch {
    return rechazo("mazo-invalido", "El mazo para la siguiente mano es inválido.");
  }
}

function stateCopy(puntajes: Readonly<Record<string, number>>): Record<string, number> {
  return { ...puntajes };
}
