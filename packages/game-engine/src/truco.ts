/** Niveles reglamentarios de la apuesta de Truco (§8.1). */
export type NivelApuestaTruco = "truco" | "retruco" | "vale-cuatro";

/** Participantes y situación canónica que el coordinador debe derivar. */
export type ContextoTruco = Readonly<{
  jugadores: readonly Readonly<{ id: string; equipo: string }>[];
  jugadorTurno: string | null;
  manoFinalizada: boolean;
  florPendiente: boolean;
  envidoPendiente: boolean;
  /** Participantes que aún pueden intervenir; omitido equivale a todos. */
  jugadoresActivos?: readonly string[];
}>;

/** El equipo aceptante es necesario para legitimar el siguiente aumento. */
export type ApuestaTrucoActiva = Readonly<{
  nivel: NivelApuestaTruco;
  equipoAceptante: string;
}>;
export type PropuestaTrucoPendiente = Readonly<{
  nivel: NivelApuestaTruco;
  proponente: string;
}>;
export type RespuestaPropuestaTruco =
  "quiero" | "no-quiero" | "rechazo-implicito-por-retiro" | "cancelada-por-retiro" | null;
type BaseHistorialPropuestaTruco = Readonly<{
  orden: 1 | 2 | 3;
  nivel: NivelApuestaTruco;
  proponente: string;
  equipoProponente: string;
  nivelAceptadoAnterior: NivelApuestaTruco | null;
}>;
export type HistorialPropuestaTruco =
  | (BaseHistorialPropuestaTruco &
      Readonly<{
        respuesta: null | "quiero" | "cancelada-por-retiro";
      }>)
  | (BaseHistorialPropuestaTruco & Readonly<{ respuesta: "no-quiero"; respondedor: string }>)
  | (BaseHistorialPropuestaTruco &
      Readonly<{ respuesta: "rechazo-implicito-por-retiro"; jugadorRetirado: string }>);
export type EstadoTrucoDominio = Readonly<{
  apuestaActiva: ApuestaTrucoActiva | null;
  propuestaPendiente: PropuestaTrucoPendiente | null;
  historialPropuestas: readonly HistorialPropuestaTruco[];
}>;

export type EstadoTruco = EstadoTrucoDominio;
export type AdjudicacionTruco = Readonly<{
  equipo: string;
  puntos: 1 | 2 | 3;
  motivo: "rechazo";
}>;
export type EventoTruco =
  | Readonly<{
      tipo: "truco-propuesto" | "retruco-propuesto" | "vale-cuatro-propuesto";
      propuesta: PropuestaTrucoPendiente;
      equipoProponente: string;
    }>
  | Readonly<{
      tipo: "truco-aceptado" | "retruco-aceptado" | "vale-cuatro-aceptado";
      propuesta: PropuestaTrucoPendiente;
      respondedor: string;
      equipoRespondedor: string;
    }>
  | Readonly<{
      tipo: "truco-rechazado" | "retruco-rechazado" | "vale-cuatro-rechazado";
      propuesta: PropuestaTrucoPendiente;
      respondedor: string;
      adjudicacion: AdjudicacionTruco;
      manoFinalizada: true;
    }>;
export type ResultadoTruco =
  | Readonly<{ aceptada: true; estado: EstadoTrucoDominio; eventos: readonly EventoTruco[] }>
  | Readonly<{ aceptada: false; codigo: string }>;

export function crearEstadoTruco(): EstadoTrucoDominio {
  return { apuestaActiva: null, propuestaPendiente: null, historialPropuestas: [] };
}

