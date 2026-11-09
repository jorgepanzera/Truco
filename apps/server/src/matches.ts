import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  barajarMazo,
  crearEstadoManoCoordinada,
  crearEstadoPartida,
  crearMazo,
  ejecutarAccionPartida,
  iniciarJuegoCartas,
  prepararMano,
  seleccionarPrimerRepartidor,
  contabilizarManoCerrada,
  siguienteMano,
  ejecutarDecisionAutomatica,
  obtenerAccionesLegalesJugador,
  politicaEstrategicaGlobal,
  calcularTantoFlor,
  type PoliticaEstrategica,
  type EstadoPartida,
  type Mesa,
  type AccionAutomatica,
} from "@truco/game-engine";
import type { Carta, MetaPuntos } from "@truco/shared";
import { aAccionCoordinada, type AccionRed } from "./game-actions.js";

export type SesionInvitado = Readonly<{ id: string; apodo: string }>;
type SesionInterna = SesionInvitado & Readonly<{ token: string }>;
type Asiento = Readonly<{ jugadorId: string; apodo: string; automatico?: boolean }>;
type EstadoMatch = "esperando" | "iniciada";

type PartidaInterna = {
  id: string;
  modalidad: "1v1";
  contraMaquina: boolean;
  metaPuntos: MetaPuntos;
  estado: EstadoMatch;
  asientos: [Asiento | null, Asiento | null];
  version: number;
  canonico: EstadoPartida | null;
  acciones: Map<string, ResultadoAccion>;
  metricas: { cartas: number; bazas: number; manos: number; puntos: number };
  ultimoCierre: {
    idMano: string;
    version: number;
    equipo: string;
    puntos: number;
    causa: string;
    bazas: readonly Readonly<{
      jugadas: readonly Readonly<{ jugador: string; carta: Carta }>[];
      equipoGanador: string | null;
    }>[];
    comprobacionInterna: ComprobacionPublicaInterna | null;
  } | null;
  /** Hecho privado de servidor hasta que el cierre definitivo autoriza su publicación. */
  comprobacionEnvidoPendiente: ComprobacionEnvidoInterna | null;
  eventosPublicos: EventoPublicoInterno[];
  siguienteSecuenciaEvento: number;
  esperaContinuacion: { idMano: string; requeridos: Set<string>; confirmados: Set<string> } | null;
};

type ParticipanteComprobacionInterno = Readonly<{
  jugador: string;
  equipo: string;
  cartas: readonly Carta[];
  tanto?: number;
}>;
type ComprobacionFlorInterna = Readonly<{
  resultado: "sin-desafio" | "rechazo" | "comparada";
  desafio?: "contra-flor" | "contra-flor-al-resto";
  participantes: readonly ParticipanteComprobacionInterno[];
  equipoGanador?: string;
}>;
type ComprobacionEnvidoInterna = Readonly<{
  participantes: readonly ParticipanteComprobacionInterno[];
  equipoGanador: string;
  jugadorDeterminante: string;
}>;
type ComprobacionPublicaInterna = Readonly<{
  flor?: ComprobacionFlorInterna;
  envido?: ComprobacionEnvidoInterna;
}>;

type AdjudicacionPublicaInterna = Readonly<{
  equipo: string;
  puntos: number;
  causa?: string;
}>;
type EventoPublicoInterno = Readonly<{
  secuencia: number;
  idMano: string;
  tipo: string;
  jugador?: string;
  canto?: string;
  nivelTruco?: string;
  equipoGanador?: string;
  adjudicaciones?: readonly AdjudicacionPublicaInterna[];
  tantos?: readonly Readonly<{ jugador: string; tanto: number }>[];
  marcadorCierre?: readonly Readonly<{ equipo: string; puntos: number }>[];
}>;
export type EventoPublico = Readonly<{
  secuencia: number;
  idMano: string;
  tipo: string;
  asiento?: number;
  canto?: string;
  nivelTruco?: string;
  asientoGanador?: number;
  adjudicaciones?: readonly Readonly<{ asientoGanador: number; puntos: number; causa?: string }>[];
  tantos?: readonly Readonly<{ asiento: number; tanto: number }>[];
  marcadorCierre?: readonly Readonly<{ asiento: number; puntos: number }>[];
}>;

function puntosAdjudicadosEnMano(estado: EstadoPartida): Readonly<Record<string, number>> {
  const equipos = estado.mano.juego.mano.equipos;
  const puntos = Object.fromEntries(equipos.map((equipo) => [equipo, 0])) as Record<string, number>;
  for (const adjudicacion of estado.mano.flor.adjudicaciones)
    puntos[adjudicacion.equipo] += adjudicacion.puntos;
  for (const adjudicacion of estado.mano.envido.resueltos)
    puntos[adjudicacion.equipo] += adjudicacion.puntos;
  if (estado.mano.adjudicacionTruco)
    puntos[estado.mano.adjudicacionTruco.equipo] += estado.mano.adjudicacionTruco.puntos;
  return puntos;
}

export type SolicitudAccion = Readonly<{
  actionId: string;
  expectedVersion: number;
  action: AccionRed;
}>;
export type ResultadoAccion = Readonly<{
  huella: string;
  aceptada: boolean;
  version: number;
  codigo?: string;
}>;

export type FuenteAleatoria = Readonly<{
  /** Devuelve un entero uniforme del intervalo inclusivo 0..maximo. */
  enteroInclusivo(maximo: number): number;
}>;

export type ErrorOperacion = Readonly<{
  codigo: "solicitud-invalida" | "no-autenticado" | "no-autorizado" | "no-encontrado" | "conflicto";
  mensaje: string;
}>;

export class ErrorDeOperacion extends Error {
  constructor(readonly detalle: ErrorOperacion) {
    super(detalle.mensaje);
  }
}

