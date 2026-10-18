import type { Carta, Palo, ValorNominal } from "@truco/shared";

export type { Carta, Palo, ValorNominal } from "@truco/shared";

/** Orden estable de construcción; no representa el orden de reparto. */
export const PALOS = Object.freeze([
  "oro",
  "copa",
  "espada",
  "basto",
] as const satisfies readonly Palo[]);
export const VALORES_NOMINALES = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 10, 11, 12,
] as const satisfies readonly ValorNominal[]);

type ValorPieza = 2 | 4 | 5 | 11 | 10;
export type Pieza = Readonly<{
  valorRepresentado: ValorPieza;
  jerarquia: 1 | 2 | 3 | 4 | 5;
  valorEspecial: 30 | 29 | 28 | 27;
  alcahuete: boolean;
}>;

const PIEZAS: Readonly<Record<ValorPieza, Readonly<Pick<Pieza, "jerarquia" | "valorEspecial">>>> =
  Object.freeze({
    2: Object.freeze({ jerarquia: 1, valorEspecial: 30 }),
    4: Object.freeze({ jerarquia: 2, valorEspecial: 29 }),
    5: Object.freeze({ jerarquia: 3, valorEspecial: 28 }),
    11: Object.freeze({ jerarquia: 4, valorEspecial: 27 }),
    10: Object.freeze({ jerarquia: 5, valorEspecial: 27 }),
  });

function esValorPieza(valor: ValorNominal): valor is ValorPieza {
  return Object.hasOwn(PIEZAS, valor);
}

/** Acepta datos externos sin asumir que hayan pasado por TypeScript. */
export function esCarta(valor: unknown): valor is Carta {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return false;
  const carta = valor as { palo?: unknown; valor?: unknown };
  return (
    (PALOS as readonly unknown[]).includes(carta.palo) &&
    (VALORES_NOMINALES as readonly unknown[]).includes(carta.valor)
  );
}

function exigirCarta(valor: unknown): asserts valor is Carta {
  if (!esCarta(valor))
    throw new TypeError("Carta inválida: se requiere palo singular y valor nominal permitido.");
}

/** Identidad estable independiente del orden de propiedades del objeto. */
export function identificarCarta(carta: Carta): string {
  exigirCarta(carta);
  return `${carta.palo}:${carta.valor}`;
}

export function crearMazo(): Carta[] {
  return PALOS.flatMap((palo) => VALORES_NOMINALES.map((valor) => ({ palo, valor })));
}

/** Rechaza datos inválidos; no modifica la colección recibida. */
export function hayCartasDuplicadas(cartas: readonly Carta[]): boolean {
  if (!Array.isArray(cartas)) throw new TypeError("Se requiere una lista de cartas válida.");
  const identidades = new Set<string>();
  let duplicada = false;
  for (const carta of cartas) {
    const identidad = identificarCarta(carta);
    if (identidades.has(identidad)) duplicada = true;
    identidades.add(identidad);
  }
  return duplicada;
}

export function esMazoCompleto(valor: unknown): valor is readonly Carta[] {
  return (
    Array.isArray(valor) &&
    valor.length === PALOS.length * VALORES_NOMINALES.length &&
    Array.from(valor).every(esCarta) &&
    !hayCartasDuplicadas(valor)
  );
}

export const esMuestra = esCarta;

export function obtenerPaloMuestra(muestra: Carta): Palo {
  exigirCarta(muestra);
  return muestra.palo;
}

export function muestraEsPiezaPotencial(muestra: Carta): boolean {
  exigirCarta(muestra);
  return esValorPieza(muestra.valor);
}

/** No admite cartas inválidas, repetidas ni la carta expuesta como muestra. */
export function sonCartasDisponibles(muestra: Carta, cartas: unknown): cartas is readonly Carta[] {
  exigirCarta(muestra);
  if (!Array.isArray(cartas) || !Array.from(cartas).every(esCarta) || hayCartasDuplicadas(cartas))
    return false;
  const idMuestra = identificarCarta(muestra);
  return cartas.every((carta) => identificarCarta(carta) !== idMuestra);
}

function exigirCartaDisponible(carta: Carta, muestra: Carta): void {
  exigirCarta(carta);
  exigirCarta(muestra);
  if (identificarCarta(carta) === identificarCarta(muestra))
    throw new TypeError("La muestra no está disponible como carta de jugador.");
}

/** Devuelve la pieza representada, o null para una carta ordinaria. */
export function obtenerPieza(carta: Carta, muestra: Carta): Pieza | null {
  exigirCartaDisponible(carta, muestra);
  if (carta.palo !== muestra.palo) return null;
  const alcahuete = carta.valor === 12 && esValorPieza(muestra.valor);
  const valorRepresentado = alcahuete ? muestra.valor : carta.valor;
  if (!esValorPieza(valorRepresentado)) return null;
  return { valorRepresentado, ...PIEZAS[valorRepresentado], alcahuete };
}

export function esPieza(carta: Carta, muestra: Carta): boolean {
  return obtenerPieza(carta, muestra) !== null;
}

/** Categorías del Reglamento §4: 1 es la más fuerte y 19 la más débil. */
export function obtenerJerarquia(carta: Carta, muestra: Carta): number {
  const pieza = obtenerPieza(carta, muestra);
  if (pieza) return pieza.jerarquia;
  switch (carta.valor) {
    case 1:
      if (carta.palo === "espada") return 6;
      if (carta.palo === "basto") return 7;
      return 12;
    case 7:
      if (carta.palo === "espada") return 8;
      if (carta.palo === "oro") return 9;
      return 16;
    case 3:
      return 10;
    case 2:
      return 11;
    case 12:
      return 13;
    case 11:
      return 14;
    case 10:
      return 15;
    case 6:
      return 17;
    case 5:
      return 18;
    case 4:
      return 19;
  }
}

/** 1: primera más fuerte; -1: segunda más fuerte; 0: misma fuerza. */
export function compararCartas(primera: Carta, segunda: Carta, muestra: Carta): -1 | 0 | 1 {
  const diferencia = obtenerJerarquia(segunda, muestra) - obtenerJerarquia(primera, muestra);
  return diferencia > 0 ? 1 : diferencia < 0 ? -1 : 0;
}

/** Valor individual para futuros cálculos; no calcula Envido ni Flor. */
export function obtenerValorIndividual(carta: Carta, muestra: Carta): number {
  const pieza = obtenerPieza(carta, muestra);
  return pieza ? pieza.valorEspecial : carta.valor <= 7 ? carta.valor : 0;
}