function esContextoTrucoValido(contexto: ContextoTruco | null | undefined): boolean {
  if (!contexto || !Array.isArray(contexto.jugadores) || !contexto.jugadores.length) return false;
  if (
    typeof contexto.manoFinalizada !== "boolean" ||
    typeof contexto.florPendiente !== "boolean" ||
    typeof contexto.envidoPendiente !== "boolean"
  )
    return false;
  const jugadores = contexto.jugadores;
  if (
    jugadores.some((jugador) => !jugador?.id || !jugador.equipo) ||
    new Set(jugadores.map((jugador) => jugador.id)).size !== jugadores.length ||
    new Set(jugadores.map((jugador) => jugador.equipo)).size !== 2
  )
    return false;
  return (
    (contexto.jugadorTurno === null ||
      jugadores.some((jugador) => jugador.id === contexto.jugadorTurno)) &&
    (contexto.jugadoresActivos === undefined ||
      (Array.isArray(contexto.jugadoresActivos) &&
        new Set(contexto.jugadoresActivos).size === contexto.jugadoresActivos.length &&
        contexto.jugadoresActivos.every((id) => jugadores.some((jugador) => jugador.id === id))))
  );
}

function estaActivo(contexto: ContextoTruco, jugador: string): boolean {
  return contexto.jugadoresActivos?.includes(jugador) ?? true;
}

function nivelSiguiente(nivel: NivelApuestaTruco | null): NivelApuestaTruco | null {
  return nivel === "truco" ? "retruco" : nivel === "retruco" ? "vale-cuatro" : null;
}

function tipoAceptacion(
  nivel: NivelApuestaTruco,
): "truco-aceptado" | "retruco-aceptado" | "vale-cuatro-aceptado" {
  return nivel === "truco"
    ? "truco-aceptado"
    : nivel === "retruco"
      ? "retruco-aceptado"
      : "vale-cuatro-aceptado";
}

function tipoRechazo(
  nivel: NivelApuestaTruco,
): "truco-rechazado" | "retruco-rechazado" | "vale-cuatro-rechazado" {
  return nivel === "truco"
    ? "truco-rechazado"
    : nivel === "retruco"
      ? "retruco-rechazado"
      : "vale-cuatro-rechazado";
}

function apuestaValida(apuesta: ApuestaTrucoActiva, contexto?: ContextoTruco | null): boolean {
  return (
    !!apuesta &&
    ["truco", "retruco", "vale-cuatro"].includes(apuesta.nivel) &&
    !!apuesta.equipoAceptante &&
    (!contexto ||
      (esContextoTrucoValido(contexto) &&
        contexto.jugadores.some((jugador) => jugador.equipo === apuesta.equipoAceptante)))
  );
}

/** Verifica los invariantes estructurales y su relación opcional con el contexto. */
export function esEstadoTrucoValido(
  estado: EstadoTrucoDominio | null | undefined,
  contexto?: ContextoTruco | null,
): boolean {
  if (!estado) return false;
  if (!Array.isArray(estado.historialPropuestas)) return false;
  const historial = estado.historialPropuestas;
  if (historial.length > 3) return false;
  if (contexto && !esContextoTrucoValido(contexto)) return false;
  let ultimoAceptado: HistorialPropuestaTruco | null = null;
  for (const [indice, entrada] of historial.entries()) {
    const nivel = indice === 0 ? "truco" : indice === 1 ? "retruco" : "vale-cuatro";
    if (
      !entrada ||
      entrada.orden !== indice + 1 ||
      entrada.nivel !== nivel ||
      !entrada.proponente ||
      !entrada.equipoProponente ||
      entrada.nivelAceptadoAnterior !== (ultimoAceptado?.nivel ?? null) ||
      (indice > 0 && entrada.equipoProponente === historial[indice - 1]!.equipoProponente) ||
      ![
        "quiero",
        "no-quiero",
        "rechazo-implicito-por-retiro",
        "cancelada-por-retiro",
        null,
      ].includes(entrada.respuesta) ||
      (entrada.respuesta === "no-quiero" && !("respondedor" in entrada && entrada.respondedor)) ||
      (entrada.respuesta === "rechazo-implicito-por-retiro" &&
        !("jugadorRetirado" in entrada && entrada.jugadorRetirado)) ||
      (entrada.respuesta !== "no-quiero" && "respondedor" in entrada) ||
      (entrada.respuesta !== "rechazo-implicito-por-retiro" && "jugadorRetirado" in entrada)
    )
      return false;
    if (
      contexto &&
      !contexto.jugadores.some(
        (jugador) =>
          jugador.id === entrada.proponente && jugador.equipo === entrada.equipoProponente,
      )
    )
      return false;
    if (
      contexto &&
      entrada.respuesta === "no-quiero" &&
      !contexto.jugadores.some(
        (jugador) =>
          jugador.id === entrada.respondedor && jugador.equipo !== entrada.equipoProponente,
      )
    )
      return false;
    if (
      contexto &&
      entrada.respuesta === "rechazo-implicito-por-retiro" &&
      !contexto.jugadores.some(
        (jugador) =>
          jugador.id === entrada.jugadorRetirado && jugador.equipo !== entrada.equipoProponente,
      )
    )
      return false;
    if (indice < historial.length - 1 && entrada.respuesta !== "quiero") return false;
    if (entrada.respuesta === "quiero") ultimoAceptado = entrada;
  }
  const pendiente = historial.at(-1)?.respuesta === null ? historial.at(-1)! : null;
  if (
    (pendiente === null) !== (estado.propuestaPendiente === null) ||
    (pendiente &&
      (estado.propuestaPendiente!.nivel !== pendiente.nivel ||
        estado.propuestaPendiente!.proponente !== pendiente.proponente ||
        (contexto?.manoFinalizada ?? false)))
  )
    return false;
  if (!ultimoAceptado) return estado.apuestaActiva === null;
  if (
    !apuestaValida(estado.apuestaActiva!, contexto) ||
    estado.apuestaActiva!.nivel !== ultimoAceptado.nivel
  )
    return false;
  if (contexto) {
    const equipoAceptante = contexto.jugadores.find(
      (jugador) => jugador.equipo !== ultimoAceptado.equipoProponente,
    )?.equipo;
    if (estado.apuestaActiva!.equipoAceptante !== equipoAceptante) return false;
  }
  return true;
}

