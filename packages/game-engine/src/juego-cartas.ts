import type { Carta } from "@truco/shared";
import { esCarta, identificarCarta, obtenerJerarquia } from "./cartas.js";
import {
  jugadorAnterior,
  obtenerOrdenReparto,
  prepararMano,
  validarMesa,
  type ManoJugador,
  type ManoPreparada,
  type Mesa,
} from "./mano.js";
import type { ResultadoTransicion, Transicion } from "./index.js";

export type JugadaCarta = Readonly<{ jugador: string; carta: Carta }>;
export type BazaEnCurso = Readonly<{ salida: string; jugadas: readonly JugadaCarta[] }>;
export type ResultadoBaza = Readonly<{
  equipoGanador: string | null;
  jerarquiaMaxima: number;
  jugadoresMaximos: readonly string[];
  salidaSiguiente: string;
}>;
export type BazaCompletada = Readonly<{
  salida: string;
  jugadas: readonly JugadaCarta[];
  resultado: ResultadoBaza;
}>;
export type EstadoJuegoCartas = Readonly<{
  mano: ManoPreparada;
  cartasDisponibles: readonly ManoJugador[];
  bazaActual: BazaEnCurso;
  bazasCompletadas: readonly BazaCompletada[];
  jugadorTurno: string | null;
  finalizada: boolean;
  equipoGanador: string | null;
}>;
export type ResultadoProgresivo = Readonly<{
  finalizada: boolean;
  debeAbrirBaza: boolean;
  equipoGanador: string | null;
}>;
export type EventoJuegoCartas =
  | Readonly<{ tipo: "carta-jugada"; jugada: JugadaCarta }>
  | Readonly<{ tipo: "baza-resuelta"; baza: BazaCompletada }>
  | Readonly<{ tipo: "mano-decidida-por-bazas"; equipo: string }>;
export type RechazoJuegoCartas = Readonly<{
  codigo:
    | "estado-invalido"
    | "mano-finalizada"
    | "jugador-inexistente"
    | "fuera-de-turno"
    | "carta-invalida"
    | "carta-no-disponible";
  mensaje: string;
}>;
export type AccionJuegoCartas = Readonly<{ tipo: "jugar-carta"; jugador: string; carta: Carta }>;
export type TransicionJuegoCartas = Transicion<
  EstadoJuegoCartas,
  AccionJuegoCartas,
  undefined,
  EventoJuegoCartas,
  RechazoJuegoCartas
>;

const copiarCarta = (carta: Carta): Carta => ({ palo: carta.palo, valor: carta.valor });
const copiarJugada = (jugada: JugadaCarta): JugadaCarta => ({
  jugador: jugada.jugador,
  carta: copiarCarta(jugada.carta),
});
const rechazar = (
  codigo: RechazoJuegoCartas["codigo"],
  mensaje: string,
): ResultadoTransicion<EstadoJuegoCartas, EventoJuegoCartas, RechazoJuegoCartas> => ({
  aceptada: false,
  rechazo: { codigo, mensaje },
});

/** Rechaza una mano manipulada o incompleta antes de iniciar juego de cartas. */
export function validarManoPreparada(mano: ManoPreparada): void {
  if (!mano || typeof mano !== "object") throw new TypeError("Mano preparada inválida.");
  validarMesa(mano.mesa);
  const jugadores = mano.mesa.jugadores;
  if (typeof mano.repartidor !== "string" || !jugadores.some((j) => j.id === mano.repartidor))
    throw new TypeError("Repartidor inválido.");
  const mazo = [
    ...(Array.isArray(mano.entregas) ? mano.entregas.map((entrega) => entrega?.carta) : []),
    mano.muestra,
    ...(Array.isArray(mano.restantes) ? mano.restantes : []),
  ];
  if (mano.entregas?.length !== jugadores.length * 3 || !esCarta(mano.muestra))
    throw new TypeError("Cartas de mano inválidas.");
  let esperada: ManoPreparada;
  try {
    esperada = prepararMano(mano.mesa, mano.repartidor, mazo as Carta[]);
  } catch {
    throw new TypeError("Cartas de mano inválidas.");
  }
  const campos: (keyof ManoPreparada)[] = [
    "mesa",
    "equipos",
    "repartidor",
    "manoOriginal",
    "equipoManoOriginal",
    "ordenReparto",
    "entregas",
    "manos",
    "muestra",
    "restantes",
    "salidaPrimeraBaza",
  ];
  if (campos.some((campo) => JSON.stringify(mano[campo]) !== JSON.stringify(esperada[campo])))
    throw new TypeError("Mano preparada estructuralmente incoherente.");
}

