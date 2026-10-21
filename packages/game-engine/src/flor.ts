import type { Carta } from "@truco/shared";
import {
  identificarCarta,
  obtenerPieza,
  obtenerValorIndividual,
  sonCartasDisponibles,
} from "./cartas.js";

export type TantoFlor = Readonly<{ tieneFlor: boolean; tanto: number | null }>;
export type AnuncioFlor = Readonly<{ jugador: string; equipo: string }>;
export type DesafioFlor = "contra-flor" | "contra-flor-al-resto";
export type EstadoFlorDominio = Readonly<{
  anuncios: readonly AnuncioFlor[];
  derechosPerdidos: readonly string[];
  pendiente: Readonly<{
    tipo: DesafioFlor;
    proponente: string;
    equipoProponente: string;
    equipoRespondedor: string;
  }> | null;
  cerrado: boolean;
  adjudicaciones: readonly Readonly<{
    equipo: string;
    puntos: number;
    motivo: "sin-desafio" | "rechazo" | "aceptacion" | "al-resto";
  }>[];
  historialDesafios: readonly Readonly<{
    tipo: "contra-flor";
    proponente: string;
    equipo: string;
    respuesta: "quiero" | "no-quiero" | null;
  }>[];
}>;
export const crearEstadoFlor = (): EstadoFlorDominio => ({
  anuncios: [],
  derechosPerdidos: [],
  pendiente: null,
  cerrado: false,
  adjudicaciones: [],
  historialDesafios: [],
});

export function calcularTantoFlor(cartas: readonly Carta[], muestra: Carta): TantoFlor {
  if (!Array.isArray(cartas) || cartas.length !== 3 || !sonCartasDisponibles(muestra, cartas))
    throw new TypeError("Mano de Flor inválida.");
  const piezas = cartas.filter((c) => obtenerPieza(c, muestra) !== null);
  const ordinarias = cartas.filter((c) => obtenerPieza(c, muestra) === null);
  const tieneFlor =
    new Set(cartas.map((c) => c.palo)).size === 1 ||
    piezas.length >= 2 ||
    (piezas.length === 1 && new Set(ordinarias.map((c) => c.palo)).size === 1);
  if (!tieneFlor) return { tieneFlor: false, tanto: null };
  if (!piezas.length)
    return {
      tieneFlor: true,
      tanto: 20 + cartas.reduce((s, c) => s + obtenerValorIndividual(c, muestra), 0),
    };
  const valores = piezas.map((c) => obtenerValorIndividual(c, muestra)).sort((a, b) => b - a);
  return {
    tieneFlor: true,
    tanto:
      valores[0] +
      valores.slice(1).reduce((s, v) => s + v - 20, 0) +
      ordinarias.reduce((s, c) => s + obtenerValorIndividual(c, muestra), 0),
  };
}
export function tieneFlorCalculada(cartas: readonly Carta[], muestra: Carta): boolean {
  return calcularTantoFlor(cartas, muestra).tieneFlor;
}
export function identificarFlor(cartas: readonly Carta[]): string[] {
  return cartas.map(identificarCarta);
}

export type ContextoFlor = Readonly<{
  jugadores: readonly Readonly<{
    id: string;
    equipo: string;
    cartas: readonly Carta[];
    jugoPrimeraCarta: boolean;
  }>[];
  muestra: Carta;
  jugadorTurno: string | null;
}>;
export type ResultadoFlor =
  | Readonly<{
      aceptada: true;
      estado: EstadoFlorDominio;
      eventos: readonly Readonly<{ tipo: string; jugador?: string }>[];
    }>
  | Readonly<{ aceptada: false; codigo: string }>;
