import type { Carta, MetaPuntos } from "@truco/shared";
import {
  identificarCarta,
  obtenerPieza,
  obtenerValorIndividual,
  sonCartasDisponibles,
} from "./cartas.js";
import { jugadorAnterior, obtenerOrdenReparto, validarMesa, type Mesa } from "./mano.js";
import type { EstadoJuegoCartas } from "./juego-cartas.js";
import {
  ejecutarCarta,
  esEstadoJuegoCartasValido,
  type AccionJuegoCartas,
  type EventoJuegoCartas,
  type RechazoJuegoCartas,
} from "./juego-cartas.js";

export type TantoEnvido =
  Readonly<{ tieneFlor: false; tanto: number }> | Readonly<{ tieneFlor: true }>;
export type CantoEnvido = "envido" | "real-envido" | "falta-envido";
export type CantoRegistrado = Readonly<{ jugador: string; equipo: string; canto: CantoEnvido }>;
export type ResultadoComparacionEnvido = Readonly<{
  aplicable: boolean;
  equipoGanador: string | null;
  jugadorDeterminante: string | null;
  tantoGanador: number | null;
  tantos: readonly Readonly<{ jugador: string; equipo: string; tanto: number }>[];
  motivo: "flor-pendiente" | "mayor-tanto" | "empate-por-mano";
}>;
export type CadenaEnvidoPendiente = Readonly<{
  proponente: string;
  equipoProponente: string;
  equipoRespondedor: string;
  cantos: readonly CantoRegistrado[];
  valorAceptado: number;
  valorAnteriorAceptado: number;
}>;
export type AdjudicacionEnvido = Readonly<{
  equipo: string;
  puntos: number;
  motivo: "aceptacion" | "rechazo" | "falta-envido";
  historial: readonly CantoRegistrado[];
}>;

function exigirMano(cartas: readonly Carta[], muestra: Carta): void {
  if (!Array.isArray(cartas) || cartas.length !== 3 || !sonCartasDisponibles(muestra, cartas))
    throw new TypeError("Se requieren tres cartas disponibles y una muestra válida.");
}

/** §7.1, sin canto ni adjudicación de Flor. */
export function tieneFlor(cartas: readonly Carta[], muestra: Carta): boolean {
  exigirMano(cartas, muestra);
  const piezas = cartas.filter((carta) => obtenerPieza(carta, muestra) !== null);
  if (new Set(cartas.map((carta) => carta.palo)).size === 1 || piezas.length >= 2) return true;
  return (
    piezas.length === 1 &&
    new Set(
      cartas.filter((carta) => obtenerPieza(carta, muestra) === null).map((carta) => carta.palo),
    ).size === 1
  );
}

/** §6.2. Nunca inventa un tanto para una mano con Flor. */
export function calcularTantoEnvido(cartas: readonly Carta[], muestra: Carta): TantoEnvido {
  exigirMano(cartas, muestra);
  if (tieneFlor(cartas, muestra)) return { tieneFlor: true };
  const piezas = cartas.filter((carta) => obtenerPieza(carta, muestra) !== null);
  if (piezas.length === 1) {
    const otras = cartas.filter((carta) => identificarCarta(carta) !== identificarCarta(piezas[0]));
    return {
      tieneFlor: false,
      tanto:
        obtenerValorIndividual(piezas[0], muestra) +
        Math.max(...otras.map((carta) => obtenerValorIndividual(carta, muestra))),
    };
  }
  const porPalo = new Map<string, Carta[]>();
  for (const carta of cartas)
    (porPalo.get(carta.palo) ?? (porPalo.set(carta.palo, []), porPalo.get(carta.palo)!)).push(
      carta,
    );
  const pareja = [...porPalo.values()].find((grupo) => grupo.length >= 2);
  return {
    tieneFlor: false,
    tanto: pareja
      ? 20 +
        pareja
          .map((carta) => obtenerValorIndividual(carta, muestra))
          .sort((a, b) => b - a)
          .slice(0, 2)
          .reduce((a, b) => a + b, 0)
      : Math.max(...cartas.map((carta) => obtenerValorIndividual(carta, muestra))),
  };
}