export type SnapshotEspera = Readonly<{
  estado: "esperando";
  matchId: string;
  modalidad: "1v1";
  metaPuntos: MetaPuntos;
  version: number;
  asientoPropio: number;
  participantes: readonly Readonly<{
    asiento: number;
    apodo: string;
    automatico?: boolean;
    equipo?: string;
  }>[];
}>;

export type SnapshotJugadaPublica = Readonly<{ asiento: number; carta: Carta }>;
export type SnapshotBazaPublica = Readonly<{
  jugadas: readonly SnapshotJugadaPublica[];
  asientoGanador: number | null;
}>;

export type SnapshotIniciado = Readonly<{
  estado: "iniciada";
  matchId: string;
  modalidad: "1v1";
  metaPuntos: MetaPuntos;
  version: number;
  idMano: string;
  asientoPropio: number;
  participantes: readonly Readonly<{
    asiento: number;
    apodo: string;
    automatico?: boolean;
    equipo?: string;
  }>[];
  marcador: readonly Readonly<{ asiento: number; puntos: number }>[];
  resultadoPartida: Readonly<{ asientoGanador: number }> | null;
  repartidor: number;
  muestra: Carta;
  cartasPropias: readonly Carta[];
  cartasRivalesRestantes: number;
  accionesDisponibles: readonly AccionRed[];
  eventosPublicos: readonly EventoPublico[];
  bazasCompletadas: readonly SnapshotBazaPublica[];
  bazaActual: SnapshotBazaPublica;
  turno: number | null;
  desafiosPendientes: Readonly<{
    envido: Readonly<{ proponente: number; respondedor: number; valor: number }> | null;
    flor: Readonly<{ tipo: string; proponente: number; respondedor: number }> | null;
    truco: Readonly<{ nivel: string; proponente: number }> | null;
    oportunidadFlorPropia: boolean;
  }>;
  ultimoCierre: Readonly<{
    idMano: string;
    version: number;
    asientoGanador: number;
    equipo: string;
    puntos: number;
    causa: string;
    bazas: readonly SnapshotBazaPublica[];
    comprobacion?: Readonly<{
      flor?: Readonly<{
        resultado: "sin-desafio" | "rechazo" | "comparada";
        desafio?: "contra-flor" | "contra-flor-al-resto";
        participantes: readonly Readonly<{
          asiento: number;
          equipo: string;
          cartas: readonly Carta[];
          tanto?: number;
        }>[];
        asientoGanador?: number;
      }>;
      envido?: Readonly<{
        participantes: readonly Readonly<{
          asiento: number;
          equipo: string;
          cartas: readonly Carta[];
          tanto: number;
        }>[];
        asientoGanador: number;
        asientoDeterminante: number;
      }>;
    }>;
  }> | null;
  continuacion: Readonly<{ idMano: string; confirmadaPropia: boolean; faltantes: number }> | null;
}>;

export type SnapshotPartida = SnapshotEspera | SnapshotIniciado;

function error(codigo: ErrorOperacion["codigo"], mensaje: string): never {
  throw new ErrorDeOperacion({ codigo, mensaje });
}

function fuenteSegura(): FuenteAleatoria {
  return { enteroInclusivo: (maximo) => randomInt(maximo + 1) };
}

function enteroAleatorio(fuente: FuenteAleatoria, maximo: number): number {
  const valor = fuente.enteroInclusivo(maximo);
  if (!Number.isInteger(valor) || valor < 0 || valor > maximo)
    throw new TypeError("La fuente de aleatoriedad devolvió un valor inválido.");
  return valor;
}

function proyectarBaza(
  jugadas: readonly Readonly<{ jugador: string; carta: Carta }>[],
  asientoDe: (jugador: string) => number,
  equipoGanador: string | null = null,
  asientoDelEquipo?: (equipo: string) => number,
): SnapshotBazaPublica {
  return {
    jugadas: jugadas.map((jugada) => ({
      asiento: asientoDe(jugada.jugador),
      carta: { ...jugada.carta },
    })),
    asientoGanador: equipoGanador === null ? null : asientoDelEquipo!(equipoGanador),
  };
}

function copiarCartas(cartas: readonly Carta[]): readonly Carta[] {
  return cartas.map((carta) => ({ ...carta }));
}

/** Proyección que se aplica sólo al resumen ya autorizado por el cierre definitivo. */
function proyectarComprobacionPublica(
  comprobacion: ComprobacionPublicaInterna | null,
  asientoDe: (jugador: string) => number,
  asientoDelEquipo: (equipo: string) => number,
): SnapshotIniciado["ultimoCierre"] extends infer Cierre
  ? Cierre extends Readonly<{ comprobacion: infer Resultado }>
    ? Resultado
    : never
  : never {
  if (!comprobacion) return null as never;
  return {
    ...(comprobacion.flor
      ? {
          flor: {
            resultado: comprobacion.flor.resultado,
            ...(comprobacion.flor.desafio ? { desafio: comprobacion.flor.desafio } : {}),
            participantes: comprobacion.flor.participantes.map((participante) => ({
              asiento: asientoDe(participante.jugador),
              equipo: participante.equipo,
              cartas: copiarCartas(participante.cartas),
              ...(participante.tanto === undefined ? {} : { tanto: participante.tanto }),
            })),
            ...(comprobacion.flor.equipoGanador
              ? { asientoGanador: asientoDelEquipo(comprobacion.flor.equipoGanador) }
              : {}),
          },
        }
      : {}),
    ...(comprobacion.envido
      ? {
          envido: {
            participantes: comprobacion.envido.participantes.map((participante) => ({
              asiento: asientoDe(participante.jugador),
              equipo: participante.equipo,
              cartas: copiarCartas(participante.cartas),
              tanto: participante.tanto!,
            })),
            asientoGanador: asientoDelEquipo(comprobacion.envido.equipoGanador),
            asientoDeterminante: asientoDe(comprobacion.envido.jugadorDeterminante),
          },
        }
      : {}),
  } as never;
}

