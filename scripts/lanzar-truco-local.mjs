import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const puerto = 3000;
const url = `http://${host}:${puerto}`;
const entradaServidor = resolve(raiz, "apps/server/dist/main.js");
const indiceWeb = resolve(raiz, "apps/web/dist/index.html");
const directorioLogs = resolve(raiz, "logs");
const archivoLog = resolve(directorioLogs, "servidor.log");

function abortar(mensaje) {
  console.error(`\nError: ${mensaje}`);
  process.exitCode = 1;
}

function instalacionLista() {
  return existsSync(entradaServidor) && existsSync(indiceWeb);
}

function consultarSalud() {
  return new Promise((resolveSalud) => {
    const solicitud = request(`${url}/health`, { method: "GET", timeout: 500 }, (respuesta) => {
      let cuerpo = "";
      respuesta.setEncoding("utf8");
      respuesta.on("data", (parte) => {
        cuerpo += parte;
      });
      respuesta.on("end", () => {
        resolveSalud(
          respuesta.statusCode === 200 &&
            cuerpo.includes('"status":"ok"') &&
            cuerpo.includes('"service":"truco-server"'),
        );
      });
    });
    solicitud.once("timeout", () => solicitud.destroy());
    solicitud.once("error", () => resolveSalud(false));
    solicitud.end();
  });
}

function esperar(milisegundos) {
  return new Promise((resolveEspera) => setTimeout(resolveEspera, milisegundos));
}

function abrirNavegador() {
  const proceso = spawn("cmd.exe", ["/d", "/s", "/c", `start "" "${url}"`], {
    detached: true,
    stdio: "ignore",
  });
  proceso.unref();
}

function ultimasLineasLog() {
  try {
    return readFileSync(archivoLog, "utf8").split(/\r?\n/).slice(-12).join("\n").trim();
  } catch {
    return "Sin detalles adicionales en el registro.";
  }
}

async function iniciar() {
  if (!instalacionLista()) {
    abortar("La instalacion no esta preparada. Ejecuta INSTALAR_TRUCO.bat primero.");
    return;
  }
  if (await consultarSalud()) {
    console.log("Truco ya esta abierto. Se reutiliza la instancia local existente.");
    abrirNavegador();
    return;
  }

  mkdirSync(directorioLogs, { recursive: true });
  const log = createWriteStream(archivoLog, { flags: "w" });
  const servidor = spawn(process.execPath, [entradaServidor], {
    cwd: raiz,
    env: {
      ...process.env,
      TRUCO_LAUNCHER_PID: String(process.pid),
      TRUCO_SERVER_HOST: host,
      TRUCO_SERVER_PORT: String(puerto),
    },
    stdio: ["ignore", log, log],
  });
  let cerrando = false;
  const detener = () => {
    if (cerrando) return;
    cerrando = true;
    if (servidor.exitCode === null) servidor.kill();
  };
  process.once("SIGINT", detener);
  process.once("SIGTERM", detener);

  for (let intento = 0; intento < 40; intento++) {
    if (servidor.exitCode !== null) {
      log.end();
      abortar(`No se pudo iniciar Truco en el puerto ${puerto}.\n${ultimasLineasLog()}`);
      return;
    }
    if (await consultarSalud()) {
      console.log(`Truco esta listo en ${url}.`);
      console.log("El navegador se abrira ahora. Para detener el juego, cierra esta ventana.");
      abrirNavegador();
      await new Promise((resolveSalida) => servidor.once("exit", resolveSalida));
      log.end();
      if (!cerrando) abortar(`El servidor se detuvo inesperadamente. Revisa ${archivoLog}.`);
      return;
    }
    await esperar(250);
  }
  detener();
  log.end();
  abortar(`Truco no respondio en ${url}. Revisa ${archivoLog}.`);
}

await iniciar();
