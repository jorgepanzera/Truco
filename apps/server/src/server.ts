import { createServer, type Server } from "node:http";

/** Crea el servidor sin abrir un puerto. */
export function crearServidor(): Server {
  return createServer((request, response) => {
    const ruta = request.url?.split("?", 1)[0];
    if (ruta !== "/health") {
      response.writeHead(404);
      response.end();
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "truco-server" }));
  });
}