function crearComprobacionFlor(estado: EstadoPartida): ComprobacionFlorInterna | null {
  const flor = estado.mano.flor;
  if (!flor.anuncios.length) return null;
  const cartasPorJugador = new Map(
    estado.mano.juego.mano.manos.map((mano) => [mano.jugador, mano.cartas]),
  );
  const desafio = flor.historialDesafios.at(-1);
  const comparada = desafio?.respuesta === "quiero";
  const resultado = comparada ? "comparada" : desafio ? "rechazo" : "sin-desafio";
  const participantes = flor.anuncios.map((anuncio) => {
    const cartas = cartasPorJugador.get(anuncio.jugador);
    if (!cartas) throw new Error("El anuncio de Flor no tiene mano canónica.");
    const tanto = comparada
      ? calcularTantoFlor(cartas, estado.mano.juego.mano.muestra).tanto
      : null;
    return {
      jugador: anuncio.jugador,
      equipo: anuncio.equipo,
      cartas: copiarCartas(cartas),
      ...(tanto === null ? {} : { tanto }),
    };
  });
  const equipoGanador = comparada
    ? (flor.resultadoTerminal?.equipo ??
      flor.adjudicaciones.find((item) => item.puntos > 0)?.equipo)
    : undefined;
  return {
    resultado,
    ...(desafio ? { desafio: desafio.tipo } : {}),
    participantes,
    ...(equipoGanador ? { equipoGanador } : {}),
  };
}

function crearComprobacionPublica(
  estado: EstadoPartida,
  envido: ComprobacionEnvidoInterna | null,
): ComprobacionPublicaInterna | null {
  const flor = crearComprobacionFlor(estado);
  if (!flor && !envido) return null;
  return { ...(flor ? { flor } : {}), ...(envido ? { envido } : {}) };
}

function proyectarAccion(accion: AccionAutomatica): AccionRed {
  switch (accion.tipo) {
    case "jugar-carta":
      return { type: "play-card", card: { ...accion.carta } };
    case "anunciar-flor":
      return { type: "announce-flor" };
    case "proponer-contra-flor":
      return { type: "contra-flor" };
    case "proponer-contra-flor-al-resto":
      return { type: "contra-flor-al-resto" };
    case "quiero-contra-flor":
      return { type: "accept-contra-flor" };
    case "no-quiero-contra-flor":
      return { type: "reject-contra-flor" };
    case "quiero-contra-flor-al-resto":
      return { type: "accept-contra-flor-al-resto" };
    case "no-quiero-contra-flor-al-resto":
      return { type: "reject-contra-flor-al-resto" };
    case "iniciar-envido":
      return { type: "envido", canto: accion.canto };
    case "aumentar-envido":
      return { type: "raise-envido", canto: accion.canto };
    case "quiero-envido":
      return { type: "accept-envido" };
    case "no-quiero-envido":
      return { type: "reject-envido" };
    case "con-flor-quiero":
      return { type: "con-flor-quiero" };
    case "irse-al-mazo":
      return { type: "go-to-mazo" };
    case "proponer-truco":
      return { type: "truco" };
    case "quiero-truco":
      return { type: "accept-truco" };
    case "no-quiero-truco":
      return { type: "reject-truco" };
    case "proponer-retruco":
      return { type: "retruco" };
    case "quiero-retruco":
      return { type: "accept-retruco" };
    case "no-quiero-retruco":
      return { type: "reject-retruco" };
    case "proponer-vale-cuatro":
      return { type: "vale-cuatro" };
    case "quiero-vale-cuatro":
      return { type: "accept-vale-cuatro" };
    case "no-quiero-vale-cuatro":
      return { type: "reject-vale-cuatro" };
  }
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor : undefined;
}

function proyectarAdjudicaciones(
  valor: unknown,
): readonly AdjudicacionPublicaInterna[] | undefined {
  const entradas = Array.isArray(valor) ? valor : valor === undefined ? [] : [valor];
  const adjudicaciones = entradas.flatMap((entrada) => {
    if (!esRegistro(entrada)) return [];
    const equipo = texto(entrada.equipo);
    const puntos = entrada.puntos;
    if (!equipo || typeof puntos !== "number") return [];
    const causa = texto(entrada.motivo) ?? texto(entrada.causa);
    return [{ equipo, puntos, ...(causa ? { causa } : {}) }];
  });
  return adjudicaciones.length ? adjudicaciones : undefined;
}

/**
 * Reduce los eventos canónicos a datos que cualquier asiento puede conocer.
 * No transporta cartas de manos, tantos, evaluaciones ni decisiones internas.
 */
