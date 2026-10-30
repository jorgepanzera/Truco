/** Niveles reglamentarios de la apuesta de Truco (§8.1). */
export type NivelApuestaTruco = "truco" | "retruco" | "vale-cuatro";

/** Participantes y situación canónica que el coordinador debe derivar. */
export type ContextoTruco = Readonly<{
  jugadores: readonly Readonly<{ id: string; equipo: string }>[];
  jugadorTurno: string | null;
  manoFinalizada: boolean;
  florPendiente: boolean;
  envidoPendiente: boolean;
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
export type EstadoTrucoDominio = Readonly<{
  apuestaActiva: ApuestaTrucoActiva | null;
  propuestaPendiente: PropuestaTrucoPendiente | null;
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
  return { apuestaActiva: null, propuestaPendiente: null };
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
    contexto.jugadorTurno === null ||
    jugadores.some((jugador) => jugador.id === contexto.jugadorTurno)
  );
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
  if (!estado.apuestaActiva) {
    if (!estado.propuestaPendiente) return !contexto || esContextoTrucoValido(contexto);
    return (
      estado.propuestaPendiente.nivel === "truco" &&
      !!estado.propuestaPendiente.proponente &&
      (!contexto ||
        (esContextoTrucoValido(contexto) &&
          !contexto.manoFinalizada &&
          contexto.jugadores.some(
            (jugador) => jugador.id === estado.propuestaPendiente!.proponente,
          )))
    );
  }
  if (!apuestaValida(estado.apuestaActiva, contexto)) return false;
  if (!estado.propuestaPendiente) return true;
  const propuesta = estado.propuestaPendiente;
  return (
    propuesta.nivel === nivelSiguiente(estado.apuestaActiva.nivel) &&
    !!propuesta.proponente &&
    (!contexto ||
      (esContextoTrucoValido(contexto) &&
        !contexto.manoFinalizada &&
        contexto.jugadores.some(
          (jugador) =>
            jugador.id === propuesta.proponente &&
            jugador.equipo === estado.apuestaActiva!.equipoAceptante,
        )))
  );
}

const fallo = (codigo: string): ResultadoTruco => ({ aceptada: false, codigo });

function validarAccionBase(
  estado: EstadoTrucoDominio,
  contexto: ContextoTruco,
): ResultadoTruco | null {
  if (!esContextoTrucoValido(contexto)) return fallo("contexto-invalido");
  if (!esEstadoTrucoValido(estado, contexto)) return fallo("estado-invalido");
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
  if (contexto.jugadorTurno !== jugador) return fallo("fuera-de-turno");
  const propuesta: PropuestaTrucoPendiente = { nivel: "truco", proponente: jugador };
  return {
    aceptada: true,
    estado: { ...estado, propuestaPendiente: propuesta },
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
  if (contexto.manoFinalizada) return fallo("mano-finalizada");
  if (contexto.florPendiente) return fallo("flor-pendiente");
  if (contexto.envidoPendiente) return fallo("envido-pendiente");
  const proponente = contexto.jugadores.find((participante) => participante.id === jugador);
  if (!proponente) return fallo("jugador-inexistente");
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
      estado: { apuestaActiva, propuestaPendiente: propuesta },
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
    estado: { ...estado, propuestaPendiente: propuesta },
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
    estado: crearEstadoTruco(),
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
