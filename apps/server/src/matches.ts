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
  politicaEstrategicaGlobal,
  type PoliticaEstrategica,
  type EstadoPartida,
  type Mesa,
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
  } | null;
};

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
  participantes: readonly Readonly<{ asiento: number; apodo: string; automatico?: boolean }>[];
}>;

export type SnapshotIniciado = Readonly<{
  estado: "iniciada";
  matchId: string;
  modalidad: "1v1";
  metaPuntos: MetaPuntos;
  version: number;
  asientoPropio: number;
  participantes: readonly Readonly<{ asiento: number; apodo: string; automatico?: boolean }>[];
  marcador: readonly Readonly<{ asiento: number; puntos: number }>[];
  repartidor: number;
  muestra: Carta;
  cartasPropias: readonly Carta[];
  cartasJugadas: readonly Readonly<{ asiento: number; carta: Carta }>[];
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
    equipo: string;
    puntos: number;
    causa: string;
  }> | null;
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

function cartasJugadas(
  estado: EstadoPartida,
  asientoDe: (jugador: string) => number,
): SnapshotIniciado["cartasJugadas"] {
  const bazas = [...estado.mano.juego.bazasCompletadas, estado.mano.juego.bazaActual];
  return bazas.flatMap((baza) =>
    baza.jugadas.map((jugada) => ({
      asiento: asientoDe(jugada.jugador),
      carta: { ...jugada.carta },
    })),
  );
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
    const participantes = partida.asientos.flatMap((asiento, indice) =>
      asiento ? [{ asiento: indice, apodo: asiento.apodo, automatico: asiento.automatico }] : [],
    );
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
    const asientoDelEquipo = (equipo: string): number => {
      const jugador = estado.mesa.jugadores.find((item) => item.equipo === equipo);
      if (!jugador) throw new Error("El estado canónico contiene un equipo desconocido.");
      return jugador.posicion;
    };
    return {
      estado: "iniciada",
      matchId: partida.id,
      modalidad: partida.modalidad,
      metaPuntos: partida.metaPuntos,
      version: partida.version,
      asientoPropio,
      participantes,
      marcador: estado.mesa.jugadores.map((jugador) => ({
        asiento: jugador.posicion,
        puntos: estado.puntajes[jugador.equipo],
      })),
      repartidor: asientoDe(estado.mano.juego.mano.repartidor),
      muestra: { ...estado.mano.juego.mano.muestra },
      cartasPropias: manoPropia.cartas.map((carta) => ({ ...carta })),
      cartasJugadas: cartasJugadas(estado, asientoDe),
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
      ultimoCierre: partida.ultimoCierre,
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
    if (estado.mano.juego.jugadorTurno === maquina) return true;
    if (estado.mano.liquidacionMazo?.oportunidadFlor?.estado === "pendiente")
      return estado.mano.liquidacionMazo.oportunidadFlor.jugador === maquina;
    const equipo = estado.mesa.jugadores.find((jugador) => jugador.id === maquina)?.equipo;
    if (!equipo) return false;
    return (
      estado.mano.envido.pendiente?.equipoRespondedor === equipo ||
      estado.mano.flor.pendiente?.equipoRespondedor === equipo ||
      (estado.mano.truco.propuestaPendiente !== null &&
        estado.mesa.jugadores.find(
          (jugador) => jugador.id === estado.mano.truco.propuestaPendiente?.proponente,
        )?.equipo !== equipo)
    );
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
          partida.ultimoCierre = {
            idMano: `mano-${estado.ordinalMano}`,
            version: partida.version,
            equipo: estado.mano.ciclo.equipoGanador,
            puntos,
            causa: estado.mano.ciclo.causa,
          };
        }
        if (contabilizada.estado.fase === "partida-finalizada") return contabilizada.estado;
        const siguiente = siguienteMano(contabilizada.estado, this.#mazoAleatorio());
        if (!siguiente.aceptada) throw new Error("No se pudo preparar la siguiente mano.");
        estado = siguiente.estado;
        if (partida?.contraMaquina) partida.version += 1;
        continue;
      }
      const liquidacion = estado.mano.liquidacionMazo;
      if (
        liquidacion?.puntos === "pendiente" &&
        liquidacion.oportunidadFlor?.estado !== "pendiente"
      ) {
        const liquidada = ejecutarAccionPartida(estado, { tipo: "liquidar-puntos-mazo" });
        if (!liquidada.aceptada) throw new Error("No se pudo liquidar el mazo.");
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