/** §6.3. Una Flor no es un Envido de cero: bloquea la comparación. */
export function compararTantosEnvido(
  mesa: Mesa,
  manoOriginal: string,
  muestra: Carta,
  manos: readonly Readonly<{ jugador: string; cartas: readonly Carta[] }>[],
): ResultadoComparacionEnvido {
  validarMesa(mesa);
  const jugadores = mesa.jugadores;
  if (
    !jugadores.some((j) => j.id === manoOriginal) ||
    !Array.isArray(manos) ||
    manos.length !== jugadores.length
  )
    throw new TypeError("Comparación de Envido inválida.");
  const resultados = manos.map((mano) => {
    const jugador = jugadores.find((j) => j.id === mano.jugador);
    if (!jugador) throw new TypeError("Jugador inválido.");
    return {
      jugador: jugador.id,
      equipo: jugador.equipo,
      resultado: calcularTantoEnvido(mano.cartas, muestra),
    };
  });
  if (
    new Set(resultados.map((r) => r.jugador)).size !== jugadores.length ||
    resultados.some((r) => r.resultado.tieneFlor)
  )
    return {
      aplicable: false,
      equipoGanador: null,
      jugadorDeterminante: null,
      tantoGanador: null,
      tantos: [],
      motivo: "flor-pendiente",
    };
  const tantos = resultados.map((r) => ({
    jugador: r.jugador,
    equipo: r.equipo,
    tanto: (r.resultado as { tanto: number }).tanto,
  }));
  const maximo = Math.max(...tantos.map((t) => t.tanto));
  const orden = obtenerOrdenReparto(mesa, jugadorAnterior(mesa, manoOriginal));
  const determinante = orden
    .map((id) => tantos.find((t) => t.jugador === id)!)
    .find((t) => t.tanto === maximo)!;
  return {
    aplicable: true,
    equipoGanador: determinante.equipo,
    jugadorDeterminante: determinante.jugador,
    tantoGanador: maximo,
    tantos,
    motivo: tantos.filter((t) => t.tanto === maximo).length > 1 ? "empate-por-mano" : "mayor-tanto",
  };
}

function aporte(canto: CantoEnvido): number {
  return canto === "envido" ? 2 : canto === "real-envido" ? 3 : 0;
}
export function iniciarCadenaEnvido(
  jugador: string,
  equipo: string,
  equipoRespondedor: string,
  canto: CantoEnvido,
): CadenaEnvidoPendiente {
  if (!jugador || !equipo || !equipoRespondedor || equipo === equipoRespondedor)
    throw new TypeError("Propuesta de Envido inválida.");
  return {
    proponente: jugador,
    equipoProponente: equipo,
    equipoRespondedor,
    cantos: [{ jugador, equipo, canto }],
    valorAceptado: aporte(canto),
    valorAnteriorAceptado: 0,
  };
}
export function aumentarEnvido(
  cadena: CadenaEnvidoPendiente,
  jugador: string,
  equipo: string,
  canto: CantoEnvido,
): CadenaEnvidoPendiente {
  if (!cadena || equipo !== cadena.equipoRespondedor || !jugador)
    throw new TypeError("Respuesta de Envido inválida.");
  const previos = cadena.cantos.map((c) => c.canto),
    ultimo = previos[previos.length - 1];
  if (
    ultimo === "falta-envido" ||
    (ultimo === "real-envido" && canto !== "falta-envido") ||
    (canto === "real-envido" && previos.includes("real-envido")) ||
    (canto === "envido" && ultimo === "real-envido")
  )
    throw new TypeError("Aumento de Envido ilegal.");
  return {
    proponente: jugador,
    equipoProponente: equipo,
    equipoRespondedor: cadena.equipoProponente,
    cantos: [...cadena.cantos, { jugador, equipo, canto }],
    valorAceptado: canto === "falta-envido" ? 0 : cadena.valorAceptado + aporte(canto),
    valorAnteriorAceptado: cadena.valorAceptado,
  };
}
export function calcularFaltaEnvido(
  meta: MetaPuntos,
  puntajesIniciales: Readonly<Record<string, number>>,
  equipos: readonly string[],
  ganador: string,
  desempate: boolean,
): number {
  if (
    (meta !== 30 && meta !== 40) ||
    equipos.length !== 2 ||
    !equipos.includes(ganador) ||
    equipos.some((e) => !Number.isInteger(puntajesIniciales[e]) || puntajesIniciales[e] < 0)
  )
    throw new TypeError("Datos de Falta Envido inválidos.");
  const [a, b] = equipos.map((e) => puntajesIniciales[e]);
  if (desempate && !(a >= meta && b >= meta && a === b))
    throw new TypeError("Desempate de Falta Envido incoherente.");
  if (desempate) return 2;
  const s = puntajesIniciales[ganador],
    mitad = meta / 2;
  return (a < mitad && b < mitad) || (s < mitad && a < mitad !== b < mitad) ? mitad - s : meta - s;
}
export function rechazarEnvido(cadena: CadenaEnvidoPendiente): AdjudicacionEnvido {
  return {
    equipo: cadena.equipoProponente,
    puntos: cadena.valorAnteriorAceptado || 1,
    motivo: "rechazo",
    historial: cadena.cantos,
  };
}

