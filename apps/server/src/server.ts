import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { ErrorDeOperacion, RepositorioPartidasEnMemoria, type FuenteAleatoria } from "./matches.js";
import { instalarWebSocket } from "./websocket.js";

const LIMITE_CUERPO_BYTES = 16 * 1024;
type OpcionesServidor = Readonly<{ aleatoriedad?: FuenteAleatoria }>;
type CuerpoJson = Readonly<Record<string, unknown>>;

class ErrorHttp extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

function responderJson(respuesta: ServerResponse, estado: number, cuerpo: unknown): void {
  respuesta.writeHead(estado, { "Content-Type": "application/json" });
  respuesta.end(JSON.stringify(cuerpo));
}

function responderError(respuesta: ServerResponse, error: unknown): void {
  if (error instanceof ErrorDeOperacion) {
    const estados = {
      "solicitud-invalida": 400,
      "no-autenticado": 401,
      "no-autorizado": 403,
      "no-encontrado": 404,
      conflicto: 409,
    } as const;
    responderJson(respuesta, estados[error.detalle.codigo], { error: error.detalle });
    return;
  }
  if (error instanceof ErrorHttp) {
    responderJson(respuesta, error.estado, {
      error: { codigo: error.codigo, mensaje: error.message },
    });
    return;
  }
  responderJson(respuesta, 500, {
    error: { codigo: "error-interno", mensaje: "No se pudo procesar la solicitud." },
  });
}

async function leerCuerpoJson(solicitud: IncomingMessage): Promise<CuerpoJson> {
  const partes: Buffer[] = [];
  let tamano = 0;
  for await (const parte of solicitud) {
    const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
    tamano += buffer.length;
    if (tamano > LIMITE_CUERPO_BYTES)
      throw new ErrorHttp(400, "cuerpo-demasiado-grande", "El cuerpo supera el límite permitido.");
    partes.push(buffer);
  }
  if (tamano === 0) return {};
  let valor: unknown;
  try {
    valor = JSON.parse(Buffer.concat(partes).toString("utf8"));
  } catch {
    throw new ErrorHttp(400, "json-invalido", "El cuerpo debe ser JSON válido.");
  }
  if (valor === null || typeof valor !== "object" || Array.isArray(valor))
    throw new ErrorHttp(400, "solicitud-invalida", "El cuerpo debe ser un objeto JSON.");
  return valor as CuerpoJson;
}

function exigirSoloCampos(cuerpo: CuerpoJson, campos: readonly string[]): void {
  if (Object.keys(cuerpo).some((campo) => !campos.includes(campo)))
    throw new ErrorHttp(400, "solicitud-invalida", "La solicitud contiene campos no admitidos.");
}

function tokenBearer(solicitud: IncomingMessage): string | null {
  const valor = solicitud.headers.authorization;
  if (!valor || !/^Bearer [A-Za-z0-9_-]+$/.test(valor)) return null;
  return valor.slice("Bearer ".length);
}

function idDePartida(ruta: string): string | null {
  const coincidencia = /^\/api\/matches\/([A-Za-z0-9_-]+)(?:\/(join|start))?$/.exec(ruta);
  return coincidencia?.[1] ?? null;
}

/** Crea el HTTP de 6A sin abrir un puerto. El estado en memoria vive con este servidor. */
export function crearServidor(opciones: OpcionesServidor = {}): Server {
  const repositorio = new RepositorioPartidasEnMemoria(opciones.aleatoriedad);
  const servidor = createServer(async (solicitud, respuesta) => {
    const url = new URL(solicitud.url ?? "/", "http://localhost");
    const ruta = url.pathname;
    const metodo = solicitud.method ?? "GET";
    try {
      if (ruta === "/health") {
        if (metodo !== "GET") return metodoNoPermitido(respuesta, "GET");
        responderJson(respuesta, 200, { status: "ok", service: "truco-server" });
        return;
      }
      if (ruta === "/api/guest-sessions") {
        if (metodo !== "POST") return metodoNoPermitido(respuesta, "POST");
        const cuerpo = await leerCuerpoJson(solicitud);
        exigirSoloCampos(cuerpo, ["nickname"]);
        responderJson(respuesta, 201, repositorio.crearSesion(cuerpo.nickname));
        return;
      }
      if (ruta === "/api/matches") {
        if (metodo !== "POST") return metodoNoPermitido(respuesta, "POST");
        const sesion = repositorio.autenticar(tokenBearer(solicitud));
        const cuerpo = await leerCuerpoJson(solicitud);
        exigirSoloCampos(cuerpo, ["targetScore", "mode"]);
        if (cuerpo.mode !== undefined && cuerpo.mode !== "1v1")
          throw new ErrorHttp(400, "solicitud-invalida", "La única modalidad disponible es 1v1.");
        const metaPuntos = cuerpo.targetScore === undefined ? 40 : cuerpo.targetScore;
        if (metaPuntos !== 30 && metaPuntos !== 40)
          throw new ErrorHttp(400, "solicitud-invalida", "targetScore debe ser 30 o 40.");
        const partida = repositorio.crearPartida(sesion, metaPuntos);
        responderJson(respuesta, 201, {
          matchId: partida.id,
          asiento: 0,
          snapshot: repositorio.snapshot(partida.id, sesion),
        });
        return;
      }
      const matchId = idDePartida(ruta);
      if (matchId) {
        const operacion = ruta.endsWith("/join")
          ? "join"
          : ruta.endsWith("/start")
            ? "start"
            : "get";
        if (operacion === "get") {
          if (metodo !== "GET") return metodoNoPermitido(respuesta, "GET");
          const sesion = repositorio.autenticar(tokenBearer(solicitud));
          responderJson(respuesta, 200, repositorio.snapshot(matchId, sesion));
          return;
        }
        if (metodo !== "POST") return metodoNoPermitido(respuesta, "POST");
        const sesion = repositorio.autenticar(tokenBearer(solicitud));
        const cuerpo = await leerCuerpoJson(solicitud);
        exigirSoloCampos(cuerpo, []);
        if (operacion === "join") {
          const ingreso = repositorio.unirse(matchId, sesion);
          responderJson(respuesta, 200, {
            matchId,
            asiento: ingreso.asiento,
            snapshot: repositorio.snapshot(matchId, sesion),
          });
          return;
        }
        repositorio.iniciar(matchId, sesion);
        responderJson(respuesta, 200, repositorio.snapshot(matchId, sesion));
        return;
      }
      respuesta.writeHead(404);
      respuesta.end();
    } catch (error) {
      responderError(respuesta, error);
    }
  });
  instalarWebSocket(servidor, repositorio);
  return servidor;
}

function metodoNoPermitido(respuesta: ServerResponse, permitido: string): void {
  respuesta.writeHead(405, { Allow: permitido });
  respuesta.end();
}
