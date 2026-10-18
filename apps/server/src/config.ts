export type ConfiguracionServidor = Readonly<{ host: string; puerto: number }>;

export function leerConfiguracion(env: NodeJS.ProcessEnv): ConfiguracionServidor {
  const host = env.TRUCO_SERVER_HOST ?? "127.0.0.1";
  if (!host.trim() || host !== host.trim()) {
    throw new Error(
      "TRUCO_SERVER_HOST debe ser una dirección o nombre de host no vacío, sin espacios externos.",
    );
  }

  const valor = env.TRUCO_SERVER_PORT ?? "3000";
  if (!/^\d+$/.test(valor)) {
    throw new Error("TRUCO_SERVER_PORT debe ser un entero entre 0 y 65535.");
  }
  const puerto = Number(valor);
  if (!Number.isSafeInteger(puerto) || puerto > 65535) {
    throw new Error("TRUCO_SERVER_PORT debe ser un entero entre 0 y 65535.");
  }
  return { host, puerto };
}