const fallo = (codigo: string): ResultadoTruco => ({ aceptada: false, codigo });
function registrarPropuesta(
  estado: EstadoTrucoDominio,
  nivel: NivelApuestaTruco,
  proponente: string,
  equipoProponente: string,
): HistorialPropuestaTruco[] {
  return [
    ...estado.historialPropuestas,
    {
      orden: (estado.historialPropuestas.length + 1) as 1 | 2 | 3,
      nivel,
      proponente,
      equipoProponente,
      nivelAceptadoAnterior: estado.apuestaActiva?.nivel ?? null,
      respuesta: null,
    },
  ];
}
function responderUltimaPropuesta(
  estado: EstadoTrucoDominio,
  respuesta: Exclude<RespuestaPropuestaTruco, null>,
  jugadorRespuesta?: string,
): HistorialPropuestaTruco[] {
  return estado.historialPropuestas.map((entrada, indice) =>
    indice === estado.historialPropuestas.length - 1
      ? respuesta === "no-quiero"
        ? { ...entrada, respuesta, respondedor: jugadorRespuesta! }
        : respuesta === "rechazo-implicito-por-retiro"
          ? { ...entrada, respuesta, jugadorRetirado: jugadorRespuesta! }
          : { ...entrada, respuesta }
      : entrada,
  );
}

function secuenciaTrucoTerminada(estado: EstadoTrucoDominio): boolean {
  const respuesta = estado.historialPropuestas.at(-1)?.respuesta;
  return (
    respuesta === "no-quiero" ||
    respuesta === "rechazo-implicito-por-retiro" ||
    respuesta === "cancelada-por-retiro"
  );
}

function validarAccionBase(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
): ResultadoTruco | null {
  if (!esContextoTrucoValido(contexto)) return fallo("contexto-invalido");
  if (!esEstadoTrucoValido(estado, contexto)) return fallo("estado-invalido");
  if (secuenciaTrucoTerminada(estado)) return fallo("secuencia-finalizada");
  if (estado.propuestaPendiente) return fallo("propuesta-pendiente");
  if (contexto.manoFinalizada) return fallo("mano-finalizada");
  if (contexto.florPendiente) return fallo("flor-pendiente");
  if (contexto.envidoPendiente) return fallo("envido-pendiente");
  return null;
}

