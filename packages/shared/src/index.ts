// Punto de entrada provisional para comprobar la conexión entre workspaces.
export const sharedPackage = "@truco/shared" as const;

/** Palos de la baraja española de 40 cartas (Reglamento §2.2). */
export type Palo = "oro" | "copa" | "espada" | "basto";

/** Número impreso en la carta, sin relación con su fuerza o valor de canto. */
export type ValorNominal = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

/** Identidad de una carta por palo y número impreso. */
export type Carta = Readonly<{
  palo: Palo;
  valor: ValorNominal;
}>;

/** Modalidades de participantes (Reglamento §2.1). */
export type Modalidad = "1v1" | "2v2";

/** Objetivos de puntuación configurables (Reglamento §10.1). */
export type MetaPuntos = 30 | 40;
