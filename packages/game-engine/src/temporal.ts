import { obtenerJerarquia, PALOS, type Carta } from "./cartas.js";
import {
  ejecutarAccionCoordinada,
  type AccionCoordinada,
  type EstadoManoCoordinada,
  type EventoCoordinado,
  type RechazoCoordinado,
} from "./coordinador.js";
import { tieneFlorCalculada } from "./flor.js";
import { estaActivo } from "./juego-cartas.js";

/**
 * Reloj lógico de una mano. No almacena una hora: el servidor agenda los
 * vencimientos y vuelve a ingresar el evento correspondiente en el motor.
 */
export type PausaDesconexion = Readonly<{
  jugador: string;
  id: number;
  duracionMs: 30000;
}>;
export type EstadoTemporalMano = Readonly<{
  mano: EstadoManoCoordinada;
  /** Invalida un vencimiento de acción cuando ya hubo una transición de juego. */
  versionAccion: number;
  /** Secuencia exclusiva de pausas; una pausa ajena no reinicia esta ventana. */
  siguientePausa: number;
  pausasDesconexion: readonly PausaDesconexion[];
}>;

export type TemporizadorAccionPendiente = Readonly<{
  clase:
    | "turno-carta"
    | "respuesta-flor"
    | "respuesta-envido"
    | "respuesta-truco"
    | "flor-posterior-mazo";
  jugadores: readonly string[];
  duracionMs: 10000;
  version: number;
}>;

export type AccionTemporal =
  | Readonly<{ tipo: "accion"; accion: AccionCoordinada }>
  | Readonly<{ tipo: "vencer-accion"; jugador: string; version: number }>
  | Readonly<{ tipo: "desconectar"; jugador: string }>
  | Readonly<{ tipo: "reconectar"; jugador: string }>
  | Readonly<{ tipo: "vencer-desconexion"; jugador: string; pausaId: number }>;

export type EventoTemporal =
  | EventoCoordinado
  | Readonly<{
      tipo: "accion-automatica-vencida";
      clase: TemporizadorAccionPendiente["clase"];
      jugador: string;
    }>
  | Readonly<{ tipo: "jugador-desconectado"; jugador: string; pausaId: number }>
  | Readonly<{ tipo: "jugador-reconectado"; jugador: string; pausaId: number }>
  | Readonly<{ tipo: "desconexion-vencida"; jugador: string; pausaId: number }>
  | Readonly<{ tipo: "desconexion-vencida-tras-cierre"; jugador: string; pausaId: number }>;
export type RechazoTemporal = RechazoCoordinado;
export type ResultadoTemporal =
  | Readonly<{ aceptada: true; estado: EstadoTemporalMano; eventos: readonly EventoTemporal[] }>
  | Readonly<{ aceptada: false; rechazo: RechazoTemporal }>;

const rechazo = (codigo: string, mensaje: string): ResultadoTemporal => ({
  aceptada: false,
  rechazo: { codigo, mensaje },
});

export function crearEstadoTemporalMano(mano: EstadoManoCoordinada): EstadoTemporalMano {
  return { mano, versionAccion: 1, siguientePausa: 1, pausasDesconexion: [] };
}

export function esEstadoTemporalManoValido(estado: EstadoTemporalMano): boolean {
  if (
    !estado ||
    !estado.mano ||
    !Number.isInteger(estado.versionAccion) ||
    estado.versionAccion < 1 ||
    !Number.isInteger(estado.siguientePausa) ||
    estado.siguientePausa < 1 ||
    !Array.isArray(estado.pausasDesconexion)
  )
    return false;
  const ids = new Set<number>();
  const jugadores = new Set<string>();
  return estado.pausasDesconexion.every((pausa) => {
    const valida =
      !!pausa &&
      typeof pausa.jugador === "string" &&
      Number.isInteger(pausa.id) &&
      pausa.id >= 1 &&
      pausa.id < estado.siguientePausa &&
      pausa.duracionMs === 30000 &&
      !ids.has(pausa.id) &&
      !jugadores.has(pausa.jugador) &&
      estaActivo(estado.mano.juego, pausa.jugador);
    ids.add(pausa?.id);
    jugadores.add(pausa?.jugador);
    return valida;
  });
}