/** §8.2 y §14: propone el Truco inicial en turno de carta. */
export function proponerTruco(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
): ResultadoTruco {
  const rechazo = validarAccionBase(estado, contexto);
  if (rechazo) return rechazo;
  if (estado.apuestaActiva) return fallo("apuesta-ya-aceptada");
  const proponente = contexto.jugadores.find((participante) => participante.id === jugador);
  if (!proponente) return fallo("jugador-inexistente");
  if (!estaActivo(contexto, jugador)) return fallo("jugador-inactivo");
  if (contexto.jugadorTurno !== jugador) return fallo("fuera-de-turno");
  const propuesta: PropuestaTrucoPendiente = { nivel: "truco", proponente: jugador };
  return {
    aceptada: true,
    estado: {
      ...estado,
      propuestaPendiente: propuesta,
      historialPropuestas: registrarPropuesta(estado, "truco", jugador, proponente.equipo),
    },
    eventos: [{ tipo: "truco-propuesto", propuesta, equipoProponente: proponente.equipo }],
  };
}

function proponerAumento(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
  nivel: "retruco" | "vale-cuatro",
): ResultadoTruco {
  if (!esContextoTrucoValido(contexto)) return fallo("contexto-invalido");
  if (!esEstadoTrucoValido(estado, contexto)) return fallo("estado-invalido");
  if (secuenciaTrucoTerminada(estado)) return fallo("secuencia-finalizada");
  if (contexto.manoFinalizada) return fallo("mano-finalizada");
  if (contexto.florPendiente) return fallo("flor-pendiente");
  if (contexto.envidoPendiente) return fallo("envido-pendiente");
  const proponente = contexto.jugadores.find((participante) => participante.id === jugador);
  if (!proponente) return fallo("jugador-inexistente");
  if (!estaActivo(contexto, jugador)) return fallo("jugador-inactivo");
  if (estado.propuestaPendiente) {
    const propuestaAnterior = estado.propuestaPendiente;
    if (nivelSiguiente(propuestaAnterior.nivel) !== nivel) return fallo("aumento-no-disponible");
    const equipoProponenteAnterior = contexto.jugadores.find(
      (participante) => participante.id === propuestaAnterior.proponente,
    )!.equipo;
    if (proponente.equipo === equipoProponenteAnterior) return fallo("aumento-no-habilitado");
    const apuestaActiva: ApuestaTrucoActiva = {
      nivel: propuestaAnterior.nivel,
      equipoAceptante: proponente.equipo,
    };
    const propuesta: PropuestaTrucoPendiente = { nivel, proponente: jugador };
    return {
      aceptada: true,
      estado: {
        apuestaActiva,
        propuestaPendiente: propuesta,
        historialPropuestas: [
          ...responderUltimaPropuesta(estado, "quiero"),
          {
            orden: (estado.historialPropuestas.length + 1) as 1 | 2 | 3,
            nivel,
            proponente: jugador,
            equipoProponente: proponente.equipo,
            nivelAceptadoAnterior: apuestaActiva.nivel,
            respuesta: null,
          },
        ],
      },
      eventos: [
        {
          tipo: tipoAceptacion(propuestaAnterior.nivel),
          propuesta: propuestaAnterior,
          respondedor: jugador,
          equipoRespondedor: proponente.equipo,
        },
        {
          tipo: nivel === "retruco" ? "retruco-propuesto" : "vale-cuatro-propuesto",
          propuesta,
          equipoProponente: proponente.equipo,
        },
      ],
    };
  }
  if (!estado.apuestaActiva) return fallo("sin-apuesta-aceptada");
  if (nivelSiguiente(estado.apuestaActiva.nivel) !== nivel) return fallo("aumento-no-disponible");
  if (proponente.equipo !== estado.apuestaActiva.equipoAceptante)
    return fallo("aumento-no-habilitado");
  const propuesta: PropuestaTrucoPendiente = { nivel, proponente: jugador };
  return {
    aceptada: true,
    estado: {
      ...estado,
      propuestaPendiente: propuesta,
      historialPropuestas: registrarPropuesta(estado, nivel, jugador, proponente.equipo),
    },
    eventos: [
      {
        tipo: nivel === "retruco" ? "retruco-propuesto" : "vale-cuatro-propuesto",
        propuesta,
        equipoProponente: proponente.equipo,
      },
    ],
  };
}