/** Crea un estado independiente de una mano preparada válida. */
export function iniciarJuegoCartas(mano: ManoPreparada): EstadoJuegoCartas {
  validarManoPreparada(mano);
  const canonica = prepararMano(mano.mesa, mano.repartidor, [
    ...mano.entregas.map((entrega) => entrega.carta),
    mano.muestra,
    ...mano.restantes,
  ]);
  return {
    mano: canonica,
    cartasDisponibles: canonica.manos.map(({ jugador, cartas }) => ({
      jugador,
      cartas: cartas.map(copiarCarta),
    })),
    bazaActual: { salida: canonica.manoOriginal, jugadas: [] },
    bazasCompletadas: [],
    jugadorTurno: canonica.manoOriginal,
    finalizada: false,
    equipoGanador: null,
  };
}

function ordenDesdeMano(mesa: Mesa, manoOriginal: string): string[] {
  return obtenerOrdenReparto(mesa, jugadorAnterior(mesa, manoOriginal));
}

/** Resuelve una baza completa; la política de participantes pertenece al estado de la mano. */
export function resolverBaza(
  mesa: Mesa,
  muestra: Carta,
  manoOriginal: string,
  baza: BazaEnCurso,
): ResultadoBaza {
  validarMesa(mesa);
  if (!esCarta(muestra) || !Array.isArray(baza?.jugadas) || typeof baza.salida !== "string")
    throw new TypeError("Baza inválida.");
  const jugadores = mesa.jugadores;
  if (baza.jugadas.length !== jugadores.length) throw new TypeError("La baza no está completa.");
  const ids = new Set<string>();
  for (const jugada of baza.jugadas) {
    if (
      !jugada ||
      !jugadores.some((jugador) => jugador.id === jugada.jugador) ||
      !esCarta(jugada.carta)
    )
      throw new TypeError("Jugada inválida.");
    if (identificarCarta(jugada.carta) === identificarCarta(muestra) || ids.has(jugada.jugador))
      throw new TypeError("Jugadas duplicadas o muestra inválida.");
    ids.add(jugada.jugador);
  }
  if (ids.size !== jugadores.length || !ids.has(baza.salida))
    throw new TypeError("Participantes inválidos.");
  const jerarquias = baza.jugadas.map((jugada) => obtenerJerarquia(jugada.carta, muestra));
  const mejorPorEquipo = new Map<string, number>();
  for (const [indice, jugada] of baza.jugadas.entries()) {
    const equipo = jugadores.find((jugador) => jugador.id === jugada.jugador)!.equipo;
    const anterior = mejorPorEquipo.get(equipo);
    if (anterior === undefined || jerarquias[indice] < anterior)
      mejorPorEquipo.set(equipo, jerarquias[indice]);
  }
  const [equipoA, equipoB] = [...new Set(jugadores.map((jugador) => jugador.equipo))];
  const fuerzaA = mejorPorEquipo.get(equipoA)!;
  const fuerzaB = mejorPorEquipo.get(equipoB)!;
  const equipoGanador = fuerzaA === fuerzaB ? null : fuerzaA < fuerzaB ? equipoA : equipoB;
  const jerarquiaMaxima = Math.min(fuerzaA, fuerzaB);
  const jugadoresMaximos = baza.jugadas
    .filter((_, indice) => jerarquias[indice] === jerarquiaMaxima)
    .filter(
      (jugada) =>
        equipoGanador === null ||
        jugadores.find((j) => j.id === jugada.jugador)!.equipo === equipoGanador,
    )
    .map((jugada) => jugada.jugador);
  const salidaSiguiente =
    equipoGanador === null
      ? manoOriginal
      : ordenDesdeMano(mesa, manoOriginal).find((jugador) => jugadoresMaximos.includes(jugador))!;
  return { equipoGanador, jerarquiaMaxima, jugadoresMaximos, salidaSiguiente };
}