function jugadoresActivosDelEquipo(estado: EstadoManoCoordinada, equipo: string): string[] {
  return estado.juego.mano.mesa.jugadores
    .filter((jugador) => jugador.equipo === equipo && estaActivo(estado.juego, jugador.id))
    .sort((a, b) => a.posicion - b.posicion)
    .map((jugador) => jugador.id);
}

function oportunidadFlorPendiente(estado: EstadoManoCoordinada): string | null {
  const liquidacion = estado.liquidacionMazo;
  if (!liquidacion) return null;
  if (estado.juego.mano.mesa.modalidad === "2v2")
    return (
      liquidacion.oportunidadesFlor?.find((oportunidad) => oportunidad.estado === "pendiente")
        ?.jugador ?? null
    );
  return liquidacion.oportunidadFlor?.estado === "pendiente"
    ? liquidacion.oportunidadFlor.jugador
    : null;
}

/** La fuente de verdad es el estado de la mano: aquí sólo se deriva qué vence. */
export function obtenerTemporizadorAccionPendiente(
  estado: EstadoTemporalMano,
): TemporizadorAccionPendiente | null {
  if (!esEstadoTemporalManoValido(estado) || estado.pausasDesconexion.length > 0) return null;
  const oportunidad = oportunidadFlorPendiente(estado.mano);
  if (oportunidad)
    return {
      clase: "flor-posterior-mazo",
      jugadores: [oportunidad],
      duracionMs: 10000,
      version: estado.versionAccion,
    };
  const flor = estado.mano.flor.pendiente;
  if (flor)
    return {
      clase: "respuesta-flor",
      jugadores: jugadoresActivosDelEquipo(estado.mano, flor.equipoRespondedor),
      duracionMs: 10000,
      version: estado.versionAccion,
    };
  const envido = estado.mano.envido.pendiente;
  if (envido)
    return {
      clase: "respuesta-envido",
      jugadores: jugadoresActivosDelEquipo(estado.mano, envido.equipoRespondedor),
      duracionMs: 10000,
      version: estado.versionAccion,
    };
  const truco = estado.mano.truco.propuestaPendiente;
  if (truco) {
    const proponente = estado.mano.juego.mano.mesa.jugadores.find(
      (jugador) => jugador.id === truco.proponente,
    );
    const respondedor = proponente
      ? estado.mano.juego.mano.equipos.find((equipo) => equipo !== proponente.equipo)
      : null;
    if (!respondedor) return null;
    return {
      clase: "respuesta-truco",
      jugadores: jugadoresActivosDelEquipo(estado.mano, respondedor),
      duracionMs: 10000,
      version: estado.versionAccion,
    };
  }
  const turno = estado.mano.juego.jugadorTurno;
  if (!turno || estado.mano.juego.finalizada || !estaActivo(estado.mano.juego, turno)) return null;
  return {
    clase: "turno-carta",
    jugadores: [turno],
    duracionMs: 10000,
    version: estado.versionAccion,
  };
}

export function obtenerPausasDesconexionPendientes(
  estado: EstadoTemporalMano,
): readonly PausaDesconexion[] {
  return esEstadoTemporalManoValido(estado) ? estado.pausasDesconexion : [];
}

/** Selección reglamentaria: mayor jerarquía numérica es menor fuerza real. */
export function seleccionarCartaMasDebil(cartas: readonly Carta[], muestra: Carta): Carta {
  if (!Array.isArray(cartas) || cartas.length === 0)
    throw new TypeError("No hay cartas disponibles.");
  return [...cartas].sort((a, b) => {
    const fuerza = obtenerJerarquia(b, muestra) - obtenerJerarquia(a, muestra);
    if (fuerza !== 0) return fuerza;
    return PALOS.indexOf(a.palo) - PALOS.indexOf(b.palo);
  })[0]!;
}

function debeAnunciarFlorAntesDeCarta(estado: EstadoManoCoordinada, jugador: string): boolean {
  const mano = estado.juego.mano.manos.find((item) => item.jugador === jugador);
  const disponibles = estado.juego.cartasDisponibles.find((item) => item.jugador === jugador);
  if (!mano || !disponibles || disponibles.cartas.length !== 3) return false;
  const tieneFlor = tieneFlorCalculada(mano.cartas, estado.juego.mano.muestra);
  return (
    tieneFlor &&
    !estado.flor.anuncios.some((anuncio) => anuncio.jugador === jugador) &&
    !estado.flor.derechosPerdidos.includes(jugador)
  );
}

