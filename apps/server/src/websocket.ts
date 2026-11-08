import type { Server, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { esAccionRed } from "./game-actions.js";
import { ErrorDeOperacion, RepositorioPartidasEnMemoria, type SesionInvitado } from "./matches.js";

type Conexion = { socket: WebSocket; sesion: SesionInvitado | null; suscripciones: Set<string> };
const MAXIMO_MENSAJE = 16 * 1024;

function enviar(socket: WebSocket, mensaje: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(mensaje));
}

function error(socket: WebSocket, codigo: string, mensaje: string): void {
  enviar(socket, { type: "error", code: codigo, message: mensaje });
}

function parsear(datos: RawData, esBinario: boolean): unknown {
  const buffer = Buffer.isBuffer(datos)
    ? datos
    : Array.isArray(datos)
      ? Buffer.concat(datos)
      : Buffer.from(datos);
  if (esBinario || buffer.length > MAXIMO_MENSAJE) return null;
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    return null;
  }
}

/** Transporte de 6B: auth inicial, suscripción privada y acciones versionadas. */
export function instalarWebSocket(
  servidor: Server,
  repositorio: RepositorioPartidasEnMemoria,
): void {
  const websocket = new WebSocketServer({ noServer: true, maxPayload: MAXIMO_MENSAJE });
  const conexiones = new Set<Conexion>();
  const porPartida = new Map<string, Set<Conexion>>();
  servidor.on("upgrade", (solicitud, socket, cabeza) => {
    if (new URL(solicitud.url ?? "/", "http://localhost").pathname !== "/ws") {
      socket.destroy();
      return;
    }
    websocket.handleUpgrade(solicitud, socket, cabeza, (cliente) =>
      websocket.emit("connection", cliente, solicitud),
    );
  });
  websocket.on("connection", (socket: WebSocket, _solicitud: IncomingMessage) => {
    void _solicitud;
    const conexion: Conexion = { socket, sesion: null, suscripciones: new Set() };
    conexiones.add(conexion);
    const plazo = setTimeout(() => {
      if (!conexion.sesion) socket.close(1008, "authentication required");
    }, 5000);
    socket.on("message", (datos, esBinario) => {
      let tipoEntrada = "desconocido";
      try {
        const mensaje = parsear(datos, esBinario);
        if (!mensaje || typeof mensaje !== "object" || Array.isArray(mensaje))
          return error(socket, "protocolo-invalido", "Mensaje inválido.");
        const entrada = mensaje as Record<string, unknown>;
        if (typeof entrada.type === "string") tipoEntrada = entrada.type;
        if (entrada.type === "auth") {
          if (conexion.sesion || typeof entrada.token !== "string")
            return error(socket, "autenticacion-invalida", "Autenticación inválida.");
          try {
            conexion.sesion = repositorio.autenticar(entrada.token);
          } catch (causa) {
            if (causa instanceof ErrorDeOperacion)
              error(socket, causa.detalle.codigo, causa.detalle.mensaje);
            else error(socket, "autenticacion-invalida", "Autenticación inválida.");
            socket.close(1008, "authentication failed");
            return;
          }
          clearTimeout(plazo);
          return enviar(socket, { type: "auth.ok", nickname: conexion.sesion.apodo });
        }
        if (!conexion.sesion)
          return error(socket, "no-autenticado", "Autenticate antes de continuar.");
        if (entrada.type === "subscribe") {
          if (typeof entrada.matchId !== "string")
            return error(socket, "protocolo-invalido", "matchId inválido.");
          const snapshot = repositorio.snapshot(entrada.matchId, conexion.sesion);
          conexion.suscripciones.add(entrada.matchId);
          const grupo = porPartida.get(entrada.matchId) ?? new Set<Conexion>();
          grupo.add(conexion);
          porPartida.set(entrada.matchId, grupo);
          return enviar(socket, { type: "game.snapshot", snapshot });
        }
        if (
          entrada.type !== "game.action" ||
          typeof entrada.matchId !== "string" ||
          typeof entrada.actionId !== "string" ||
          !Number.isInteger(entrada.expectedVersion) ||
          !conexion.suscripciones.has(entrada.matchId) ||
          !esAccionRed(entrada.action)
        )
          return error(socket, "protocolo-invalido", "Acción o suscripción inválida.");
        const resultado = repositorio.aplicarAccion(entrada.matchId, conexion.sesion, {
          actionId: entrada.actionId,
          expectedVersion: entrada.expectedVersion as number,
          action: entrada.action,
        });
        if (!resultado.aceptada)
          return enviar(socket, {
            type: "game.rejected",
            actionId: entrada.actionId,
            code: resultado.codigo,
            version: resultado.version,
          });
        enviar(socket, {
          type: "game.confirmed",
          actionId: entrada.actionId,
          version: resultado.version,
        });
        for (const destino of porPartida.get(entrada.matchId) ?? []) {
          if (!destino.sesion) continue;
          enviar(destino.socket, {
            type: "game.snapshot",
            snapshot: repositorio.snapshot(entrada.matchId, destino.sesion),
          });
        }
      } catch (causa) {
        if (causa instanceof ErrorDeOperacion)
          error(socket, causa.detalle.codigo, causa.detalle.mensaje);
        else {
          console.error("Error inesperado al procesar WebSocket", {
            tipoAccion: tipoEntrada,
            error: causa instanceof Error ? causa.message : String(causa),
          });
          error(socket, "error-interno", "No se pudo procesar el mensaje.");
        }
      }
    });
    socket.on("close", () => {
      clearTimeout(plazo);
      conexiones.delete(conexion);
      for (const matchId of conexion.suscripciones) {
        const grupo = porPartida.get(matchId);
        grupo?.delete(conexion);
        if (grupo?.size === 0) porPartida.delete(matchId);
      }
    });
  });
}