function cadenaPendienteValida(cadena: CadenaEnvidoPendiente, juego: EstadoJuegoCartas): boolean {
  const cantos = cadena?.cantos;
  if (!Array.isArray(cantos) || cantos.length === 0) return false;
  const equipos = juego.mano.equipos;
  if (
    cantos.some(
      (canto, i) =>
        !canto ||
        !equipos.includes(canto.equipo) ||
        !juego.mano.mesa.jugadores.some(
          (j) => j.id === canto.jugador && j.equipo === canto.equipo,
        ) ||
        (i > 0 && canto.equipo === cantos[i - 1].equipo),
    )
  )
    return false;
  const ultimo = cantos[cantos.length - 1];
  const valores = cantos.map((canto) => canto.canto);
  if (
    valores.filter((valor) => valor === "real-envido").length > 1 ||
    valores.slice(0, -1).includes("falta-envido") ||
    valores.some(
      (valor, indice) =>
        indice > 0 && valores[indice - 1] === "real-envido" && valor !== "falta-envido",
    )
  )
    return false;
  const valorAceptado = valores.includes("falta-envido")
    ? 0
    : valores.reduce((suma, valor) => suma + aporte(valor), 0);
  const valorAnteriorAceptado =
    ultimo.canto === "falta-envido"
      ? valores.slice(0, -1).reduce((suma, valor) => suma + aporte(valor), 0)
      : valorAceptado - aporte(ultimo.canto);
  return (
    ultimo.jugador === cadena.proponente &&
    ultimo.equipo === cadena.equipoProponente &&
    cadena.equipoRespondedor === equipos.find((e) => e !== ultimo.equipo) &&
    cadena.valorAceptado === valorAceptado &&
    cadena.valorAnteriorAceptado === valorAnteriorAceptado
  );
}

function estadoEnvidoValido(estado: EstadoEnvido): boolean {
  if (!estado || !esEstadoJuegoCartasValido(estado.juego) || !Array.isArray(estado.resueltos))
    return false;
  if (estado.pendiente && estado.resueltos.length > 0) return false;
  if (!estado.iniciado && (estado.pendiente || estado.resueltos.length > 0)) return false;
  return !estado.pendiente || cadenaPendienteValida(estado.pendiente, estado.juego);
}

/** Estado de integración: conserva el turno de cartas sin alterarlo mientras responde Envido. */
export type EstadoEnvido = Readonly<{
  juego: EstadoJuegoCartas;
  pendiente: CadenaEnvidoPendiente | null;
  resueltos: readonly AdjudicacionEnvido[];
  iniciado: boolean;
}>;
export type ResultadoEnvido =
  | Readonly<{ aceptada: true; estado: EstadoEnvido }>
  | Readonly<{ aceptada: false; codigo: string }>;
const fallo = (codigo: string): ResultadoEnvido => ({ aceptada: false, codigo });
export function crearEstadoEnvido(juego: EstadoJuegoCartas): EstadoEnvido {
  return { juego, pendiente: null, resueltos: [], iniciado: false };
}
export function iniciarEnvido(
  estado: EstadoEnvido,
  jugador: string,
  canto: CantoEnvido,
): ResultadoEnvido {
  if (!estadoEnvidoValido(estado)) return fallo("estado-invalido");
  if (!estado?.juego || !esEstadoJuegoCartasValido(estado.juego)) return fallo("estado-invalido");
  if (!estado || estado.iniciado || estado.pendiente) return fallo("cadena-duplicada");
  const juego = estado.juego,
    participante = juego?.mano.mesa.jugadores.find((p) => p.id === jugador);
  if (!participante) return fallo("jugador-inexistente");
  if (juego.finalizada || juego.bazasCompletadas.length !== 0 || juego.jugadorTurno !== jugador)
    return fallo("momento-invalido");
  return {
    aceptada: true,
    estado: {
      ...estado,
      iniciado: true,
      pendiente: iniciarCadenaEnvido(
        jugador,
        participante.equipo,
        juego.mano.equipos.find((e) => e !== participante.equipo)!,
        canto,
      ),
    },
  };
}
export function aumentarEnvidoEnJuego(
  estado: EstadoEnvido,
  jugador: string,
  canto: CantoEnvido,
): ResultadoEnvido {
  if (!estadoEnvidoValido(estado)) return fallo("estado-invalido");
  if (!estado?.juego || !esEstadoJuegoCartasValido(estado.juego)) return fallo("estado-invalido");
  if (!estado?.pendiente) return fallo("sin-cadena-pendiente");
  if (!cadenaPendienteValida(estado.pendiente, estado.juego)) return fallo("cadena-invalida");
  const p = estado.juego.mano.mesa.jugadores.find((x) => x.id === jugador);
  if (!p) return fallo("jugador-inexistente");
  try {
    return {
      aceptada: true,
      estado: { ...estado, pendiente: aumentarEnvido(estado.pendiente, jugador, p.equipo, canto) },
    };
  } catch {
    return fallo("aumento-invalido");
  }
}
export function responderNoQuiero(estado: EstadoEnvido, jugador: string): ResultadoEnvido {
  if (!estadoEnvidoValido(estado)) return fallo("estado-invalido");
  if (!estado?.juego || !esEstadoJuegoCartasValido(estado.juego)) return fallo("estado-invalido");
  if (!estado?.pendiente) return fallo("sin-cadena-pendiente");
  if (!cadenaPendienteValida(estado.pendiente, estado.juego)) return fallo("cadena-invalida");
  const p = estado.juego.mano.mesa.jugadores.find((x) => x.id === jugador);
  if (!p || p.equipo !== estado.pendiente.equipoRespondedor) return fallo("respondedor-invalido");
  return {
    aceptada: true,
    estado: {
      ...estado,
      pendiente: null,
      resueltos: [...estado.resueltos, rechazarEnvido(estado.pendiente)],
    },
  };
}

