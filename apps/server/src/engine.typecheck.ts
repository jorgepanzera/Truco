import type { ResultadoTransicion, Transicion } from "@truco/game-engine";

export type ContratosMotor = [
  ResultadoTransicion<unknown, unknown, object>,
  Transicion<unknown, unknown, unknown, unknown, object>,
];
