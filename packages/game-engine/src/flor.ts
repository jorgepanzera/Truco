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
    tipo: DesafioFlor;
    proponente: string;
    equipo: string;
    respuesta:
      "quiero" | "no-quiero" | "cancelado-por-retiro" | "rechazo-implicito-por-retiro" | null;
  }>[];
  oportunidadDesafioConsumida: boolean;
  resultadoTerminal: Readonly<{ tipo: "contra-flor-al-resto-ganada"; equipo: string }> | null;
}>;
export const crearEstadoFlor = (): EstadoFlorDominio => ({
  anuncios: [],
  derechosPerdidos: [],
  pendiente: null,
  cerrado: false,
  adjudicaciones: [],
  historialDesafios: [],
  oportunidadDesafioConsumida: false,
  resultadoTerminal: null,
});
/** Valida la estructura de Flor contra las cartas y participantes canónicos. */
export function esEstadoFlorValido(estado: EstadoFlorDominio, contexto: ContextoFlor): boolean {
  return contextoCoherente(contexto) && estadoCoherente(estado, contexto);
}
export function hayDerechosFlor(estado: EstadoFlorDominio, contexto: ContextoFlor): boolean {
  return esEstadoFlorValido(estado, contexto) && derechos(contexto, estado).length > 0;
}
export function consumirOportunidadDesafioFlor(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
): ResultadoFlor {
  if (!esEstadoFlorValido(estado, contexto)) return fallo("estado-flor-incoherente");
  if (
    estado.oportunidadDesafioConsumida ||
    estado.pendiente ||
    new Set(estado.anuncios.map((anuncio) => anuncio.equipo)).size < 2
  )
    return fallo("oportunidad-desafio-no-consumible");
  return { aceptada: true, estado: { ...estado, oportunidadDesafioConsumida: true }, eventos: [] };
}
export function confirmarFaseFlor(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
): ResultadoFlor {
  if (!esEstadoFlorValido(estado, contexto) || !contexto.faseFlorConfirmada)
    return fallo("fase-flor-no-confirmable");
  const cierre = cerrar(estado, contexto);
  return cierre.estado === estado
    ? fallo("fase-flor-no-confirmable")
    : { aceptada: true, estado: cierre.estado, eventos: cierre.eventos };
}

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

/** Liquidaciones de Flor causadas por retiro, separadas de Quiero/No quiero. */
export type LiquidacionFlorPorRetiro = Readonly<{
  causa:
    | "rechazo-implicito-por-retiro"
    | "propuesta-cancelada-por-retiro"
    | "apuesta-aceptada-perdida-por-retiro"
    | "liquidacion-ordinaria-por-retiro";
  equipo: string;
  puntos: number;
}>;
export function esLiquidacionFlorPorRetiroValida(
  liquidacion: LiquidacionFlorPorRetiro,
  contexto: ContextoFlor,
): boolean {
  return (
    !!liquidacion &&
    [
      "rechazo-implicito-por-retiro",
      "propuesta-cancelada-por-retiro",
      "apuesta-aceptada-perdida-por-retiro",
      "liquidacion-ordinaria-por-retiro",
    ].includes(liquidacion.causa) &&
    contexto.jugadores.some((jugador) => jugador.equipo === liquidacion.equipo) &&
    Number.isInteger(liquidacion.puntos) &&
    liquidacion.puntos >= 0
  );
}