const fallo = (codigo: string): ResultadoFlor => ({ aceptada: false, codigo });
export type EventoDesafioFlor = Readonly<{
  tipo: "contra-flor-propuesta" | "contra-flor-aceptada" | "contra-flor-rechazada";
  jugador: string;
}>;
export function proponerContraFlor(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
):
  | ResultadoFlor
  | Readonly<{ aceptada: true; estado: EstadoFlorDominio; eventos: readonly EventoDesafioFlor[] }> {
  const p = contexto.jugadores.find((j) => j.id === jugador);
  if (
    !p ||
    estado.pendiente ||
    estado.historialDesafios.length ||
    !estado.anuncios.some((a) => a.equipo === p.equipo) ||
    !estado.anuncios.some((a) => a.equipo !== p.equipo)
  )
    return fallo("contra-flor-invalida");
  const receptor = contexto.jugadores.find((j) => j.equipo !== p.equipo)?.equipo;
  if (!receptor) return fallo("contra-flor-invalida");
  return {
    aceptada: true,
    estado: {
      ...estado,
      pendiente: {
        tipo: "contra-flor",
        proponente: jugador,
        equipoProponente: p.equipo,
        equipoRespondedor: receptor,
      },
    },
    eventos: [{ tipo: "contra-flor-propuesta", jugador }],
  };
}
export function responderContraFlor(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
  respuesta: "quiero" | "no-quiero",
):
  | ResultadoFlor
  | Readonly<{ aceptada: true; estado: EstadoFlorDominio; eventos: readonly EventoDesafioFlor[] }> {
  const p = contexto.jugadores.find((j) => j.id === jugador),
    desafio = estado.pendiente;
  if (!p || !desafio || desafio.tipo !== "contra-flor" || p.equipo !== desafio.equipoRespondedor)
    return fallo("respuesta-contra-flor-invalida");
  const perdidos =
    respuesta === "no-quiero"
      ? [
          ...new Set([
            ...estado.derechosPerdidos,
            ...derechos(contexto, estado).filter(
              (id) => contexto.jugadores.find((j) => j.id === id)?.equipo === p.equipo,
            ),
          ]),
        ]
      : estado.derechosPerdidos;
  return {
    aceptada: true,
    estado: {
      ...estado,
      pendiente: null,
      derechosPerdidos: perdidos,
      historialDesafios: [
        ...estado.historialDesafios,
        {
          tipo: "contra-flor",
          proponente: desafio.proponente,
          equipo: desafio.equipoProponente,
          respuesta,
        },
      ],
    },
    eventos: [
      { tipo: respuesta === "quiero" ? "contra-flor-aceptada" : "contra-flor-rechazada", jugador },
    ],
  };
}
function derechos(contexto: ContextoFlor, estado: EstadoFlorDominio): string[] {
  return contexto.jugadores
    .filter(
      (j) =>
        tieneFlorCalculada(j.cartas, contexto.muestra) &&
        !j.jugoPrimeraCarta &&
        !estado.anuncios.some((a) => a.jugador === j.id) &&
        !estado.derechosPerdidos.includes(j.id),
    )
    .map((j) => j.id);
}
function cerrar(estado: EstadoFlorDominio, contexto: ContextoFlor): EstadoFlorDominio {
  return derechos(contexto, estado).length === 0 ? { ...estado, cerrado: true } : estado;
}
export function anunciarFlor(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
): ResultadoFlor {
  if (!estado || estado.cerrado) return fallo("fase-cerrada");
  const participante = contexto.jugadores.find((j) => j.id === jugador);
  if (!participante || !tieneFlorCalculada(participante.cartas, contexto.muestra))
    return fallo("flor-inexistente");
  if (estado.anuncios.some((a) => a.jugador === jugador)) return fallo("flor-duplicada");
  if (estado.derechosPerdidos.includes(jugador) || participante.jugoPrimeraCarta)
    return fallo("derecho-perdido");
  if (estado.anuncios.length === 0 && contexto.jugadorTurno !== jugador)
    return fallo("primer-anuncio-fuera-de-turno");
  const siguiente = cerrar(
    { ...estado, anuncios: [...estado.anuncios, { jugador, equipo: participante.equipo }] },
    contexto,
  );
  return {
    aceptada: true,
    estado: siguiente,
    eventos: [
      { tipo: "flor-anunciada", jugador },
      ...(siguiente.cerrado ? [{ tipo: "fase-flor-cerrada" as const }] : []),
    ],
  };
}
export function perderDerechoFlor(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
): ResultadoFlor {
  const participante = contexto.jugadores.find((j) => j.id === jugador);
  if (
    !participante ||
    !tieneFlorCalculada(participante.cartas, contexto.muestra) ||
    estado.anuncios.some((a) => a.jugador === jugador) ||
    estado.derechosPerdidos.includes(jugador)
  )
    return fallo("derecho-no-perdible");
  const siguiente = cerrar(
    { ...estado, derechosPerdidos: [...estado.derechosPerdidos, jugador] },
    contexto,
  );
  return {
    aceptada: true,
    estado: siguiente,
    eventos: [
      { tipo: "derecho-flor-perdido", jugador },
      ...(siguiente.cerrado ? [{ tipo: "fase-flor-cerrada" as const }] : []),
    ],
  };
}