export function proyectarEventoPublico(
  evento: unknown,
): Omit<EventoPublicoInterno, "secuencia" | "idMano"> | null {
  if (!esRegistro(evento)) return null;
  const tipo = texto(evento.tipo);
  if (!tipo) return null;
  if (!(
    tipo === "carta-jugada" ||
    tipo === "baza-resuelta" ||
    tipo === "jugador-retirado" ||
    tipo.startsWith("mano-decidida-") ||
    tipo.startsWith("envido-") ||
    tipo.startsWith("truco-") ||
    tipo.startsWith("retruco-") ||
    tipo.startsWith("vale-cuatro-") ||
    tipo.startsWith("flor-") ||
    tipo.startsWith("contra-flor-") ||
    tipo === "mazo-adjudicado" ||
    tipo === "partida-terminada-contra-flor-al-resto"
  ))
    return null;

  const jugada = esRegistro(evento.jugada) ? evento.jugada : undefined;
  const propuesta = esRegistro(evento.propuesta) ? evento.propuesta : undefined;
  const adjudicacion = esRegistro(evento.adjudicacion) ? evento.adjudicacion : undefined;
  const cadena = esRegistro(evento.cadena) ? evento.cadena : undefined;
  const ultimoCanto = Array.isArray(cadena?.cantos) ? cadena.cantos.at(-1) : undefined;
  const canto = esRegistro(ultimoCanto) ? texto(ultimoCanto.canto) : undefined;
  const nivelTruco = texto(propuesta?.nivel) ?? texto(adjudicacion?.nivel);
  const jugador =
    texto(evento.jugador) ??
    texto(evento.respondedor) ??
    texto(evento.jugadorRetirado) ??
    texto(jugada?.jugador) ??
    texto(propuesta?.proponente) ??
    texto(cadena?.proponente);
  const adjudicaciones =
    proyectarAdjudicaciones(evento.adjudicacion) ?? proyectarAdjudicaciones(evento.adjudicaciones);
  // El motor conserva el cierre técnico de la fase aun cuando no hubo ningún
  // anuncio de Flor. Sus importes cero no constituyen una adjudicación pública.
  if (
    tipo === "flor-adjudicada" &&
    (!adjudicaciones || adjudicaciones.every(({ puntos }) => puntos === 0))
  )
    return null;
  const equipoGanador =
    texto(evento.equipoGanador) ??
    texto(evento.equipo) ??
    adjudicaciones?.find(({ puntos }) => puntos > 0)?.equipo ??
    adjudicaciones?.[0]?.equipo;
  return {
    tipo,
    ...(jugador ? { jugador } : {}),
    ...(canto ? { canto } : {}),
    ...(nivelTruco ? { nivelTruco } : {}),
    ...(equipoGanador ? { equipoGanador } : {}),
    ...(adjudicaciones ? { adjudicaciones } : {}),
    ...(Array.isArray(evento.tantos)
      ? {
          tantos: evento.tantos.flatMap((tanto) =>
            esRegistro(tanto) &&
            typeof tanto.jugador === "string" &&
            typeof tanto.tanto === "number"
              ? [{ jugador: tanto.jugador, tanto: tanto.tanto }]
              : [],
          ),
        }
      : {}),
  };
}

/** Estado efímero de 6A, aislado para poder sustituirlo por persistencia transaccional en 6D. */
export class RepositorioPartidasEnMemoria {
  readonly #sesiones = new Map<string, SesionInterna>();
  readonly #partidas = new Map<string, PartidaInterna>();

  constructor(
    private readonly aleatoriedad: FuenteAleatoria = fuenteSegura(),
    private readonly politicaAutomatica: PoliticaEstrategica = politicaEstrategicaGlobal,
  ) {}

  crearSesion(apodo: unknown): Readonly<{ token: string; apodo: string }> {
    if (typeof apodo !== "string" || !esApodoValido(apodo))
      error("solicitud-invalida", "El apodo debe tener entre 3 y 20 caracteres permitidos.");
    const sesion: SesionInterna = {
      id: randomUUID(),
      apodo,
      token: randomBytes(32).toString("base64url"),
    };
    this.#sesiones.set(sesion.token, sesion);
    return { token: sesion.token, apodo: sesion.apodo };
  }

  autenticar(token: string | null): SesionInvitado {
    const sesion = token ? this.#sesiones.get(token) : undefined;
    if (!sesion) error("no-autenticado", "La sesión no es válida.");
    return { id: sesion.id, apodo: sesion.apodo };
  }

  crearPartida(
    creador: SesionInvitado,
    metaPuntos: MetaPuntos,
    contraMaquina = false,
  ): PartidaInterna {
    if (metaPuntos !== 30 && metaPuntos !== 40)
      error("solicitud-invalida", "metaPuntos debe ser 30 o 40.");
    const partida: PartidaInterna = {
      id: this.#nuevoIdPartida(),
      modalidad: "1v1",
      contraMaquina,
      metaPuntos,
      estado: "esperando",
      asientos: [
        { jugadorId: creador.id, apodo: creador.apodo },
        contraMaquina ? { jugadorId: "__maquina__", apodo: "Máquina", automatico: true } : null,
      ],
      version: 1,
      canonico: null,
      acciones: new Map(),
      metricas: { cartas: 0, bazas: 0, manos: 0, puntos: 0 },
      ultimoCierre: null,
      comprobacionEnvidoPendiente: null,
      eventosPublicos: [],
      siguienteSecuenciaEvento: 1,
      esperaContinuacion: null,
    };
    this.#partidas.set(partida.id, partida);
    if (contraMaquina) this.iniciar(partida.id, creador);
    return partida;
  }