/** Liquida un desafío pendiente por retiro sin fingir una respuesta voluntaria. */
export function liquidarFlorPorRetiro(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugadorRetirado: string,
): ResultadoFlor {
  if (!esEstadoFlorValido(estado, contexto)) return fallo("estado-flor-incoherente");
  const desafio = estado.pendiente;
  const retirado = contexto.jugadores.find((jugador) => jugador.id === jugadorRetirado);
  if (!retirado) return fallo("retiro-flor-inaplicable");
  if (!desafio) {
    if (estado.cerrado || estado.adjudicaciones.length || !estado.anuncios.length)
      return fallo("retiro-flor-inaplicable");
    const equipos = [...new Set(contexto.jugadores.map((jugador) => jugador.equipo))];
    const adjudicaciones = equipos.map((equipo) => ({
      equipo,
      puntos: estado.anuncios.filter((anuncio) => anuncio.equipo === equipo).length * 3,
      motivo: "sin-desafio" as const,
    }));
    return {
      aceptada: true,
      estado: {
        ...estado,
        cerrado: true,
        derechosPerdidos: [...new Set([...estado.derechosPerdidos, ...derechos(contexto, estado)])],
        oportunidadDesafioConsumida:
          new Set(estado.anuncios.map((anuncio) => anuncio.equipo)).size === 2,
        adjudicaciones,
      },
      eventos: [{ tipo: "flor-adjudicada", adjudicaciones }],
    };
  }
  const retiroYaAplicado = retirado.activa === false;
  const puedeSostener = (equipo: string) =>
    contexto.jugadores.some(
      (jugador) =>
        jugador.equipo === equipo &&
        (jugador.activa ?? true) &&
        tieneFlorCalculada(jugador.cartas, contexto.muestra) &&
        (estado.anuncios.some((anuncio) => anuncio.jugador === jugador.id) ||
          (!jugador.jugoPrimeraCarta && !estado.derechosPerdidos.includes(jugador.id))),
    );
  if (
    retiroYaAplicado &&
    puedeSostener(desafio.equipoProponente) &&
    puedeSostener(desafio.equipoRespondedor)
  )
    return { aceptada: true, estado, eventos: [] };
  const esProponente = retirado.equipo === desafio.equipoProponente;
  if (retiroYaAplicado && esProponente && puedeSostener(desafio.equipoProponente))
    return { aceptada: true, estado, eventos: [] };
  if (retiroYaAplicado && !esProponente && puedeSostener(desafio.equipoRespondedor))
    return { aceptada: true, estado, eventos: [] };
  const causa: "cancelado-por-retiro" | "rechazo-implicito-por-retiro" = esProponente
    ? "cancelado-por-retiro"
    : "rechazo-implicito-por-retiro";
  const historial =
    desafio.tipo === "contra-flor-al-resto"
      ? estado.historialDesafios.map((registro) =>
          registro.respuesta === null ? { ...registro, respuesta: causa } : registro,
        )
      : [
          ...estado.historialDesafios,
          {
            tipo: desafio.tipo,
            proponente: desafio.proponente,
            equipo: desafio.equipoProponente,
            respuesta: causa,
          },
        ];
  const equipos = [...new Set(contexto.jugadores.map((jugador) => jugador.equipo))];
  const adjudicaciones = equipos.map((equipo) => ({
    equipo,
    puntos: esProponente
      ? estado.anuncios.filter((anuncio) => anuncio.equipo === equipo && equipo !== retirado.equipo)
          .length * 3
      : equipo === desafio.equipoProponente
        ? estado.anuncios.filter((anuncio) => anuncio.equipo === equipo).length * 3
        : 0,
    motivo: esProponente ? ("sin-desafio" as const) : ("rechazo" as const),
  }));
  return {
    aceptada: true,
    estado: {
      ...estado,
      pendiente: null,
      cerrado: true,
      historialDesafios: historial,
      adjudicaciones,
      resultadoTerminal: null,
    },
    eventos: [
      {
        tipo: esProponente
          ? "contra-flor-cancelada-por-retiro"
          : "contra-flor-rechazo-implicito-por-retiro",
        jugador: jugadorRetirado,
      },
    ],
  };
}