/** Implementa exactamente las combinaciones completas y prefijos permitidos del Reglamento §5.2. */
export function evaluarResultadosBazas(
  equipos: readonly string[],
  equipoManoOriginal: string,
  resultados: readonly (string | null)[],
): ResultadoProgresivo {
  if (
    !Array.isArray(equipos) ||
    equipos.length !== 2 ||
    new Set(equipos).size !== 2 ||
    !equipos.includes(equipoManoOriginal)
  )
    throw new TypeError("Equipos inválidos.");
  if (
    !Array.isArray(resultados) ||
    resultados.length > 3 ||
    resultados.some((r) => r !== null && !equipos.includes(r))
  )
    throw new TypeError("Resultados de bazas inválidos.");
  if (resultados.length < 2) return { finalizada: false, debeAbrirBaza: true, equipoGanador: null };
  const [primera, segunda, tercera] = resultados;
  if (primera === null) {
    if (segunda !== null) {
      if (resultados.length === 3) throw new TypeError("Tercera baza innecesaria.");
      return { finalizada: true, debeAbrirBaza: false, equipoGanador: segunda };
    }
    if (resultados.length === 2)
      return { finalizada: false, debeAbrirBaza: true, equipoGanador: null };
    if (tercera === undefined) throw new TypeError("Tercera baza ausente.");
    return { finalizada: true, debeAbrirBaza: false, equipoGanador: tercera ?? equipoManoOriginal };
  }
  if (segunda === primera || segunda === null) {
    if (resultados.length === 3) throw new TypeError("Tercera baza innecesaria.");
    return { finalizada: true, debeAbrirBaza: false, equipoGanador: primera };
  }
  if (resultados.length === 2)
    return { finalizada: false, debeAbrirBaza: true, equipoGanador: null };
  if (tercera === undefined) throw new TypeError("Tercera baza ausente.");
  return { finalizada: true, debeAbrirBaza: false, equipoGanador: tercera ?? equipoManoOriginal };
}

function estadoBasicoValido(estado: EstadoJuegoCartas): boolean {
  try {
    validarManoPreparada(estado.mano);
    if (
      !Array.isArray(estado.cartasDisponibles) ||
      !Array.isArray(estado.bazasCompletadas) ||
      !Array.isArray(estado.bazaActual?.jugadas) ||
      estado.bazasCompletadas.length > 3
    )
      return false;
    const jugadores = estado.mano.mesa.jugadores.map((jugador) => jugador.id);
    const disponibles = new Map(
      estado.cartasDisponibles.map((mano) => [mano.jugador, mano.cartas]),
    );
    if (
      disponibles.size !== jugadores.length ||
      jugadores.some((jugador) => !disponibles.has(jugador))
    )
      return false;
    let salida = estado.mano.manoOriginal;
    const resultados: (string | null)[] = [];
    const jugadasHistoricas: JugadaCarta[] = [];
    for (const baza of estado.bazasCompletadas) {
      if (!baza || baza.salida !== salida) return false;
      const resultado = resolverBaza(
        estado.mano.mesa,
        estado.mano.muestra,
        estado.mano.manoOriginal,
        baza,
      );
      if (JSON.stringify(resultado) !== JSON.stringify(baza.resultado)) return false;
      resultados.push(resultado.equipoGanador);
      jugadasHistoricas.push(...baza.jugadas);
      const progreso = evaluarResultadosBazas(
        estado.mano.equipos,
        estado.mano.equipoManoOriginal,
        resultados,
      );
      if (progreso.finalizada && baza !== stateLast(estado.bazasCompletadas)) return false;
      salida = resultado.salidaSiguiente;
    }
    const progreso = evaluarResultadosBazas(
      estado.mano.equipos,
      estado.mano.equipoManoOriginal,
      resultados,
    );
    if (
      estado.finalizada !== progreso.finalizada ||
      estado.equipoGanador !== progreso.equipoGanador
    )
      return false;
    if (estado.finalizada)
      return estado.jugadorTurno === null && estado.bazaActual.jugadas.length === 0;
    if (estado.bazaActual.salida !== salida || estado.bazaActual.jugadas.length >= jugadores.length)
      return false;
    const orden = [
      salida,
      ...obtenerOrdenReparto(estado.mano.mesa, salida).slice(0, jugadores.length - 1),
    ];
    if (estado.bazaActual.jugadas.some((jugada, indice) => jugada.jugador !== orden[indice]))
      return false;
    jugadasHistoricas.push(...estado.bazaActual.jugadas);
    const originales = new Map(
      estado.mano.manos.map((mano) => [mano.jugador, mano.cartas.map(identificarCarta)]),
    );
    const usadas = new Map<string, Set<string>>();
    for (const jugada of jugadasHistoricas) {
      const originalesJugador = originales.get(jugada.jugador);
      const identidad = identificarCarta(jugada.carta);
      if (!originalesJugador?.includes(identidad) || usadas.get(jugada.jugador)?.has(identidad))
        return false;
      (
        usadas.get(jugada.jugador) ??
        (usadas.set(jugada.jugador, new Set()), usadas.get(jugada.jugador)!)
      ).add(identidad);
    }
    for (const jugador of jugadores) {
      const esperadas = originales
        .get(jugador)!
        .filter((carta) => !usadas.get(jugador)?.has(carta))
        .sort();
      const actuales = disponibles.get(jugador);
      if (
        !Array.isArray(actuales) ||
        actuales.some((carta) => !esCarta(carta)) ||
        actuales.map(identificarCarta).sort().join("|") !== esperadas.join("|")
      )
        return false;
    }
    return estado.jugadorTurno === orden[estado.bazaActual.jugadas.length];
  } catch {
    return false;
  }
}

