import type { Carta, Modalidad } from "@truco/shared";
import { esMazoCompleto } from "./cartas.js";

export type JugadorMesa = Readonly<{ id: string; equipo: string; posicion: number }>;
/** Las posiciones 0..n-1 avanzan en sentido antihorario. */
export type Mesa = Readonly<{ modalidad: Modalidad; jugadores: readonly JugadorMesa[] }>;
export type Entrega = Readonly<{ jugador: string; carta: Carta }>;
export type ManoJugador = Readonly<{ jugador: string; cartas: readonly Carta[] }>;
export type ManoPreparada = Readonly<{
  mesa: Mesa;
  equipos: readonly string[];
  repartidor: string;
  manoOriginal: string;
  equipoManoOriginal: string;
  ordenReparto: readonly string[];
  entregas: readonly Entrega[];
  manos: readonly ManoJugador[];
  muestra: Carta;
  restantes: readonly Carta[];
  salidaPrimeraBaza: string;
}>;

/** Valida también datos que llegan de JavaScript u otras fuentes externas. */
export function validarMesa(mesa: Mesa): void {
  if (!mesa || (mesa.modalidad !== "1v1" && mesa.modalidad !== "2v2"))
    throw new TypeError("Modalidad inválida.");
  const cantidad = mesa.modalidad === "1v1" ? 2 : 4;
  if (!Array.isArray(mesa.jugadores) || mesa.jugadores.length !== cantidad)
    throw new TypeError("Cantidad de jugadores inválida.");
  const ids = new Set<string>();
  const posiciones = new Set<number>();
  const equipos = new Map<string, number>();
  for (const jugador of mesa.jugadores) {
    if (
      !jugador ||
      typeof jugador.id !== "string" ||
      !jugador.id.trim() ||
      typeof jugador.equipo !== "string" ||
      !jugador.equipo.trim() ||
      !Number.isInteger(jugador.posicion) ||
      jugador.posicion < 0 ||
      jugador.posicion >= cantidad ||
      ids.has(jugador.id) ||
      posiciones.has(jugador.posicion)
    )
      throw new TypeError("Jugador o posición inválidos o duplicados.");
    ids.add(jugador.id);
    posiciones.add(jugador.posicion);
    equipos.set(jugador.equipo, (equipos.get(jugador.equipo) ?? 0) + 1);
  }
  if (equipos.size !== 2 || [...equipos.values()].some((n) => n !== cantidad / 2))
    throw new TypeError("Equipos inválidos.");
  const orden = [...mesa.jugadores].sort((a, b) => a.posicion - b.posicion);
  if (orden.some((jugador, i) => jugador.equipo === orden[(i + 1) % cantidad].equipo))
    throw new TypeError("Los equipos deben alternarse.");
}

function ordenados(mesa: Mesa): JugadorMesa[] {
  validarMesa(mesa);
  return [...mesa.jugadores].sort((a, b) => a.posicion - b.posicion);
}

function indiceJugador(jugadores: readonly JugadorMesa[], id: string): number {
  const indice = jugadores.findIndex((jugador) => jugador.id === id);
  if (indice < 0) throw new TypeError("El jugador no pertenece a la mesa.");
  return indice;
}

export function siguienteJugador(mesa: Mesa, jugador: string): string {
  const orden = ordenados(mesa);
  return orden[(indiceJugador(orden, jugador) + 1) % orden.length].id;
}

export function jugadorAnterior(mesa: Mesa, jugador: string): string {
  const orden = ordenados(mesa);
  return orden[(indiceJugador(orden, jugador) + orden.length - 1) % orden.length].id;
}

export const siguienteRepartidor = siguienteJugador;
export const obtenerManoOriginal = siguienteJugador;

export function obtenerEquipoManoOriginal(mesa: Mesa, repartidor: string): string {
  const mano = obtenerManoOriginal(mesa, repartidor);
  return ordenados(mesa)[indiceJugador(ordenados(mesa), mano)].equipo;
}

export function obtenerOrdenReparto(mesa: Mesa, repartidor: string): string[] {
  const orden = ordenados(mesa);
  const inicio = (indiceJugador(orden, repartidor) + 1) % orden.length;
  return orden.map((_, i) => orden[(inicio + i) % orden.length].id);
}

/** Índice uniforme externo entre 0 y cantidad de jugadores menos uno. */
export function seleccionarPrimerRepartidor(mesa: Mesa, eleccion: number): string {
  const orden = ordenados(mesa);
  if (!Number.isInteger(eleccion) || eleccion < 0 || eleccion >= orden.length)
    throw new TypeError("Elección de repartidor inválida.");
  return orden[eleccion].id;
}

/** Fisher–Yates: 39 índices externos para límites inclusivos 39, 38, ..., 1. */
export function barajarMazo(mazo: readonly Carta[], elecciones: readonly number[]): Carta[] {
  if (!esMazoCompleto(mazo)) throw new TypeError("Se requiere un mazo completo.");
  if (!Array.isArray(elecciones) || elecciones.length !== 39)
    throw new TypeError("Se requieren 39 elecciones.");
  const resultado = mazo.map(({ palo, valor }) => ({ palo, valor }));
  for (let i = 39; i > 0; i--) {
    const j = elecciones[39 - i];
    if (!Number.isInteger(j) || j < 0 || j > i) throw new TypeError("Elección inválida.");
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }
  return resultado;
}

/** Consume el mazo en orden: tres vueltas, muestra y remanente. */
export function prepararMano(
  mesa: Mesa,
  repartidor: string,
  mazo: readonly Carta[],
): ManoPreparada {
  const jugadores = ordenados(mesa);
  const ordenReparto = obtenerOrdenReparto(mesa, repartidor);
  if (!esMazoCompleto(mazo)) throw new TypeError("Se requiere un mazo completo.");
  const cartas = mazo.map(({ palo, valor }) => ({ palo, valor }));
  const manos: { jugador: string; cartas: Carta[] }[] = jugadores.map(({ id }) => ({
    jugador: id,
    cartas: [],
  }));
  const entregas: Entrega[] = [];
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    for (const jugador of ordenReparto) {
      const carta = cartas[entregas.length];
      manos[indiceJugador(jugadores, jugador)].cartas.push(carta);
      entregas.push({ jugador, carta });
    }
  }
  const manoOriginal = ordenReparto[0];
  return {
    mesa: { modalidad: mesa.modalidad, jugadores: jugadores.map((jugador) => ({ ...jugador })) },
    equipos: [...new Set(jugadores.map(({ equipo }) => equipo))],
    repartidor,
    manoOriginal,
    equipoManoOriginal: obtenerEquipoManoOriginal(mesa, repartidor),
    ordenReparto,
    entregas,
    manos,
    muestra: cartas[entregas.length],
    restantes: cartas.slice(entregas.length + 1),
    salidaPrimeraBaza: manoOriginal,
  };
}