  aplicarAccion(
    partidaId: string,
    sesion: SesionInvitado,
    solicitud: SolicitudAccion,
  ): ResultadoAccion {
    const partida = this.#obtenerParaJugador(partidaId, sesion.id);
    if (partida.estado !== "iniciada" || !partida.canonico)
      error("conflicto", "La partida todavía no está iniciada.");
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(solicitud.actionId) ||
      !Number.isInteger(solicitud.expectedVersion) ||
      solicitud.expectedVersion < 1
    )
      error("solicitud-invalida", "actionId o expectedVersion inválidos.");
    const clave = `${sesion.id}:${solicitud.actionId}`;
    const huella = JSON.stringify({
      expectedVersion: solicitud.expectedVersion,
      action: solicitud.action,
    });
    const previo = partida.acciones.get(clave);
    if (previo) {
      if (previo.huella !== huella) error("conflicto", "actionId reutilizado con otro contenido.");
      return previo;
    }
    let resultado: ResultadoAccion;
    if (solicitud.expectedVersion !== partida.version) {
      resultado = { huella, aceptada: false, version: partida.version, codigo: "version-obsoleta" };
    } else if (solicitud.action.type === "continue-hand") {
      const espera = partida.esperaContinuacion;
      if (!espera || espera.idMano !== solicitud.action.handId || !espera.requeridos.has(sesion.id))
        resultado = {
          huella,
          aceptada: false,
          version: partida.version,
          codigo: "continuacion-invalida",
        };
      else {
        espera.confirmados.add(sesion.id);
        if (espera.confirmados.size === espera.requeridos.size) {
          const siguiente = siguienteMano(partida.canonico, this.#mazoAleatorio());
          if (!siguiente.aceptada) throw new Error("No se pudo preparar la siguiente mano.");
          partida.esperaContinuacion = null;
          partida.comprobacionEnvidoPendiente = null;
          partida.canonico = this.#avanzarPartida(siguiente.estado, partida);
        }
        partida.version += 1;
        resultado = { huella, aceptada: true, version: partida.version };
      }
    } else if (partida.esperaContinuacion) {
      resultado = {
        huella,
        aceptada: false,
        version: partida.version,
        codigo: "esperando-continuacion",
      };
    } else {
      const transicion = ejecutarAccionPartida(
        partida.canonico,
        aAccionCoordinada(solicitud.action, sesion.id),
      );
      if (!transicion.aceptada) {
        resultado = {
          huella,
          aceptada: false,
          version: partida.version,
          codigo: transicion.rechazo.codigo,
        };
      } else {
        this.#registrarEventos(partida, partida.canonico, transicion.eventos);
        partida.canonico = this.#avanzarPartida(transicion.estado, partida);
        if (solicitud.action.type === "play-card") partida.metricas.cartas += 1;
        partida.version += 1;
        resultado = { huella, aceptada: true, version: partida.version };
      }
    }
    partida.acciones.set(clave, resultado);
    if (partida.acciones.size > 256) partida.acciones.delete(partida.acciones.keys().next().value!);
    return resultado;
  }

  unirse(
    partidaId: string,
    sesion: SesionInvitado,
  ): Readonly<{ partida: PartidaInterna; asiento: number }> {
    const partida = this.#obtener(partidaId);
    const existente = this.#asientoDe(partida, sesion.id);
    if (existente !== -1) return { partida, asiento: existente };
    if (partida.estado !== "esperando") error("conflicto", "La partida ya fue iniciada.");
    const asiento = partida.asientos.findIndex((item) => item === null);
    if (asiento === -1) error("conflicto", "La partida no tiene asientos disponibles.");
    partida.asientos[asiento] = { jugadorId: sesion.id, apodo: sesion.apodo };
    partida.version += 1;
    return { partida, asiento };
  }

  iniciar(partidaId: string, sesion: SesionInvitado): PartidaInterna {
    const partida = this.#obtenerParaJugador(partidaId, sesion.id);
    if (partida.estado !== "esperando") error("conflicto", "La partida ya fue iniciada.");
    if (partida.asientos.some((asiento) => asiento === null))
      error("conflicto", "Falta un participante para iniciar la partida.");

    const jugadores = partida.asientos.map((asiento, posicion) => ({
      id: asiento!.jugadorId,
      equipo: `equipo-${posicion}`,
      posicion,
    }));
    const mesa: Mesa = { modalidad: "1v1", jugadores };
    const repartidor = seleccionarPrimerRepartidor(mesa, enteroAleatorio(this.aleatoriedad, 1));
    const elecciones = Array.from({ length: 39 }, (_, indice) =>
      enteroAleatorio(this.aleatoriedad, 39 - indice),
    );
    const mano = prepararMano(mesa, repartidor, barajarMazo(crearMazo(), elecciones));
    const juego = iniciarJuegoCartas(mano);
    partida.canonico = crearEstadoPartida(
      crearEstadoManoCoordinada(juego, {
        metaPuntos: partida.metaPuntos,
        puntajesIniciales: { "equipo-0": 0, "equipo-1": 0 },
        esDesempate: false,
      }),
    );
    partida.estado = "iniciada";
    partida.version += 1;
    partida.canonico = this.#avanzarPartida(partida.canonico, partida);
    return partida;
  }

