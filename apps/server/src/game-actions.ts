import { esCarta, type AccionCoordinada } from "@truco/game-engine";
import type { CantoEnvido } from "@truco/game-engine";
import type { Carta } from "@truco/shared";

export type AccionRed =
  | Readonly<{ type: "play-card"; card: unknown }>
  | Readonly<{ type: "envido" | "raise-envido"; canto: unknown }>
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

export function esAccionRed(valor: unknown): valor is AccionRed {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const accion = valor as { type?: unknown; card?: unknown; canto?: unknown };
  if (accion.type === "play-card") return esCarta(accion.card);
  if (accion.type === "envido" || accion.type === "raise-envido")
    return (
      accion.canto === "envido" || accion.canto === "real-envido" || accion.canto === "falta-envido"
    );
  return [
    "announce-flor",
    "contra-flor",
    "contra-flor-al-resto",
    "accept-contra-flor",
    "reject-contra-flor",
    "accept-contra-flor-al-resto",
    "reject-contra-flor-al-resto",
    "accept-envido",
    "reject-envido",
    "con-flor-quiero",
    "go-to-mazo",
    "truco",
    "accept-truco",
    "reject-truco",
    "retruco",
    "accept-retruco",
    "reject-retruco",
    "vale-cuatro",
    "accept-vale-cuatro",
    "reject-vale-cuatro",
  ].includes(accion.type as string);
}

/** Traduce intención de red; nunca acepta un jugador ni estado provistos por el cliente. */
export function aAccionCoordinada(accion: AccionRed, jugador: string): AccionCoordinada {
  switch (accion.type) {
    case "play-card":
      return { tipo: "jugar-carta", jugador, carta: accion.card as Carta };
    case "envido":
      return { tipo: "iniciar-envido", jugador, canto: accion.canto as CantoEnvido };
    case "raise-envido":
      return { tipo: "aumentar-envido", jugador, canto: accion.canto as CantoEnvido };
    case "announce-flor":
      return { tipo: "anunciar-flor", jugador };
    case "contra-flor":
      return { tipo: "proponer-contra-flor", jugador };
    case "contra-flor-al-resto":
      return { tipo: "proponer-contra-flor-al-resto", jugador };
    case "accept-contra-flor":
      return { tipo: "quiero-contra-flor", jugador };
    case "reject-contra-flor":
      return { tipo: "no-quiero-contra-flor", jugador };
    case "accept-contra-flor-al-resto":
      return { tipo: "quiero-contra-flor-al-resto", jugador };
    case "reject-contra-flor-al-resto":
      return { tipo: "no-quiero-contra-flor-al-resto", jugador };
    case "accept-envido":
      return { tipo: "quiero-envido", jugador };
    case "reject-envido":
      return { tipo: "no-quiero-envido", jugador };
    case "con-flor-quiero":
      return { tipo: "con-flor-quiero", jugador };
    case "go-to-mazo":
      return { tipo: "irse-al-mazo", jugador };
    case "truco":
      return { tipo: "proponer-truco", jugador };
    case "accept-truco":
      return { tipo: "quiero-truco", jugador };
    case "reject-truco":
      return { tipo: "no-quiero-truco", jugador };
    case "retruco":
      return { tipo: "proponer-retruco", jugador };
    case "accept-retruco":
      return { tipo: "quiero-retruco", jugador };
    case "reject-retruco":
      return { tipo: "no-quiero-retruco", jugador };
    case "vale-cuatro":
      return { tipo: "proponer-vale-cuatro", jugador };
    case "accept-vale-cuatro":
      return { tipo: "quiero-vale-cuatro", jugador };
    case "reject-vale-cuatro":
      return { tipo: "no-quiero-vale-cuatro", jugador };
  }
}
