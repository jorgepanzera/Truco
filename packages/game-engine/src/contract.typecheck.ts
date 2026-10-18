import type { ResultadoTransicion } from "./index.js";

// @ts-expect-error El rechazo debe ser estructurado, no un texto suelto.
export type RechazoNoEstructurado = ResultadoTransicion<unknown, unknown, string>;