  snapshot(partidaId: string, sesion: SesionInvitado): SnapshotPartida {
    const partida = this.#obtenerParaJugador(partidaId, sesion.id);
    const asientoPropio = this.#asientoDe(partida, sesion.id);
    const participantes = partida.asientos.flatMap((asiento, indice) => {
      if (!asiento) return [];
      const equipo = partida.canonico?.mesa.jugadores.find(
        (jugador) => jugador.id === asiento.jugadorId,
      )?.equipo;
      return [
        {
          asiento: indice,
          apodo: asiento.apodo,
          automatico: asiento.automatico,
          ...(equipo ? { equipo } : {}),
        },
      ];
    });
    if (partida.estado === "esperando")
      return {
        estado: "esperando",
        matchId: partida.id,
        modalidad: partida.modalidad,
        metaPuntos: partida.metaPuntos,
        version: partida.version,
        asientoPropio,
        participantes,
      };

    const estado = partida.canonico;
    if (!estado) throw new Error("Una partida iniciada debe tener estado canónico.");
    const asientoDe = (jugador: string): number => {
      const asiento = this.#asientoDe(partida, jugador);
      if (asiento === -1) throw new Error("El estado canónico contiene un jugador ajeno.");
      return asiento;
    };
    const manoPropia = estado.mano.juego.cartasDisponibles.find(
      (mano) => mano.jugador === sesion.id,
    );
    if (!manoPropia) throw new Error("El estado canónico no contiene la mano del jugador.");
    const manoRival = estado.mano.juego.cartasDisponibles.find(
      (mano) => mano.jugador !== sesion.id,
    );
    if (!manoRival) throw new Error("El estado canónico no contiene la mano rival.");
    const asientoDelEquipo = (equipo: string): number => {
      const jugador = estado.mesa.jugadores.find((item) => item.equipo === equipo);
      if (!jugador) throw new Error("El estado canónico contiene un equipo desconocido.");
      return jugador.posicion;
    };
    const puntosEnCurso =
      estado.fase === "mano-activa" || estado.fase === "mano-activa-2v2"
        ? puntosAdjudicadosEnMano(estado)
        : null;
    return {
      estado: "iniciada",
      matchId: partida.id,
      modalidad: partida.modalidad,
      metaPuntos: partida.metaPuntos,
      version: partida.version,
      idMano: `mano-${estado.ordinalMano}`,
      asientoPropio,
      participantes,
      marcador: estado.mesa.jugadores.map((jugador) => ({
        asiento: jugador.posicion,
        puntos: estado.puntajes[jugador.equipo] + (puntosEnCurso?.[jugador.equipo] ?? 0),
      })),
      resultadoPartida:
        estado.fase === "partida-finalizada" && estado.equipoGanador
          ? { asientoGanador: asientoDelEquipo(estado.equipoGanador) }
          : null,
      repartidor: asientoDe(estado.mano.juego.mano.repartidor),
      muestra: { ...estado.mano.juego.mano.muestra },
      cartasPropias: manoPropia.cartas.map((carta) => ({ ...carta })),
      cartasRivalesRestantes: manoRival.cartas.length,
      accionesDisponibles: obtenerAccionesLegalesJugador(estado, sesion.id).map(proyectarAccion),
      eventosPublicos: partida.eventosPublicos.map((evento) => ({
        secuencia: evento.secuencia,
        idMano: evento.idMano,
        tipo: evento.tipo,
        ...(evento.jugador ? { asiento: asientoDe(evento.jugador) } : {}),
        ...(evento.canto ? { canto: evento.canto } : {}),
        ...(evento.nivelTruco ? { nivelTruco: evento.nivelTruco } : {}),
        ...(evento.equipoGanador ? { asientoGanador: asientoDelEquipo(evento.equipoGanador) } : {}),
        ...(evento.adjudicaciones
          ? {
              adjudicaciones: evento.adjudicaciones.map((adjudicacion) => ({
                asientoGanador: asientoDelEquipo(adjudicacion.equipo),
                puntos: adjudicacion.puntos,
                ...(adjudicacion.causa ? { causa: adjudicacion.causa } : {}),
              })),
            }
          : {}),
        ...(evento.tantos
          ? {
              tantos: evento.tantos.map((tanto) => ({
                asiento: asientoDe(tanto.jugador),
                tanto: tanto.tanto,
              })),
            }
          : {}),
        ...(evento.marcadorCierre
          ? {
              marcadorCierre: evento.marcadorCierre.map((item) => ({
                asiento: asientoDelEquipo(item.equipo),
                puntos: item.puntos,
              })),
            }
          : {}),
      })),
      bazasCompletadas: estado.mano.juego.bazasCompletadas.map((baza) =>
        proyectarBaza(baza.jugadas, asientoDe, baza.resultado.equipoGanador, asientoDelEquipo),
      ),
      bazaActual: proyectarBaza(estado.mano.juego.bazaActual.jugadas, asientoDe),
      turno: estado.mano.juego.jugadorTurno ? asientoDe(estado.mano.juego.jugadorTurno) : null,
      desafiosPendientes: {
        envido: estado.mano.envido.pendiente
          ? {
              proponente: asientoDe(estado.mano.envido.pendiente.proponente),
              respondedor: asientoDelEquipo(estado.mano.envido.pendiente.equipoRespondedor),
              valor: estado.mano.envido.pendiente.valorAceptado,
            }
          : null,
        flor: estado.mano.flor.pendiente
          ? {
              tipo: estado.mano.flor.pendiente.tipo,
              proponente: asientoDe(estado.mano.flor.pendiente.proponente),
              respondedor: asientoDelEquipo(estado.mano.flor.pendiente.equipoRespondedor),
            }
          : null,
        truco: estado.mano.truco.propuestaPendiente
          ? {
              nivel: estado.mano.truco.propuestaPendiente.nivel,
              proponente: asientoDe(estado.mano.truco.propuestaPendiente.proponente),
            }
          : null,
        oportunidadFlorPropia:
          estado.mano.liquidacionMazo?.oportunidadFlor?.estado === "pendiente" &&
          estado.mano.liquidacionMazo.oportunidadFlor.jugador === sesion.id,
      },
      ultimoCierre: partida.ultimoCierre
        ? {
            idMano: partida.ultimoCierre.idMano,
            version: partida.ultimoCierre.version,
            equipo: partida.ultimoCierre.equipo,
            puntos: partida.ultimoCierre.puntos,
            causa: partida.ultimoCierre.causa,
            asientoGanador: asientoDelEquipo(partida.ultimoCierre.equipo),
            bazas: partida.ultimoCierre.bazas.map((baza) =>
              proyectarBaza(baza.jugadas, asientoDe, baza.equipoGanador, asientoDelEquipo),
            ),
            ...(partida.ultimoCierre.comprobacionInterna
              ? {
                  comprobacion: proyectarComprobacionPublica(
                    partida.ultimoCierre.comprobacionInterna,
                    asientoDe,
                    asientoDelEquipo,
                  ),
                }
              : {}),
          }
        : null,
      continuacion: partida.esperaContinuacion
        ? {
            idMano: partida.esperaContinuacion.idMano,
            confirmadaPropia: partida.esperaContinuacion.confirmados.has(sesion.id),
            faltantes:
              partida.esperaContinuacion.requeridos.size -
              partida.esperaContinuacion.confirmados.size,
          }
        : null,
    };
  }