/** §8.3 y precisión v1.3: cualquier integrante del equipo aceptante propone Retruco. */
export function proponerRetruco(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
): ResultadoTruco {
  return proponerAumento(estado, contexto, jugador, "retruco");
}

/** §8.3 y precisión v1.3: cualquier integrante del equipo aceptante propone Vale Cuatro. */
export function proponerValeCuatro(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
): ResultadoTruco {
  return proponerAumento(estado, contexto, jugador, "vale-cuatro");
}

function responderPropuesta(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
  respuesta: "quiero" | "no-quiero",
  nivel: NivelApuestaTruco,
): ResultadoTruco {
  if (!esContextoTrucoValido(contexto)) return fallo("contexto-invalido");
  if (contexto.manoFinalizada) return fallo("mano-finalizada");
  if (!esEstadoTrucoValido(estado, contexto)) return fallo("estado-invalido");
  if (!estado.propuestaPendiente || estado.propuestaPendiente.nivel !== nivel)
    return fallo("sin-propuesta-pendiente");
  const respondedor = contexto.jugadores.find((participante) => participante.id === jugador);
  const proponente = contexto.jugadores.find(
    (participante) => participante.id === estado.propuestaPendiente!.proponente,
  )!;
  if (!respondedor) return fallo("jugador-inexistente");
  if (!estaActivo(contexto, jugador)) return fallo("jugador-inactivo");
  if (respondedor.equipo === proponente.equipo) return fallo("respondedor-invalido");
  if (contexto.florPendiente) return fallo("flor-pendiente");
  if (contexto.envidoPendiente) return fallo("envido-pendiente");
  const propuesta = estado.propuestaPendiente;
  if (respuesta === "quiero")
    return {
      aceptada: true,
      estado: {
        apuestaActiva: { nivel, equipoAceptante: respondedor.equipo },
        propuestaPendiente: null,
        historialPropuestas: responderUltimaPropuesta(estado, "quiero"),
      },
      eventos: [
        {
          tipo: tipoAceptacion(nivel),
          propuesta,
          respondedor: jugador,
          equipoRespondedor: respondedor.equipo,
        },
      ],
    };
  const puntos: 1 | 2 | 3 = nivel === "truco" ? 1 : nivel === "retruco" ? 2 : 3;
  return {
    aceptada: true,
    estado: {
      apuestaActiva: estado.apuestaActiva,
      propuestaPendiente: null,
      historialPropuestas: responderUltimaPropuesta(estado, "no-quiero", jugador),
    },
    eventos: [
      {
        tipo: tipoRechazo(nivel),
        propuesta,
        respondedor: jugador,
        adjudicacion: { equipo: proponente.equipo, puntos, motivo: "rechazo" },
        manoFinalizada: true,
      },
    ],
  };
}

export function responderQuieroTruco(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
): ResultadoTruco {
  return responderPropuesta(estado, contexto, jugador, "quiero", "truco");
}

export function responderNoQuieroTruco(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
): ResultadoTruco {
  return responderPropuesta(estado, contexto, jugador, "no-quiero", "truco");
}

/** §8.1–8.3: el equipo receptor acepta Retruco fuera de turno. */
export function responderQuieroRetruco(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
): ResultadoTruco {
  return responderPropuesta(estado, contexto, jugador, "quiero", "retruco");
}

/** §8.4: el rechazo de Retruco adjudica dos puntos y resuelve la mano. */
export function responderNoQuieroRetruco(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
): ResultadoTruco {
  return responderPropuesta(estado, contexto, jugador, "no-quiero", "retruco");
}

/** §8.1–8.3: el equipo receptor acepta Vale Cuatro fuera de turno. */
export function responderQuieroValeCuatro(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
): ResultadoTruco {
  return responderPropuesta(estado, contexto, jugador, "quiero", "vale-cuatro");
}