export function responderQuiero(
  estado: EstadoEnvido,
  jugador: string,
  manos: readonly Readonly<{ jugador: string; cartas: readonly Carta[] }>[],
  falta?: Readonly<{
    meta: MetaPuntos;
    puntajesIniciales: Readonly<Record<string, number>>;
    desempate: boolean;
  }>,
): ResultadoEnvido {
  if (!estadoEnvidoValido(estado)) return fallo("estado-invalido");
  if (!estado?.juego || !esEstadoJuegoCartasValido(estado.juego)) return fallo("estado-invalido");
  if (!estado?.pendiente) return fallo("sin-cadena-pendiente");
  if (!cadenaPendienteValida(estado.pendiente, estado.juego)) return fallo("cadena-invalida");
  const p = estado.juego.mano.mesa.jugadores.find((x) => x.id === jugador);
  if (!p || p.equipo !== estado.pendiente.equipoRespondedor) return fallo("respondedor-invalido");
  const comparacion = compararTantosEnvido(
    estado.juego.mano.mesa,
    estado.juego.mano.manoOriginal,
    estado.juego.mano.muestra,
    manos,
  );
  if (!comparacion.aplicable) return fallo("flor-pendiente");
  const faltaActual = estado.pendiente.cantos.at(-1)!.canto === "falta-envido";
  if (faltaActual && !falta) return fallo("falta-sin-contexto");
  const puntos = faltaActual
    ? calcularFaltaEnvido(
        falta!.meta,
        falta!.puntajesIniciales,
        estado.juego.mano.equipos,
        comparacion.equipoGanador!,
        falta!.desempate,
      )
    : estado.pendiente.valorAceptado;
  const resultado: AdjudicacionEnvido = {
    equipo: comparacion.equipoGanador!,
    puntos,
    motivo: faltaActual ? "falta-envido" : "aceptacion",
    historial: estado.pendiente.cantos,
  };
  return {
    aceptada: true,
    estado: { ...estado, pendiente: null, resueltos: [...estado.resueltos, resultado] },
  };
}

/** Transición pública integrada: impide saltar un Envido pendiente mediante cartas. */
export function ejecutarCartaConEnvido(
  estado: EstadoEnvido,
  accion: AccionJuegoCartas,
):
  | Readonly<{ aceptada: true; estado: EstadoEnvido; eventos: readonly EventoJuegoCartas[] }>
  | Readonly<{
      aceptada: false;
      rechazo: RechazoJuegoCartas | Readonly<{ codigo: "envido-pendiente"; mensaje: string }>;
    }> {
  if (!estadoEnvidoValido(estado))
    return {
      aceptada: false,
      rechazo: { codigo: "estado-invalido", mensaje: "Estado de Envido inválido." },
    };
  if (estado.pendiente)
    return {
      aceptada: false,
      rechazo: {
        codigo: "envido-pendiente",
        mensaje: "El Envido debe resolverse antes de jugar carta.",
      },
    };
  const transicion = ejecutarCarta(estado.juego, accion, undefined);
  return transicion.aceptada
    ? {
        aceptada: true,
        estado: { ...estado, juego: transicion.estado },
        eventos: transicion.eventos,
      }
    : transicion;
}
