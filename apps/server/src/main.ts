import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { leerConfiguracion } from "./config.js";
import { crearServidor } from "./server.js";

function iniciar(): void {
  const { host, puerto } = leerConfiguracion(process.env);
  const servidor = crearServidor();
  let cerrando = false;

  servidor.on("error", (error) => {
    console.error(`Error del servidor: ${error.message}`);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      if (cerrando) return;
      cerrando = true;
      servidor.close((error) => {
        if (error) {
          console.error(`No se pudo cerrar el servidor: ${error.message}`);
          process.exitCode = 1;
        } else {
          console.log("Servidor detenido.");
        }
      });
    });
  }
  servidor.listen(puerto, host, () => {
    const direccion = servidor.address();
    if (direccion && typeof direccion !== "string") {
      console.log(`Servidor escuchando en ${direccion.address}:${direccion.port}`);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    iniciar();
  } catch (error) {
    console.error(
      `Configuración inválida: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