export type ContextoFlor = Readonly<{
  jugadores: readonly Readonly<{
    id: string;
    equipo: string;
    cartas: readonly Carta[];
    jugoPrimeraCarta: boolean;
    /** Un retirado conserva su historial, pero no derechos ni capacidad de responder. */
    activa?: boolean;
  }>[];
  muestra: Carta;
  jugadorTurno: string | null;
  /** Orden antihorario desde el mano original. */
  ordenMano: readonly string[];
  desempate: boolean;
  /** Confirmación derivada por coordinación de que no queda oportunidad reglamentaria de desafío. */
  faseFlorConfirmada: boolean;
}>;
export type ResultadoFlor =
  | Readonly<{
      aceptada: true;
      estado: EstadoFlorDominio;
      eventos: readonly Readonly<{
        tipo: string;
        jugador?: string;
        adjudicaciones?: EstadoFlorDominio["adjudicaciones"];
      }>[];
    }>
  | Readonly<{ aceptada: false; codigo: string }>;
const fallo = (codigo: string): ResultadoFlor => ({ aceptada: false, codigo });
export type EventoDesafioFlor = Readonly<{
  tipo:
    | "contra-flor-propuesta"
    | "contra-flor-aceptada"
    | "contra-flor-rechazada"
    | "contra-flor-al-resto-propuesta"
    | "contra-flor-al-resto-aceptada"
    | "contra-flor-al-resto-rechazada";
  jugador: string;
}>;
export function proponerContraFlor(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
):
  | ResultadoFlor
  | Readonly<{ aceptada: true; estado: EstadoFlorDominio; eventos: readonly EventoDesafioFlor[] }> {
  if (!estadoCoherente(estado, contexto) || !contextoCoherente(contexto))
    return fallo("estado-flor-incoherente");
  const p = contexto.jugadores.find((j) => j.id === jugador);
  if (
    !p ||
    !(p.activa ?? true) ||
    estado.adjudicaciones.length > 0 ||
    estado.resultadoTerminal !== null ||
    estado.oportunidadDesafioConsumida ||
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
      cerrado: false,
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
  if (!estadoCoherente(estado, contexto) || !contextoCoherente(contexto))
    return fallo("estado-flor-incoherente");
  const p = contexto.jugadores.find((j) => j.id === jugador),
    desafio = estado.pendiente;
  if (
    !p ||
    !(p.activa ?? true) ||
    !desafio ||
    desafio.tipo !== "contra-flor" ||
    p.equipo !== desafio.equipoRespondedor
  )
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
  const cierre = cerrar(
    {
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
    contexto,
  );
  return {
    aceptada: true,
    estado: cierre.estado,
    eventos: [
      { tipo: respuesta === "quiero" ? "contra-flor-aceptada" : "contra-flor-rechazada", jugador },
      ...cierre.eventos,
    ],
  };
}
export function proponerContraFlorAlResto(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
):
  | ResultadoFlor
  | Readonly<{ aceptada: true; estado: EstadoFlorDominio; eventos: readonly EventoDesafioFlor[] }> {
  if (!estadoCoherente(estado, contexto) || !contextoCoherente(contexto))
    return fallo("estado-flor-incoherente");
  const p = contexto.jugadores.find((j) => j.id === jugador);
  const aumento = estado.pendiente?.tipo === "contra-flor";
  const directa = estado.pendiente === null && estado.historialDesafios.length === 0;
  if (
    !p ||
    !(p.activa ?? true) ||
    estado.adjudicaciones.length > 0 ||
    estado.resultadoTerminal !== null ||
    estado.oportunidadDesafioConsumida ||
    (!aumento && !directa) ||
    (aumento && p.equipo !== estado.pendiente.equipoRespondedor) ||
    !estado.anuncios.some((a) => a.equipo === p.equipo) ||
    !estado.anuncios.some((a) => a.equipo !== p.equipo)
  )
    return fallo("contra-flor-al-resto-invalida");
  const equipoRespondedor = aumento
    ? estado.pendiente.equipoProponente
    : contexto.jugadores.find((j) => j.equipo !== p.equipo)?.equipo;
  if (!equipoRespondedor) return fallo("contra-flor-al-resto-invalida");
  return {
    aceptada: true,
    estado: {
      ...estado,
      cerrado: false,
      pendiente: {
        tipo: "contra-flor-al-resto",
        proponente: jugador,
        equipoProponente: p.equipo,
        equipoRespondedor,
      },
      historialDesafios: [
        ...estado.historialDesafios,
        { tipo: "contra-flor-al-resto", proponente: jugador, equipo: p.equipo, respuesta: null },
      ],
    },
    eventos: [{ tipo: "contra-flor-al-resto-propuesta", jugador }],
  };
}
export function responderContraFlorAlResto(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
  respuesta: "quiero" | "no-quiero",
):
  | ResultadoFlor
  | Readonly<{ aceptada: true; estado: EstadoFlorDominio; eventos: readonly EventoDesafioFlor[] }> {
  if (!estadoCoherente(estado, contexto) || !contextoCoherente(contexto))
    return fallo("estado-flor-incoherente");
  const p = contexto.jugadores.find((j) => j.id === jugador),
    desafio = estado.pendiente;
  if (
    !p ||
    !(p.activa ?? true) ||
    !desafio ||
    desafio.tipo !== "contra-flor-al-resto" ||
    p.equipo !== desafio.equipoRespondedor
  )
    return fallo("respuesta-contra-flor-al-resto-invalida");
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
  const cierre = cerrar(
    {
      ...estado,
      pendiente: null,
      derechosPerdidos: perdidos,
      historialDesafios: estado.historialDesafios.map((registro) =>
        registro.tipo === "contra-flor-al-resto" && registro.respuesta === null
          ? { ...registro, respuesta }
          : registro,
      ),
    },
    contexto,
  );
  return {
    aceptada: true,
    estado: cierre.estado,
    eventos: [
      {
        tipo:
          respuesta === "quiero"
            ? "contra-flor-al-resto-aceptada"
            : "contra-flor-al-resto-rechazada",
        jugador,
      },
      ...cierre.eventos,
    ],
  };
}
type AdjudicacionFlor = EstadoFlorDominio["adjudicaciones"][number];
type CierreFlor = Readonly<{
  estado: EstadoFlorDominio;
  eventos: readonly Readonly<{
    tipo: string;
    equipo?: string;
    adjudicaciones?: readonly AdjudicacionFlor[];
  }>[];
}>;
function contextoCoherente(contexto: ContextoFlor): boolean {
  const ids = contexto?.jugadores?.map((j) => j.id) ?? [];
  return (
    Array.isArray(contexto?.jugadores) &&
    new Set(ids).size === ids.length &&
    ids.length > 0 &&
    Array.isArray(contexto.ordenMano) &&
    contexto.ordenMano.length === ids.length &&
    new Set(contexto.ordenMano).size === ids.length &&
    contexto.ordenMano.every((id) => ids.includes(id)) &&
    typeof contexto.desempate === "boolean" &&
    typeof contexto.faseFlorConfirmada === "boolean"
  );
}
function estadoCoherente(estado: EstadoFlorDominio, contexto: ContextoFlor): boolean {
  const jugadores = contexto?.jugadores ?? [];
  const ids = new Set(jugadores.map((j) => j.id));
  const equipos = new Set(jugadores.map((j) => j.equipo));
  const jugadoresConFlor = new Set(
    jugadores
      .filter((jugador) => tieneFlorCalculada(jugador.cartas, contexto.muestra))
      .map((j) => j.id),
  );
  const anunciosValidos =
    new Set(estado?.anuncios?.map((a) => a.jugador)).size === estado?.anuncios?.length &&
    estado?.anuncios?.every(
      (a) =>
        ids.has(a.jugador) &&
        jugadoresConFlor.has(a.jugador) &&
        jugadores.find((j) => j.id === a.jugador)?.equipo === a.equipo,
    );
  const derechosValidos =
    new Set(estado?.derechosPerdidos).size === estado?.derechosPerdidos?.length &&
    estado?.derechosPerdidos?.every(
      (id) =>
        ids.has(id) &&
        jugadoresConFlor.has(id) &&
        !estado.anuncios.some((anuncio) => anuncio.jugador === id),
    );
  const adjudicacionesValidas =
    new Set(estado?.adjudicaciones?.map((a) => a.equipo)).size === estado?.adjudicaciones?.length &&
    estado?.adjudicaciones?.every(
      (a) => equipos.has(a.equipo) && Number.isInteger(a.puntos) && a.puntos >= 0,
    );
  const equiposConAnuncio = new Set(estado?.anuncios?.map((anuncio) => anuncio.equipo));
  const desafioPendienteValido =
    !estado?.pendiente ||
    (ids.has(estado.pendiente.proponente) &&
      equipos.has(estado.pendiente.equipoProponente) &&
      equipos.has(estado.pendiente.equipoRespondedor) &&
      estado.pendiente.equipoProponente !== estado.pendiente.equipoRespondedor &&
      jugadores.find((j) => j.id === estado.pendiente?.proponente)?.equipo ===
        estado.pendiente.equipoProponente &&
      equiposConAnuncio.has(estado.pendiente.equipoProponente) &&
      equiposConAnuncio.has(estado.pendiente.equipoRespondedor));
  const historialValido =
    estado?.historialDesafios?.length <= 1 &&
    estado?.historialDesafios?.every((desafio) => {
      const proponente = jugadores.find((j) => j.id === desafio.proponente);
      return (
        (desafio.tipo === "contra-flor" || desafio.tipo === "contra-flor-al-resto") &&
        (desafio.respuesta === "quiero" ||
          desafio.respuesta === "no-quiero" ||
          desafio.respuesta === "cancelado-por-retiro" ||
          desafio.respuesta === "rechazo-implicito-por-retiro" ||
          desafio.respuesta === null) &&
        !!proponente &&
        proponente.equipo === desafio.equipo &&
        equiposConAnuncio.has(desafio.equipo) &&
        [...equiposConAnuncio].some((equipo) => equipo !== desafio.equipo)
      );
    });
  const historial = estado?.historialDesafios ?? [];
  const desafioResuelto = historial.length === 1 && historial[0].respuesta !== null;
  const pendienteCoincideConHistorial = !estado?.pendiente
    ? historial.every((desafio) => desafio.respuesta !== null)
    : estado.pendiente.tipo === "contra-flor"
      ? historial.length === 0
      : historial.length === 1 &&
        historial[0].tipo === "contra-flor-al-resto" &&
        historial[0].respuesta === null &&
        historial[0].proponente === estado.pendiente.proponente &&
        historial[0].equipo === estado.pendiente.equipoProponente;
  const rechazoBloqueaEquipo =
    historial[0]?.respuesta !== "no-quiero" ||
    [...jugadoresConFlor].every(
      (id) =>
        jugadores.find((jugador) => jugador.id === id)?.equipo !==
          [...equipos].find((equipo) => equipo !== historial[0].equipo) ||
        estado.anuncios.some((anuncio) => anuncio.jugador === id) ||
        estado.derechosPerdidos.includes(id),
    );
  const cierreHabilitado =
    equiposConAnuncio.size < 2 || estado?.oportunidadDesafioConsumida || desafioResuelto;
  const cierreConsistente = !estado?.cerrado
    ? estado?.adjudicaciones?.length === 0 && estado?.resultadoTerminal === null
    : !estado.pendiente &&
      derechos(contexto, estado).length === 0 &&
      cierreHabilitado &&
      (() => {
        const esperado = adjudicar(estado, contexto);
        return (
          JSON.stringify(estado.adjudicaciones) === JSON.stringify(esperado.adjudicaciones) &&
          JSON.stringify(estado.resultadoTerminal) === JSON.stringify(esperado.resultadoTerminal)
        );
      })();
  return (
    !!estado &&
    Array.isArray(estado.anuncios) &&
    Array.isArray(estado.derechosPerdidos) &&
    Array.isArray(estado.historialDesafios) &&
    Array.isArray(estado.adjudicaciones) &&
    typeof estado.oportunidadDesafioConsumida === "boolean" &&
    anunciosValidos &&
    derechosValidos &&
    adjudicacionesValidas &&
    desafioPendienteValido &&
    historialValido &&
    pendienteCoincideConHistorial &&
    rechazoBloqueaEquipo &&
    (!estado.oportunidadDesafioConsumida || (!estado.pendiente && equiposConAnuncio.size === 2)) &&
    !(estado.cerrado && estado.pendiente) &&
    cierreConsistente
  );
}
function derechos(contexto: ContextoFlor, estado: EstadoFlorDominio): string[] {
  return contexto.jugadores
    .filter(
      (j) =>
        (j.activa ?? true) &&
        tieneFlorCalculada(j.cartas, contexto.muestra) &&
        !j.jugoPrimeraCarta &&
        !estado.anuncios.some((a) => a.jugador === j.id) &&
        !estado.derechosPerdidos.includes(j.id),
    )
    .map((j) => j.id);
}
function adjudicar(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
): Readonly<{
  adjudicaciones: readonly AdjudicacionFlor[];
  resultadoTerminal: EstadoFlorDominio["resultadoTerminal"];
}> {
  const equipos = [...new Set(contexto.jugadores.map((j) => j.equipo))];
  const floresPorEquipo = (equipo: string) =>
    estado.anuncios.filter((a) => a.equipo === equipo).length;
  const desafio = estado.historialDesafios[estado.historialDesafios.length - 1] ?? null;
  const porEquipo = (equipo: string, puntos: number, motivo: AdjudicacionFlor["motivo"]) => ({
    equipo,
    puntos,
    motivo,
  });
  if (!desafio)
    return {
      adjudicaciones: equipos.map((equipo) =>
        porEquipo(equipo, floresPorEquipo(equipo) * 3, "sin-desafio"),
      ),
      resultadoTerminal: null,
    };
  if (desafio.respuesta === "no-quiero" || desafio.respuesta === "rechazo-implicito-por-retiro")
    return {
      adjudicaciones: equipos.map((equipo) =>
        porEquipo(equipo, equipo === desafio.equipo ? floresPorEquipo(equipo) * 3 : 0, "rechazo"),
      ),
      resultadoTerminal: null,
    };
  if (desafio.respuesta === "cancelado-por-retiro")
    return {
      adjudicaciones: equipos.map((equipo) =>
        porEquipo(
          equipo,
          equipo === desafio.equipo ? 0 : floresPorEquipo(equipo) * 3,
          "sin-desafio",
        ),
      ),
      resultadoTerminal: null,
    };
  const tantos = estado.anuncios.map((anuncio) => {
    const jugador = contexto.jugadores.find((p) => p.id === anuncio.jugador)!;
    return {
      jugador: jugador.id,
      equipo: jugador.equipo,
      tanto: calcularTantoFlor(jugador.cartas, contexto.muestra).tanto!,
    };
  });
  const maximo = Math.max(...tantos.map((t) => t.tanto));
  const determinante = contexto.ordenMano
    .map((id) => tantos.find((t) => t.jugador === id))
    .find((t) => t?.tanto === maximo)!;
  if (desafio.tipo === "contra-flor-al-resto" && !contexto.desempate)
    return {
      adjudicaciones: [],
      resultadoTerminal: { tipo: "contra-flor-al-resto-ganada", equipo: determinante.equipo },
    };
  const puntos =
    desafio.tipo === "contra-flor-al-resto" ? 3 : floresPorEquipo(determinante.equipo) * 3;
  return {
    adjudicaciones: equipos.map((equipo) =>
      porEquipo(
        equipo,
        equipo === determinante.equipo ? puntos : 0,
        desafio.tipo === "contra-flor-al-resto" ? "al-resto" : "aceptacion",
      ),
    ),
    resultadoTerminal: null,
  };
}
function cerrar(estado: EstadoFlorDominio, contexto: ContextoFlor): CierreFlor {
  if (
    !contexto.faseFlorConfirmada ||
    estado.pendiente ||
    derechos(contexto, estado).length > 0 ||
    estado.adjudicaciones.length > 0 ||
    estado.resultadoTerminal
  )
    return { estado, eventos: [] };
  const resultado = adjudicar(estado, contexto);
  const eventos: CierreFlor["eventos"] = [
    ...(estado.cerrado ? [] : [{ tipo: "fase-flor-cerrada" }]),
    ...(resultado.resultadoTerminal
      ? [{ tipo: "contra-flor-al-resto-victoria", equipo: resultado.resultadoTerminal.equipo }]
      : [{ tipo: "flor-adjudicada", adjudicaciones: resultado.adjudicaciones }]),
  ];
  return {
    estado: { ...estado, cerrado: true, ...resultado },
    eventos,
  };
}
function anunciarFlorConExcepcionDeTurno(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
  permitePrimerAnuncioFueraDeTurno: boolean,
): ResultadoFlor {
  if (!estadoCoherente(estado, contexto) || !contextoCoherente(contexto))
    return fallo("estado-flor-incoherente");
  if (estado.cerrado) return fallo("fase-cerrada");
  const participante = contexto.jugadores.find((j) => j.id === jugador);
  if (
    !participante ||
    !(participante.activa ?? true) ||
    !tieneFlorCalculada(participante.cartas, contexto.muestra)
  )
    return fallo("flor-inexistente");
  if (estado.anuncios.some((a) => a.jugador === jugador)) return fallo("flor-duplicada");
  if (estado.derechosPerdidos.includes(jugador) || participante.jugoPrimeraCarta)
    return fallo("derecho-perdido");
  if (
    estado.anuncios.length === 0 &&
    contexto.jugadorTurno !== jugador &&
    !permitePrimerAnuncioFueraDeTurno
  )
    return fallo("primer-anuncio-fuera-de-turno");
  const cierre = cerrar(
    { ...estado, anuncios: [...estado.anuncios, { jugador, equipo: participante.equipo }] },
    contexto,
  );
  return {
    aceptada: true,
    estado: cierre.estado,
    eventos: [{ tipo: "flor-anunciada", jugador }, ...cierre.eventos],
  };
}
export function anunciarFlor(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
): ResultadoFlor {
  return anunciarFlorConExcepcionDeTurno(estado, contexto, jugador, false);
}
export function perderDerechoFlor(
  estado: EstadoFlorDominio,
  contexto: ContextoFlor,
  jugador: string,
): ResultadoFlor {
  if (!estadoCoherente(estado, contexto) || !contextoCoherente(contexto))
    return fallo("estado-flor-incoherente");
  if (estado.cerrado) return fallo("fase-cerrada");
  const participante = contexto.jugadores.find((j) => j.id === jugador);
  if (
    !participante ||
    !tieneFlorCalculada(participante.cartas, contexto.muestra) ||
    estado.anuncios.some((a) => a.jugador === jugador) ||
    estado.derechosPerdidos.includes(jugador)
  )
    return fallo("derecho-no-perdible");
  const cierre = cerrar(
    { ...estado, derechosPerdidos: [...estado.derechosPerdidos, jugador] },
    contexto,
  );
  return {
    aceptada: true,
    estado: cierre.estado,
    eventos: [{ tipo: "derecho-flor-perdido", jugador }, ...cierre.eventos],
  };
}