  /** Diagnóstico acotado para pruebas de integración; no se publica por HTTP/WebSocket. */
  diagnosticar(partidaId: string, sesion: SesionInvitado): Readonly<Record<string, unknown>> {
    const partida = this.#obtenerParaJugador(partidaId, sesion.id);
    const estado = partida.canonico;
    if (!estado) return { estado: partida.estado };
    return {
      fasePartida: estado.fase,
      ciclo: estado.mano.ciclo,
      juegoFinalizado: estado.mano.juego.finalizada,
      turno: estado.mano.juego.jugadorTurno,
      retirados: estado.mano.juego.retirados,
      liquidacionMazo: estado.mano.liquidacionMazo,
      envidoPendiente: estado.mano.envido.pendiente !== null,
      florPendiente: estado.mano.flor.pendiente !== null,
      trucoPendiente: estado.mano.truco.propuestaPendiente !== null,
    };
  }

  metricasPrueba(partidaId: string, sesion: SesionInvitado): Readonly<Record<string, number>> {
    const partida = this.#obtenerParaJugador(partidaId, sesion.id);
    return { ...partida.metricas };
  }

  #obtener(id: string): PartidaInterna {
    const partida = this.#partidas.get(id);
    if (!partida) error("no-encontrado", "La partida no existe.");
    return partida;
  }

  #obtenerParaJugador(id: string, jugadorId: string): PartidaInterna {
    const partida = this.#obtener(id);
    if (this.#asientoDe(partida, jugadorId) === -1)
      error("no-autorizado", "No pertenecés a esta partida.");
    return partida;
  }

  #asientoDe(partida: PartidaInterna, jugadorId: string): number {
    return partida.asientos.findIndex((asiento) => asiento?.jugadorId === jugadorId);
  }

  #nuevoIdPartida(): string {
    let id: string;
    do id = `m_${randomBytes(18).toString("base64url")}`;
    while (this.#partidas.has(id));
    return id;
  }

  #mazoAleatorio(): Carta[] {
    const elecciones = Array.from({ length: 39 }, (_, indice) =>
      enteroAleatorio(this.aleatoriedad, 39 - indice),
    );
    return barajarMazo(crearMazo(), elecciones);
  }

  #debeActuarMaquina(estado: EstadoPartida, maquina: string): boolean {
    const equipo = estado.mesa.jugadores.find((jugador) => jugador.id === maquina)?.equipo;
    if (!equipo) return false;
    // Un desafío pendiente suspende el turno de cartas: sólo puede actuar quien debe responder.
    if (
      estado.mano.envido.pendiente ||
      estado.mano.flor.pendiente ||
      estado.mano.truco.propuestaPendiente
    )
      return (
        estado.mano.envido.pendiente?.equipoRespondedor === equipo ||
        estado.mano.flor.pendiente?.equipoRespondedor === equipo ||
        (estado.mano.truco.propuestaPendiente !== null &&
          estado.mesa.jugadores.find(
            (jugador) => jugador.id === estado.mano.truco.propuestaPendiente?.proponente,
          )?.equipo !== equipo)
      );
    if (estado.mano.liquidacionMazo?.oportunidadFlor?.estado === "pendiente")
      return estado.mano.liquidacionMazo.oportunidadFlor.jugador === maquina;
    const florFueraDeTurno = obtenerAccionesLegalesJugador(estado, maquina).some((accion) =>
      ["anunciar-flor", "proponer-contra-flor", "proponer-contra-flor-al-resto"].includes(
        accion.tipo,
      ),
    );
    if (florFueraDeTurno) return true;
    if (estado.mano.juego.jugadorTurno === maquina) return true;
    return false;
  }

  #registrarEventos(
    partida: PartidaInterna,
    estado: EstadoPartida,
    eventos: readonly unknown[],
  ): void {
    for (const evento of eventos) {
      this.#registrarComprobacionEnvido(partida, estado, evento);
      const publico = proyectarEventoPublico(evento);
      if (!publico) continue;
      partida.eventosPublicos.push({
        secuencia: partida.siguienteSecuenciaEvento++,
        idMano: `mano-${estado.ordinalMano}`,
        ...publico,
      });
    }
  }

  /**
   * Conserva el resultado estructurado de una comparación aceptada. Nunca se
   * expone desde aquí: se incorpora recién al resumen del cierre definitivo.
   */
  #registrarComprobacionEnvido(
    partida: PartidaInterna,
    estado: EstadoPartida,
    evento: unknown,
  ): void {
    if (!esRegistro(evento) || evento.tipo !== "envido-aceptado" || !Array.isArray(evento.tantos))
      return;
    const cartasPorJugador = new Map(
      estado.mano.juego.mano.manos.map((mano) => [mano.jugador, mano.cartas]),
    );
    const participantes = evento.tantos.flatMap((registro) => {
      if (
        !esRegistro(registro) ||
        typeof registro.jugador !== "string" ||
        typeof registro.equipo !== "string" ||
        typeof registro.tanto !== "number"
      )
        return [];
      const cartas = cartasPorJugador.get(registro.jugador);
      return cartas
        ? [
            {
              jugador: registro.jugador,
              equipo: registro.equipo,
              cartas: copiarCartas(cartas),
              tanto: registro.tanto,
            },
          ]
        : [];
    });
    if (!participantes.length || participantes.length !== evento.tantos.length) return;
    const maximo = Math.max(...participantes.map((participante) => participante.tanto!));
    const determinante = estado.mano.juego.mano.ordenReparto
      .map((jugador) => participantes.find((participante) => participante.jugador === jugador))
      .find((participante) => participante?.tanto === maximo);
    if (!determinante) return;
    partida.comprobacionEnvidoPendiente = {
      participantes,
      equipoGanador: determinante.equipo,
      jugadorDeterminante: determinante.jugador,
    };
  }

  #registrarCierre(
    partida: PartidaInterna,
    estado: EstadoPartida,
    puntajesCierre: Readonly<Record<string, number>>,
  ): void {
    const ciclo = estado.mano.ciclo;
    if (ciclo.fase !== "cierre-definitivo")
      throw new Error("Sólo se puede registrar el cierre definitivo de una mano.");
    const adjudicacionTruco = estado.mano.adjudicacionTruco;
    const nivelTruco = adjudicacionTruco
      ? "nivelAceptado" in adjudicacionTruco
        ? adjudicacionTruco.nivelAceptado
        : adjudicacionTruco.nivelPropuesto
      : null;
    partida.eventosPublicos.push({
      secuencia: partida.siguienteSecuenciaEvento++,
      idMano: `mano-${estado.ordinalMano}`,
      tipo: "mano-cerrada",
      equipoGanador: ciclo.equipoGanador,
      ...(adjudicacionTruco
        ? {
            adjudicaciones: [
              {
                equipo: adjudicacionTruco.equipo,
                puntos: adjudicacionTruco.puntos,
                causa: ciclo.causa,
              },
            ],
          }
        : {}),
      ...(nivelTruco ? { nivelTruco } : {}),
    });
    partida.eventosPublicos.push({
      secuencia: partida.siguienteSecuenciaEvento++,
      idMano: `mano-${estado.ordinalMano}`,
      tipo: "tanteador-cierre",
      marcadorCierre: estado.mesa.jugadores.map((jugador) => ({
        equipo: jugador.equipo,
        puntos: puntajesCierre[jugador.equipo] ?? 0,
      })),
    });
  }

  #avanzarPartida(estadoInicial: EstadoPartida, partida?: PartidaInterna): EstadoPartida {
    let estado = estadoInicial;
    const vistos = new Set<string>();
    for (let pasos = 0; pasos < 64; pasos++) {
      const firma = JSON.stringify(estado);
      if (vistos.has(firma)) throw new Error("Ciclo detectado durante avance automático.");
      vistos.add(firma);
      if (estado.mano.ciclo.fase === "cierre-definitivo") {
        const contabilizada = contabilizarManoCerrada(estado);
        if (!contabilizada.aceptada) throw new Error("No se pudo contabilizar una mano cerrada.");
        if (partida?.contraMaquina) partida.version += 1;
        if (partida) {
          const puntos = Object.values(
            contabilizada.estado.manosContabilizadas.at(-1)?.puntos ?? {},
          ).reduce((a, b) => a + b, 0);
          partida.metricas.manos += 1;
          partida.metricas.puntos += puntos;
          this.#registrarCierre(partida, estado, contabilizada.estado.puntajes);
          partida.ultimoCierre = {
            idMano: `mano-${estado.ordinalMano}`,
            version: partida.version,
            equipo: estado.mano.ciclo.equipoGanador,
            puntos,
            causa: estado.mano.ciclo.causa,
            bazas: estado.mano.juego.bazasCompletadas.map((baza) => ({
              jugadas: baza.jugadas.map((jugada) => ({
                jugador: jugada.jugador,
                carta: { ...jugada.carta },
              })),
              equipoGanador: baza.resultado.equipoGanador,
            })),
            comprobacionInterna: crearComprobacionPublica(
              estado,
              partida.comprobacionEnvidoPendiente,
            ),
          };
        }
        if (contabilizada.estado.fase === "partida-finalizada") return contabilizada.estado;
        if (partida) {
          partida.esperaContinuacion = {
            idMano: `mano-${estado.ordinalMano}`,
            requeridos: new Set(
              partida.asientos.flatMap((asiento) =>
                asiento && !asiento.automatico ? [asiento.jugadorId] : [],
              ),
            ),
            confirmados: new Set(),
          };
        }
        return contabilizada.estado;
      }
      const liquidacion = estado.mano.liquidacionMazo;
      if (
        liquidacion?.puntos === "pendiente" &&
        liquidacion.oportunidadFlor?.estado !== "pendiente"
      ) {
        const liquidada = ejecutarAccionPartida(estado, { tipo: "liquidar-puntos-mazo" });
        if (!liquidada.aceptada)
          throw new Error(
            `No se pudo liquidar el mazo (${liquidada.rechazo.codigo}): ${liquidada.rechazo.mensaje}`,
          );
        estado = liquidada.estado;
        if (partida?.contraMaquina) partida.version += 1;
        continue;
      }
      if (liquidacion?.puntos === "realizada" && estado.mano.ciclo.fase === "liquidacion") {
        const cerrada = ejecutarAccionPartida(estado, { tipo: "cerrar-mano-mazo" });
        if (!cerrada.aceptada) throw new Error("No se pudo cerrar la mano por mazo.");
        estado = cerrada.estado;
        if (partida?.contraMaquina) partida.version += 1;
        continue;
      }
      const maquina = partida?.asientos.find((asiento) => asiento?.automatico)?.jugadorId;
      if (maquina && this.#debeActuarMaquina(estado, maquina)) {
        const decision = ejecutarDecisionAutomatica(estado, maquina, this.politicaAutomatica, {
          siguiente: () => this.aleatoriedad.enteroInclusivo(1) / 2,
        });
        if (!decision.aceptada)
          throw new Error(`La máquina no pudo decidir: ${decision.rechazo.codigo}.`);
        if (partida) this.#registrarEventos(partida, estado, decision.eventos);
        estado = decision.estado;
        if (partida) {
          partida.metricas.cartas += decision.eventos.filter(
            (evento) => evento.tipo === "carta-jugada",
          ).length;
          partida.metricas.bazas += decision.eventos.filter(
            (evento) => evento.tipo === "baza-resuelta",
          ).length;
        }
        if (partida) partida.version += 1;
        continue;
      }
      return estado;
    }
    throw new Error("El avance automático excedió sus pasos permitidos.");
  }
}

export function esApodoValido(apodo: string): boolean {
  const longitud = Array.from(apodo).length;
  return longitud >= 3 && longitud <= 20 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 _-]+$/u.test(apodo);
}
