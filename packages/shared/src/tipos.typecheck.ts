import type { Carta, MetaPuntos, Modalidad, Palo, ValorNominal } from "./index.js";

type Igual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Afirmar<T extends true> = T;

export type Verificaciones = [
  Afirmar<Igual<Palo, "oros" | "copas" | "espadas" | "bastos">>,
  Afirmar<Igual<ValorNominal, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12>>,
  Afirmar<Igual<Modalidad, "1v1" | "2v2">>,
  Afirmar<Igual<MetaPuntos, 30 | 40>>,
  Afirmar<Igual<Carta, Readonly<{ palo: Palo; valor: ValorNominal }>>>,
];

// @ts-expect-error El 8 no existe en la baraja de 40 cartas.
export type ValorInvalido = Afirmar<8 extends ValorNominal ? true : false>;
// @ts-expect-error El 9 no existe en la baraja de 40 cartas.
export type OtroValorInvalido = Afirmar<9 extends ValorNominal ? true : false>;
// @ts-expect-error Un palo ajeno a la baraja española no es válido.
export type PaloInvalido = Afirmar<"treboles" extends Palo ? true : false>;
// @ts-expect-error No se admite la modalidad 3v3.
export type ModalidadInvalida = Afirmar<"3v3" extends Modalidad ? true : false>;
// @ts-expect-error La meta 50 no está permitida.
export type MetaInvalida = Afirmar<50 extends MetaPuntos ? true : false>;
// @ts-expect-error Una carta requiere palo y valor válidos.
export type CartaInvalida = Afirmar<{ palo: "oros"; valor: 8 } extends Carta ? true : false>;
