import type { Carta, Palo } from "./index.js";

export const cartasTipadas: readonly Carta[] = [
  { palo: "oro", valor: 1 },
  { palo: "copa", valor: 7 },
  { palo: "espada", valor: 11 },
  { palo: "basto", valor: 12 },
];
// @ts-expect-error Los plurales no son palos técnicos válidos.
export const oroPlural: Palo = "oros";
// @ts-expect-error Los plurales no son palos técnicos válidos.
export const copaPlural: Palo = "copas";
// @ts-expect-error Los plurales no son palos técnicos válidos.
export const espadaPlural: Palo = "espadas";
// @ts-expect-error Los plurales no son palos técnicos válidos.
export const bastoPlural: Palo = "bastos";
// @ts-expect-error La baraja española de 40 cartas no tiene ochos.
export const cartaInvalida: Carta = { palo: "oro", valor: 8 };
