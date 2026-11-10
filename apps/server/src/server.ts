import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ErrorDeOperacion, RepositorioPartidasEnMemoria, type FuenteAleatoria } from "./matches.js";
import type { PoliticaEstrategica } from "@truco/game-engine";
import { instalarWebSocket } from "./websocket.js";

const LIMITE_CUERPO_BYTES = 16 * 1024;
type OpcionesServidor = Readonly<{
  aleatoriedad?: FuenteAleatoria;
  politicaAutomatica?: PoliticaEstrategica;
  /** Directorio de la web compilada; se inyecta en pruebas. */
  directorioWeb?: string;
}>;
type CuerpoJson = Readonly<Record<string, unknown>>;
const DIRECTORIO_WEB_PREDETERMINADO = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../web/dist",
);
const TIPOS_CONTENIDO: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

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
  const coincidencia = /^\/api\/matches\/([A-Za-z0-9_-]+)(?:\/(join|start|abandon))?$/.exec(ruta);
  return coincidencia?.[1] ?? null;
}

function esRutaProtegida(ruta: string): boolean {
  return ruta === "/api" || ruta.startsWith("/api/") || ruta === "/ws" || ruta.startsWith("/ws/");
}

function tipoContenido(archivo: string): string {
  return TIPOS_CONTENIDO[extname(archivo).toLowerCase()] ?? "application/octet-stream";
}

async function servirWebCompilada(
  solicitud: IncomingMessage,
  respuesta: ServerResponse,
  ruta: string,
  directorioWeb: string,
): Promise<boolean> {
  const metodo = solicitud.method ?? "GET";
  if (metodo !== "GET" && metodo !== "HEAD") return false;
  if (esRutaProtegida(ruta)) return false;

  let relativa: string;
  try {
    relativa = decodeURIComponent(ruta).replace(/^[/\\]+/, "") || "index.html";
  } catch {
    respuesta.writeHead(400);
    respuesta.end();
    return true;
  }
  const raiz = resolve(directorioWeb);
  const candidato = resolve(raiz, relativa);
  const dentroDeRaiz = candidato === raiz || candidato.startsWith(`${raiz}${sep}`);
  if (!dentroDeRaiz) {
    respuesta.writeHead(404);
    respuesta.end();
    return true;
  }

  const esRecurso = extname(relativa) !== "";
  let archivo = candidato;
  try {
    if (!(await stat(archivo)).isFile()) throw new Error("No es un archivo.");
  } catch {
    if (esRecurso) {
      respuesta.writeHead(404);
      respuesta.end();
      return true;
    }
    archivo = resolve(raiz, "index.html");
    try {
      if (!(await stat(archivo)).isFile()) throw new Error("No existe el índice.");
    } catch {
      return false;
    }
  }

  try {
    const contenido = metodo === "HEAD" ? undefined : await readFile(archivo);
    respuesta.writeHead(200, {
      "Content-Type": tipoContenido(archivo),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": archivo.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    });
    respuesta.end(contenido);
    return true;
  } catch {
    respuesta.writeHead(404);
    respuesta.end();
    return true;
  }
}

/** Crea el HTTP de 6A sin abrir un puerto. El estado en memoria vive con este servidor. */
export function crearServidor(opciones: OpcionesServidor = {}): Server {
  const repositorio = new RepositorioPartidasEnMemoria(
    opciones.aleatoriedad,
    opciones.politicaAutomatica,
  );
  const directorioWeb = opciones.directorioWeb ?? DIRECTORIO_WEB_PREDETERMINADO;
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
        if (cuerpo.mode !== undefined && cuerpo.mode !== "1v1" && cuerpo.mode !== "1v1-vs-machine")
          throw new ErrorHttp(400, "solicitud-invalida", "La única modalidad disponible es 1v1.");
        const metaPuntos = cuerpo.targetScore === undefined ? 40 : cuerpo.targetScore;
        if (metaPuntos !== 30 && metaPuntos !== 40)
          throw new ErrorHttp(400, "solicitud-invalida", "targetScore debe ser 30 o 40.");
        const partida = repositorio.crearPartida(
          sesion,
          metaPuntos,
          cuerpo.mode === "1v1-vs-machine",
        );
        responderJson(respuesta, 201, {
          matchId: partida.id,
          asiento: 0,
          snapshot: repositorio.snapshot(partida.id, sesion),
        });
        return;
      }
      const matchId = idDePartida(ruta);
      if (matchId) {
        const operacion = ruta.endsWith("/abandon")
          ? "abandon"
          : ruta.endsWith("/join")
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
        if (operacion === "abandon") {
          if (metodo !== "DELETE") return metodoNoPermitido(respuesta, "DELETE");
          const sesion = repositorio.autenticar(tokenBearer(solicitud));
          repositorio.abandonar(matchId, sesion);
          respuesta.writeHead(204);
          respuesta.end();
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
      if (await servirWebCompilada(solicitud, respuesta, ruta, directorioWeb)) return;
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