function stateLast<T>(valores: readonly T[]): T | undefined {
  return valores[valores.length - 1];
}

/** Transición concreta de cartas. No admite acciones ajenas a este slice. */
export const ejecutarCarta: TransicionJuegoCartas = (estado, accion) => {
  if (!estadoBasicoValido(estado)) return rechazar("estado-invalido", "Estado de juego inválido.");
  if (estado.finalizada) return rechazar("mano-finalizada", "La mano ya finalizó.");
  if (!accion || accion.tipo !== "jugar-carta" || !esCarta(accion.carta))
    return rechazar("carta-invalida", "Acción o carta inválida.");
  const jugadorMesa = estado.mano.mesa.jugadores.find((jugador) => jugador.id === accion.jugador);
  if (!jugadorMesa) return rechazar("jugador-inexistente", "El jugador no pertenece a la mesa.");
  if (estado.jugadorTurno !== accion.jugador)
    return rechazar("fuera-de-turno", "No es el turno del jugador.");
  const manoJugador = estado.cartasDisponibles.find((mano) => mano.jugador === accion.jugador);
  const identidad = identificarCarta(accion.carta);
  if (!manoJugador || !manoJugador.cartas.some((carta) => identificarCarta(carta) === identidad))
    return rechazar("carta-no-disponible", "La carta no está disponible para el jugador.");
  const jugada: JugadaCarta = { jugador: accion.jugador, carta: copiarCarta(accion.carta) };
  const cartasDisponibles = estado.cartasDisponibles.map((mano) => ({
    jugador: mano.jugador,
    cartas:
      mano.jugador === accion.jugador
        ? mano.cartas.filter((carta) => identificarCarta(carta) !== identidad).map(copiarCarta)
        : mano.cartas.map(copiarCarta),
  }));
  const jugadas = [...estado.bazaActual.jugadas.map(copiarJugada), jugada];
  const eventos: EventoJuegoCartas[] = [{ tipo: "carta-jugada", jugada }];
  if (jugadas.length < estado.mano.mesa.jugadores.length) {
    const turno = obtenerOrdenReparto(estado.mano.mesa, estado.bazaActual.salida);
    const siguiente = turno[jugadas.length - 1];
    return {
      aceptada: true,
      estado: {
        ...estado,
        cartasDisponibles,
        bazaActual: { salida: estado.bazaActual.salida, jugadas },
        jugadorTurno: siguiente,
      },
      eventos,
    };
  }
  const resultado = resolverBaza(estado.mano.mesa, estado.mano.muestra, estado.mano.manoOriginal, {
    salida: estado.bazaActual.salida,
    jugadas,
  });
  const baza: BazaCompletada = { salida: estado.bazaActual.salida, jugadas, resultado };
  const bazasCompletadas = [...estado.bazasCompletadas, baza];
  const progreso = evaluarResultadosBazas(
    estado.mano.equipos,
    estado.mano.equipoManoOriginal,
    bazasCompletadas.map((b) => b.resultado.equipoGanador),
  );
  eventos.push({ tipo: "baza-resuelta", baza });
  if (progreso.finalizada) {
    eventos.push({ tipo: "mano-decidida-por-bazas", equipo: progreso.equipoGanador! });
    return {
      aceptada: true,
      estado: {
        ...estado,
        cartasDisponibles,
        bazaActual: { salida: estado.bazaActual.salida, jugadas: [] },
        bazasCompletadas,
        jugadorTurno: null,
        finalizada: true,
        equipoGanador: progreso.equipoGanador,
      },
      eventos,
    };
  }
  return {
    aceptada: true,
    estado: {
      ...estado,
      cartasDisponibles,
      bazaActual: { salida: resultado.salidaSiguiente, jugadas: [] },
      bazasCompletadas,
      jugadorTurno: resultado.salidaSiguiente,
      finalizada: false,
      equipoGanador: null,
    },
    eventos,
  };
};