/** §8.4: el rechazo de Vale Cuatro adjudica tres puntos y resuelve la mano. */
export function responderNoQuieroValeCuatro(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugador: string,
): ResultadoTruco {
  return responderPropuesta(estado, contexto, jugador, "no-quiero", "vale-cuatro");
}

/** Resultado de una propuesta de Truco afectada por retiro, distinto de una respuesta humana. */
export type LiquidacionTrucoPorRetiro = Readonly<{
  causa: "rechazo-implicito-por-retiro" | "propuesta-cancelada-por-retiro";
  equipo: string;
  puntos: 1 | 2 | 3 | 4;
}>;
export function esLiquidacionTrucoPorRetiroValida(
  liquidacion: LiquidacionTrucoPorRetiro,
  contexto: ContextoTruco,
): boolean {
  return (
    !!liquidacion &&
    (liquidacion.causa === "rechazo-implicito-por-retiro" ||
      liquidacion.causa === "propuesta-cancelada-por-retiro") &&
    contexto.jugadores.some((jugador) => jugador.equipo === liquidacion.equipo) &&
    [1, 2, 3, 4].includes(liquidacion.puntos)
  );
}

export type ResultadoLiquidacionTrucoPorRetiro =
  | Readonly<{
      aceptada: true;
      estado: EstadoTrucoDominio;
      liquidacion: LiquidacionTrucoPorRetiro;
      eventos: readonly Readonly<{
        tipo:
          | "truco-rechazo-implicito-por-retiro"
          | "truco-cancelado-por-retiro"
          | "truco-sin-propuesta-por-retiro";
      }>[];
    }>
  | Readonly<{ aceptada: false; codigo: string }>;
/** Liquida una propuesta por retiro sin reutilizar la respuesta No quiero. */
export function liquidarTrucoPorRetiro(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
  jugadorRetirado: string,
): ResultadoLiquidacionTrucoPorRetiro {
  if (!esEstadoTrucoValido(estado, contexto)) return { aceptada: false, codigo: "estado-invalido" };
  const retirado = contexto.jugadores.find((jugador) => jugador.id === jugadorRetirado);
  if (!retirado) return { aceptada: false, codigo: "jugador-inexistente" };
  const propuesta = estado.propuestaPendiente;
  const nivelAceptado = estado.apuestaActiva?.nivel ?? null;
  const puntos =
    nivelAceptado === "truco"
      ? 2
      : nivelAceptado === "retruco"
        ? 3
        : nivelAceptado === "vale-cuatro"
          ? 4
          : 1;
  if (!propuesta)
    return {
      aceptada: true,
      estado,
      liquidacion: { causa: "propuesta-cancelada-por-retiro", equipo: retirado.equipo, puntos },
      eventos: [{ tipo: "truco-sin-propuesta-por-retiro" }],
    };
  const proponente = contexto.jugadores.find((jugador) => jugador.id === propuesta.proponente)!;
  if (retirado.equipo === proponente.equipo)
    return {
      aceptada: true,
      estado: {
        ...estado,
        propuestaPendiente: null,
        historialPropuestas: responderUltimaPropuesta(estado, "cancelada-por-retiro"),
      },
      liquidacion: { causa: "propuesta-cancelada-por-retiro", equipo: retirado.equipo, puntos },
      eventos: [{ tipo: "truco-cancelado-por-retiro" }],
    };
  const rechazo = propuesta.nivel === "truco" ? 1 : propuesta.nivel === "retruco" ? 2 : 3;
  return {
    aceptada: true,
    estado: {
      apuestaActiva: estado.apuestaActiva,
      propuestaPendiente: null,
      historialPropuestas: responderUltimaPropuesta(
        estado,
        "rechazo-implicito-por-retiro",
        jugadorRetirado,
      ),
    },
    liquidacion: {
      causa: "rechazo-implicito-por-retiro",
      equipo: proponente.equipo,
      puntos: rechazo,
    },
    eventos: [{ tipo: "truco-rechazo-implicito-por-retiro" }],
  };
}
