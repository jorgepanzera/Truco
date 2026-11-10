import type { Carta, MetaPuntos } from "@truco/shared";

export type AccionWeb =
  | Readonly<{ type: "continue-hand"; handId: string }>
  | Readonly<{ type: "play-card"; card: Carta }>
  | Readonly<{ type: "envido" | "raise-envido"; canto: "envido" | "real-envido" | "falta-envido" }>
  | Readonly<{
      type:
        | "announce-flor"
        | "contra-flor"
        | "contra-flor-al-resto"
        | "accept-contra-flor"
        | "reject-contra-flor"
        | "accept-contra-flor-al-resto"
        | "reject-contra-flor-al-resto"
        | "accept-envido"
        | "reject-envido"
        | "con-flor-quiero"
        | "go-to-mazo"
        | "truco"
        | "accept-truco"
        | "reject-truco"
        | "retruco"
        | "accept-retruco"
        | "reject-retruco"
        | "vale-cuatro"
        | "accept-vale-cuatro"
        | "reject-vale-cuatro";
    }>;

type Participante = Readonly<{
  asiento: number;
  apodo: string;
  automatico?: boolean;
  equipo?: string;
}>;
export type JugadaPublica = Readonly<{ asiento: number; carta: Carta }>;
export type BazaPublica = Readonly<{
  jugadas: readonly JugadaPublica[];
  asientoGanador: number | null;
}>;
export type EventoPublico = Readonly<{
  secuencia: number;
  idMano: string;
  tipo: string;
  asiento?: number;
  canto?: string;
  nivelTruco?: string;
  asientoGanador?: number;
  adjudicaciones?: readonly Readonly<{ asientoGanador: number; puntos: number; causa?: string }>[];
  tantos?: readonly Readonly<{ asiento: number; tanto: number }>[];
  marcadorCierre?: readonly Readonly<{ asiento: number; puntos: number }>[];
}>;
export type DesafiosPendientes = Readonly<{
  envido: Readonly<{
    proponente: number;
    respondedor: number;
    valor: number;
    canto: "envido" | "real-envido" | "falta-envido";
  }> | null;
  flor: Readonly<{ tipo: string; proponente: number; respondedor: number }> | null;
  truco: Readonly<{ nivel: string; proponente: number }> | null;
  oportunidadFlorPropia: boolean;
}>;

type SnapshotBase = Readonly<{
  estado: string;
  matchId: string;
  modalidad: "1v1";
  metaPuntos: MetaPuntos;
  version: number;
  asientoPropio: number;
  participantes: readonly Participante[];
}>;

type SnapshotEspera = SnapshotBase & Readonly<{ estado: "esperando" }>;

type SnapshotIniciado = SnapshotBase &
  Readonly<{
    estado: "iniciada";
    idMano: string;
    marcador: readonly Readonly<{ asiento: number; puntos: number }>[];
    resultadoPartida: Readonly<{ asientoGanador: number }> | null;
    repartidor: number;
    muestra: Carta;
    cartasPropias: readonly Carta[];
    cartasRivalesRestantes: number;
    accionesDisponibles: readonly AccionWeb[];
    continuacion: Readonly<{ idMano: string; confirmadaPropia: boolean; faltantes: number }> | null;
    eventosPublicos: readonly EventoPublico[];
    bazasCompletadas: readonly BazaPublica[];
    bazaActual: BazaPublica;
    turno: number | null;
    desafiosPendientes: DesafiosPendientes;
    ultimoCierre: Readonly<{
      idMano: string;
      version: number;
      asientoGanador: number;
      equipo: string;
      puntos: number;
      causa: string;
      bazas: readonly BazaPublica[];
      comprobacion?: Readonly<{
        flor?: Readonly<{
          resultado: "sin-desafio" | "rechazo" | "comparada";
          desafio?: "contra-flor" | "contra-flor-al-resto";
          participantes: readonly Readonly<{
            asiento: number;
            equipo: string;
            cartas: readonly Carta[];
            tanto?: number;
          }>[];
          asientoGanador?: number;
        }>;
        envido?: Readonly<{
          participantes: readonly Readonly<{
            asiento: number;
            equipo: string;
            cartas: readonly Carta[];
            tanto: number;
          }>[];
          asientoGanador: number;
          asientoDeterminante: number;
        }>;
      }>;
    }> | null;
  }>;

export type SnapshotPartida = SnapshotEspera | SnapshotIniciado;