function aplicarCoordinada(
  estado: EstadoTemporalMano,
  accion: AccionCoordinada,
  eventosExtra: readonly EventoTemporal[] = [],
): ResultadoTemporal {
  const resultado = ejecutarAccionCoordinada(estado.mano, accion);
  if (!resultado.aceptada) return rechazo(resultado.rechazo.codigo, resultado.rechazo.mensaje);
  return {
    aceptada: true,
    estado: {
      ...estado,
      mano: resultado.estado as EstadoManoCoordinada,
      versionAccion: estado.versionAccion + 1,
    },
    eventos: [...eventosExtra, ...resultado.eventos],
  };
}

function vencerAccion(
  estado: EstadoTemporalMano,
  pendiente: TemporizadorAccionPendiente,
  jugador: string,
): ResultadoTemporal {
  if (!pendiente.jugadores.includes(jugador))
    return rechazo(
      "jugador-temporizador-invalido",
      "El jugador no puede resolver este temporizador.",
    );
  if (pendiente.clase === "flor-posterior-mazo")
    return aplicarCoordinada(estado, { tipo: "vencer-oportunidad-flor", jugador }, [
      { tipo: "accion-automatica-vencida", clase: pendiente.clase, jugador },
    ]);
  if (pendiente.clase === "respuesta-flor") {
    const tipo =
      estado.mano.flor.pendiente?.tipo === "contra-flor-al-resto"
        ? "no-quiero-contra-flor-al-resto"
        : "no-quiero-contra-flor";
    return aplicarCoordinada(estado, { tipo, jugador }, [
      { tipo: "accion-automatica-vencida", clase: pendiente.clase, jugador },
    ]);
  }
  if (pendiente.clase === "respuesta-envido")
    return aplicarCoordinada(estado, { tipo: "no-quiero-envido", jugador }, [
      { tipo: "accion-automatica-vencida", clase: pendiente.clase, jugador },
    ]);
  if (pendiente.clase === "respuesta-truco") {
    const nivel = estado.mano.truco.propuestaPendiente?.nivel;
    const tipo =
      nivel === "truco"
        ? "no-quiero-truco"
        : nivel === "retruco"
          ? "no-quiero-retruco"
          : "no-quiero-vale-cuatro";
    return aplicarCoordinada(estado, { tipo, jugador }, [
      { tipo: "accion-automatica-vencida", clase: pendiente.clase, jugador },
    ]);
  }
  const turno = estado.mano.juego.jugadorTurno;
  if (turno !== jugador) return rechazo("temporizador-obsoleto", "El turno ya cambió.");
  let actual: EstadoTemporalMano = estado;
  const eventos: EventoTemporal[] = [
    { tipo: "accion-automatica-vencida", clase: pendiente.clase, jugador },
  ];
  if (debeAnunciarFlorAntesDeCarta(actual.mano, jugador)) {
    const flor = ejecutarAccionCoordinada(actual.mano, { tipo: "anunciar-flor", jugador });
    if (!flor.aceptada) return rechazo(flor.rechazo.codigo, flor.rechazo.mensaje);
    actual = {
      ...actual,
      mano: flor.estado as EstadoManoCoordinada,
      versionAccion: actual.versionAccion + 1,
    };
    eventos.push(...flor.eventos);
  }
  const cartas = actual.mano.juego.cartasDisponibles.find(
    (item) => item.jugador === jugador,
  )?.cartas;
  if (!cartas?.length)
    return rechazo("sin-cartas-disponibles", "El jugador no tiene cartas para el vencimiento.");
  const carta = seleccionarCartaMasDebil(cartas, actual.mano.juego.mano.muestra);
  const jugada = ejecutarAccionCoordinada(actual.mano, { tipo: "jugar-carta", jugador, carta });
  if (!jugada.aceptada) return rechazo(jugada.rechazo.codigo, jugada.rechazo.mensaje);
  return {
    aceptada: true,
    estado: {
      ...actual,
      mano: jugada.estado as EstadoManoCoordinada,
      versionAccion: actual.versionAccion + 1,
    },
    eventos: [...eventos, ...jugada.eventos],
  };
}

