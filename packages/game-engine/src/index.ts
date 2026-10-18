import { sharedPackage } from "@truco/shared";

// Infraestructura de compilación; no representa comportamiento de juego.
export const engineDependencies = [sharedPackage] as const;

/** Resultado conceptual; los tipos concretos se definirán en la Etapa 2. */
export type ResultadoTransicion<Estado, Evento, Rechazo extends object> =
  | { readonly aceptada: true; readonly estado: Estado; readonly eventos: readonly Evento[] }
  | { readonly aceptada: false; readonly rechazo: Rechazo };

/**
 * Contrato de una transición pura: las entradas externas son datos explícitos.
 * La implementación futura no debe mutar las entradas ni producir efectos externos.
 */
export type Transicion<Estado, Accion, Entradas, Evento, Rechazo extends object> = (
  estado: Estado,
  accion: Accion,
  entradas: Entradas,
) => ResultadoTransicion<Estado, Evento, Rechazo>;