const http = () =>
  (import.meta as ImportMeta & { env: { VITE_SERVER_URL?: string } }).env.VITE_SERVER_URL ||
  window.location.origin;

const ws = () => {
  const url = new URL(http());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  return url.toString();
};

export async function crearSesionYPartida(
  nickname: string,
  targetScore: MetaPuntos,
  signal?: AbortSignal,
): Promise<{ token: string; snapshot: SnapshotPartida }> {
  const sesion = await fetch(`${http()}/api/guest-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
    signal,
  });
  if (!sesion.ok) throw new Error("No se pudo crear la sesión.");
  if (signal?.aborted) throw new Error("Solicitud cancelada.");

  const { token } = (await sesion.json()) as { token?: unknown };
  if (typeof token !== "string") throw new Error("La sesión recibida no es válida.");

  const partida = await fetch(`${http()}/api/matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode: "1v1-vs-machine", targetScore }),
    signal,
  });
  if (!partida.ok) throw new Error("No se pudo iniciar la partida.");

  const respuesta = (await partida.json()) as { snapshot?: SnapshotPartida };
  if (!respuesta.snapshot) throw new Error("La partida recibida no es válida.");
  return { token, snapshot: respuesta.snapshot };
}

export async function abandonarPartida(
  token: string,
  matchId: string,
  signal?: AbortSignal,
): Promise<void> {
  const respuesta = await fetch(`${http()}/api/matches/${matchId}/abandon`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!respuesta.ok) throw new Error("No se pudo abandonar la partida.");
}

export function conectar(
  token: string,
  matchId: string,
  snapshot: (snapshot: SnapshotPartida) => void,
  error: (mensaje: string) => void,
  cerrar: () => void,
  eventos?: Readonly<{
    confirmar: (actionId: string, version: number) => void;
    rechazar: (actionId: string, codigo: string, version: number) => void;
  }>,
): WebSocket {
  const socket = new WebSocket(ws());
  let falloInformado = false;
  const informarError = (mensaje: string) => {
    falloInformado = true;
    error(mensaje);
  };

  socket.onopen = () => socket.send(JSON.stringify({ type: "auth", token }));
  socket.onmessage = ({ data }) => {
    let mensaje: unknown;
    try {
      mensaje = JSON.parse(String(data));
    } catch {
      informarError("El servidor envió un mensaje inválido.");
      return;
    }
    if (!mensaje || typeof mensaje !== "object") {
      informarError("El servidor envió un mensaje inválido.");
      return;
    }

    const respuesta = mensaje as {
      type?: unknown;
      message?: unknown;
      snapshot?: SnapshotPartida;
      actionId?: unknown;
      code?: unknown;
      version?: unknown;
    };
    if (respuesta.type === "auth.ok") socket.send(JSON.stringify({ type: "subscribe", matchId }));
    if (respuesta.type === "game.snapshot" && respuesta.snapshot) snapshot(respuesta.snapshot);
    if (
      respuesta.type === "game.confirmed" &&
      typeof respuesta.actionId === "string" &&
      typeof respuesta.version === "number"
    )
      eventos?.confirmar(respuesta.actionId, respuesta.version);
    if (
      respuesta.type === "game.rejected" &&
      typeof respuesta.actionId === "string" &&
      typeof respuesta.code === "string" &&
      typeof respuesta.version === "number"
    )
      eventos?.rechazar(respuesta.actionId, respuesta.code, respuesta.version);
    if (respuesta.type === "error")
      informarError(
        typeof respuesta.message === "string" ? respuesta.message : "Error del servidor.",
      );
  };
  socket.onerror = () => informarError("No se pudo conectar al servidor.");
  socket.onclose = () => {
    if (!falloInformado) cerrar();
  };
  return socket;
}

export function enviarCarta(
  socket: WebSocket,
  matchId: string,
  actionId: string,
  expectedVersion: number,
  card: Carta,
): void {
  enviarAccion(socket, matchId, actionId, expectedVersion, { type: "play-card", card });
}

export function enviarAccion(
  socket: WebSocket,
  matchId: string,
  actionId: string,
  expectedVersion: number,
  action: AccionWeb,
): void {
  socket.send(
    JSON.stringify({
      type: "game.action",
      matchId,
      actionId,
      expectedVersion,
      action,
    }),
  );
}

export function suscribir(socket: WebSocket, matchId: string): void {
  socket.send(JSON.stringify({ type: "subscribe", matchId }));
}