export function ejecutarAccionTemporal(
  estado: EstadoTemporalMano,
  accion: AccionTemporal,
): ResultadoTemporal {
  if (!esEstadoTemporalManoValido(estado))
    return rechazo("estado-temporal-invalido", "Estado temporal inválido.");
  if (!accion || typeof accion !== "object" || typeof accion.tipo !== "string")
    return rechazo("accion-temporal-invalida", "Acción temporal inválida.");
  if (accion.tipo === "desconectar") {
    if (!estaActivo(estado.mano.juego, accion.jugador))
      return rechazo("jugador-no-activo", "Solo un jugador activo puede desconectarse.");
    if (estado.pausasDesconexion.some((pausa) => pausa.jugador === accion.jugador))
      return rechazo("jugador-ya-desconectado", "El jugador ya posee una pausa de desconexión.");
    const pausa: PausaDesconexion = {
      jugador: accion.jugador,
      id: estado.siguientePausa,
      duracionMs: 30000,
    };
    return {
      aceptada: true,
      estado: {
        ...estado,
        versionAccion: estado.versionAccion + 1,
        siguientePausa: estado.siguientePausa + 1,
        pausasDesconexion: [...estado.pausasDesconexion, pausa],
      },
      eventos: [{ tipo: "jugador-desconectado", jugador: pausa.jugador, pausaId: pausa.id }],
    };
  }
  if (accion.tipo === "reconectar") {
    const pausa = estado.pausasDesconexion.find((item) => item.jugador === accion.jugador);
    if (!pausa)
      return rechazo("jugador-no-desconectado", "El jugador no tiene una pausa de desconexión.");
    return {
      aceptada: true,
      estado: {
        ...estado,
        versionAccion: estado.versionAccion + 1,
        pausasDesconexion: estado.pausasDesconexion.filter((item) => item.id !== pausa.id),
      },
      eventos: [{ tipo: "jugador-reconectado", jugador: pausa.jugador, pausaId: pausa.id }],
    };
  }
  if (accion.tipo === "vencer-desconexion") {
    const pausa = estado.pausasDesconexion.find(
      (item) => item.jugador === accion.jugador && item.id === accion.pausaId,
    );
    if (!pausa)
      return rechazo(
        "vencimiento-desconexion-obsoleto",
        "La pausa de desconexión ya no está vigente.",
      );
    const sinPausa: EstadoTemporalMano = {
      ...estado,
      pausasDesconexion: estado.pausasDesconexion.filter((item) => item.id !== pausa.id),
    };
    if (sinPausa.mano.juego.finalizada && sinPausa.mano.juego.motivoFinalizacion === "mazo")
      return {
        aceptada: true,
        estado: { ...sinPausa, versionAccion: estado.versionAccion + 1 },
        eventos: [
          {
            tipo: "desconexion-vencida-tras-cierre",
            jugador: pausa.jugador,
            pausaId: pausa.id,
          },
        ],
      };
    const retiro = ejecutarAccionCoordinada(sinPausa.mano, {
      tipo: "irse-al-mazo",
      jugador: pausa.jugador,
    });
    if (!retiro.aceptada) return rechazo(retiro.rechazo.codigo, retiro.rechazo.mensaje);
    return {
      aceptada: true,
      estado: {
        ...sinPausa,
        mano: retiro.estado as EstadoManoCoordinada,
        versionAccion: estado.versionAccion + 1,
      },
      eventos: [
        { tipo: "desconexion-vencida", jugador: pausa.jugador, pausaId: pausa.id },
        ...retiro.eventos,
      ],
    };
  }
  if (estado.pausasDesconexion.length > 0)
    return rechazo("partida-pausada", "La partida está pausada por una desconexión.");
  if (accion.tipo === "accion") return aplicarCoordinada(estado, accion.accion);
  if (accion.tipo !== "vencer-accion")
    return rechazo("accion-temporal-invalida", "Acción temporal inválida.");
  const pendiente = obtenerTemporizadorAccionPendiente(estado);
  if (!pendiente || pendiente.version !== accion.version)
    return rechazo("temporizador-obsoleto", "El vencimiento no corresponde al estado actual.");
  return vencerAccion(estado, pendiente, accion.jugador);
}
