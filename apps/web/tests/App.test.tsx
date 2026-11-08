// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { Carta } from "../src/Carta.js";
import { textoMotivoCierre } from "../src/MesaDeTruco.js";

class SocketDePrueba {
  static instancias: SocketDePrueba[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(readonly url: string) {
    SocketDePrueba.instancias.push(this);
  }

  abrir() {
    this.onopen?.(new Event("open"));
  }

  recibir(mensaje: unknown) {
    this.onmessage?.({ data: JSON.stringify(mensaje) } as MessageEvent);
  }

  fallar() {
    this.onerror?.(new Event("error"));
  }
}

const respuesta = (cuerpo: unknown) => ({ ok: true, json: async () => cuerpo }) as Response;

const snapshotEspera = {
  estado: "esperando",
  matchId: "m_prueba",
  modalidad: "1v1",
  metaPuntos: 40,
  version: 0,
  asientoPropio: 0,
  participantes: [{ asiento: 0, apodo: "Ana" }],
};
const snapshotIniciado = (version: number) => ({
  estado: "iniciada" as const,
  matchId: "m_prueba",
  modalidad: "1v1" as const,
  metaPuntos: 40 as const,
  version,
  idMano: "mano-2",
  asientoPropio: 0,
  participantes: [
    { asiento: 0, apodo: "Ana" },
    { asiento: 1, apodo: "Máquina", automatico: true },
  ],
  marcador: [
    { asiento: 0, puntos: 7 },
    { asiento: 1, puntos: 4 },
  ],
  resultadoPartida: null,
  repartidor: 1,
  muestra: { valor: 7 as const, palo: "oro" as const },
  cartasPropias: [
    { valor: 1 as const, palo: "espada" as const },
    { valor: 3 as const, palo: "basto" as const },
    { valor: 12 as const, palo: "copa" as const },
  ],
  cartasRivalesRestantes: 2,
  accionesDisponibles: [
    { type: "play-card" as const, card: { valor: 1 as const, palo: "espada" as const } },
    { type: "play-card" as const, card: { valor: 3 as const, palo: "basto" as const } },
    { type: "play-card" as const, card: { valor: 12 as const, palo: "copa" as const } },
    { type: "truco" as const },
    { type: "go-to-mazo" as const },
  ],
  continuacion: null,
  eventosPublicos: [],
  bazasCompletadas: [],
  bazaActual: {
    asientoGanador: null,
    jugadas: [
      { asiento: 0, carta: { valor: 4 as const, palo: "oro" as const } },
      { asiento: 1, carta: { valor: 6 as const, palo: "copa" as const } },
    ],
  },
  desafiosPendientes: { envido: null, flor: null, truco: null, oportunidadFlorPropia: false },
  ultimoCierre: null,
  turno: 0,
});

async function montar() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => root.render(<App />));
  return { container, root };
}

async function iniciar(container: HTMLElement) {
  const input = container.querySelector("input") as HTMLInputElement;
  const formulario = container.querySelector("form") as HTMLFormElement;
  await act(async () => {
    input.value = "Ana";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    formulario.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  SocketDePrueba.instancias = [];
  document.body.replaceChildren();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe("pantalla de partida", () => {
  it("traduce todas las causas conocidas del cierre de mano", () => {
    expect(textoMotivoCierre("bazas")).toBe("definición por bazas");
    expect(textoMotivoCierre("rechazo-truco")).toBe("rechazo del Truco");
    expect(textoMotivoCierre("mazo")).toBe("retiro al mazo");
    expect(textoMotivoCierre("contra-flor-al-resto")).toBe("Contra Flor al resto");
    expect(textoMotivoCierre("causa-desconocida")).toBe("cierre de mano");
  });

  it("usa los 40 SVG de la baraja española, incluidas sota, caballo y rey", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const palos = { oro: "coins", copa: "cups", espada: "swords", basto: "clubs" } as const;
    const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      await act(async () =>
        root.render(
          <>
            {Object.entries(palos).flatMap(([palo, archivo]) =>
              valores.map((valor) => (
                <Carta
                  carta={{ palo: palo as keyof typeof palos, valor }}
                  key={`${palo}-${valor}`}
                />
              )),
            )}
          </>,
        ),
      );
      const imagenes = [...container.querySelectorAll<HTMLImageElement>(".carta__ilustracion")];
      expect(imagenes).toHaveLength(40);
      for (const [palo, archivo] of Object.entries(palos)) {
        for (const valor of valores)
          expect(
            imagenes.some((imagen) =>
              imagen.src.includes(`card_${archivo}_${String(valor).padStart(2, "0")}.svg`),
            ),
          ).toBe(true);
        expect(imagenes.find((imagen) => imagen.src.includes(`card_${archivo}_10.svg`))?.alt).toBe(
          `Sota de ${palo}`,
        );
        expect(imagenes.find((imagen) => imagen.src.includes(`card_${archivo}_11.svg`))?.alt).toBe(
          `Caballo de ${palo}`,
        );
        expect(imagenes.find((imagen) => imagen.src.includes(`card_${archivo}_12.svg`))?.alt).toBe(
          `Rey de ${palo}`,
        );
      }
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("representa el snapshot autorizado y conserva la conexión existente", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
      .mockResolvedValueOnce(respuesta({ snapshot: snapshotEspera }));
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();

    try {
      expect(container.querySelector("h1")?.textContent).toBe("Truco Uruguayo");
      await iniciar(container);

      const socket = SocketDePrueba.instancias[0];
      expect(socket.url).toMatch(/^ws:\/\/localhost(?::\d+)?\/ws$/);
      await act(async () => socket.abrir());
      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "auth", token: "token-privado" }),
      );

      await act(async () => socket.recibir({ type: "auth.ok" }));
      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "subscribe", matchId: "m_prueba" }),
      );

      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: snapshotIniciado(2),
        }),
      );
      expect(container.textContent).toContain("Ana");
      expect(container.textContent).toContain("Máquina");
      expect(container.textContent).toContain("7 pts");
      expect(container.textContent).toContain("4 pts");
      expect(container.textContent).toContain("Su turno");
      expect(container.querySelectorAll(".mano-propia .carta")).toHaveLength(3);
      expect(container.querySelectorAll(".carta--dorso")).toHaveLength(2);
      expect(
        [...container.querySelectorAll<HTMLImageElement>(".carta--dorso img")].every((imagen) =>
          imagen.src.includes("card_back.svg"),
        ),
      ).toBe(true);
      expect(container.querySelector('img[alt="7 de oro"]')).not.toBeNull();
      expect(container.querySelectorAll(".cartas-jugadas .carta")).toHaveLength(2);
      expect(container.textContent).not.toContain("token-privado");
      const accionesVisibles = [...container.querySelectorAll<HTMLButtonElement>("button")].map(
        (boton) => boton.textContent,
      );
      expect(accionesVisibles).not.toContain("Envido");
      expect(accionesVisibles).not.toContain("Real Envido");
      expect(accionesVisibles).not.toContain("Falta Envido");

      const carta = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Jugar 1 de espada"]',
      );
      expect(carta).not.toBeNull();
      await act(async () => carta?.click());
      await act(async () => carta?.click());
      expect(socket.send).toHaveBeenCalledTimes(3);
      expect(JSON.parse(socket.send.mock.calls[2]?.[0] as string)).toMatchObject({
        type: "game.action",
        matchId: "m_prueba",
        expectedVersion: 2,
        action: { type: "play-card", card: { valor: 1, palo: "espada" } },
      });
      expect(container.textContent).toContain("Esperando confirmación de la jugada.");
      await act(async () =>
        socket.recibir({
          type: "game.rejected",
          actionId: "play-1",
          code: "turno-invalido",
          version: 2,
        }),
      );
      expect(container.textContent).toContain("Jugada rechazada: turno-invalido.");
      await act(async () => carta?.click());
      await act(async () =>
        socket.recibir({
          type: "error",
          code: "error-interno",
          message: "No se pudo procesar el mensaje.",
        }),
      );
      expect(container.textContent).toContain("No se pudo procesar el mensaje.");
      expect(
        container.querySelectorAll<HTMLButtonElement>(".mano-propia button:disabled"),
      ).toHaveLength(0);
      await act(async () => carta?.click());
      await act(async () =>
        socket.recibir({ type: "game.confirmed", actionId: "play-3", version: 3 }),
      );
      expect(container.textContent).toContain("Jugada confirmada.");

      const cierre = {
        ...snapshotIniciado(6),
        idMano: "mano-2",
        marcador: [
          { asiento: 0, puntos: 2 },
          { asiento: 1, puntos: 0 },
        ],
        ultimoCierre: {
          idMano: "mano-2",
          version: 5,
          asientoGanador: 0,
          equipo: "equipo-0",
          puntos: 2,
          causa: "bazas",
          bazas: [
            {
              asientoGanador: 0,
              jugadas: [
                { asiento: 0, carta: { valor: 1 as const, palo: "espada" as const } },
                { asiento: 1, carta: { valor: 7 as const, palo: "oro" as const } },
              ],
            },
          ],
        },
      };
      await act(async () => socket.recibir({ type: "game.snapshot", snapshot: cierre }));
      expect(container.textContent).toContain("¡Ganaste la mano!");
      expect(container.textContent).not.toContain("+2 puntos");
      expect(container.textContent).toContain("Ana: 2 \u2014 M\u00e1quina: 0");
      expect(container.textContent).toContain("Motivo: definici\u00f3n por bazas");
      expect(
        container.querySelectorAll<HTMLButtonElement>(".mano-propia button:disabled"),
      ).toHaveLength(3);
      await act(async () => socket.recibir({ type: "game.snapshot", snapshot: cierre }));
      expect(container.querySelectorAll('[aria-label="Resultado de la mano"]')).toHaveLength(1);
      const continuar = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
        (boton) => boton.textContent === "Continuar",
      );
      await act(async () => continuar?.click());
      expect(container.querySelector('[aria-label="Resultado de la mano"]')).toBeNull();
      const cartaNuevaMano = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Jugar 1 de espada"]',
      );
      await act(async () => cartaNuevaMano?.click());
      expect(JSON.parse(socket.send.mock.calls.at(-1)?.[0] as string)).toMatchObject({
        type: "game.action",
        expectedVersion: 6,
        action: { type: "play-card", card: { valor: 1, palo: "espada" } },
      });
      await act(async () =>
        socket.recibir({
          type: "game.rejected",
          actionId: "play-4",
          code: "version-obsoleta",
          version: 7,
        }),
      );
      expect(container.textContent).toContain(
        "La partida se actualizó. Volvé a seleccionar una carta.",
      );
      expect(JSON.parse(socket.send.mock.calls.at(-1)?.[0] as string)).toEqual({
        type: "subscribe",
        matchId: "m_prueba",
      });

      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: snapshotIniciado(1),
        }),
      );
      expect(container.textContent).toContain("2 cartas públicas en mesa");

      const tresBazas = {
        ...snapshotIniciado(7),
        eventosPublicos: [
          { secuencia: 1, idMano: "mano-2", tipo: "carta-jugada", asiento: 0 },
          { secuencia: 2, idMano: "mano-2", tipo: "baza-resuelta" },
          { secuencia: 3, idMano: "mano-2", tipo: "baza-resuelta" },
          { secuencia: 4, idMano: "mano-2", tipo: "baza-resuelta" },
        ],
        bazasCompletadas: [
          {
            asientoGanador: 0,
            jugadas: [
              { asiento: 0, carta: { valor: 1 as const, palo: "espada" as const } },
              { asiento: 1, carta: { valor: 7 as const, palo: "oro" as const } },
            ],
          },
          {
            asientoGanador: 1,
            jugadas: [
              { asiento: 0, carta: { valor: 2 as const, palo: "copa" as const } },
              { asiento: 1, carta: { valor: 3 as const, palo: "basto" as const } },
            ],
          },
          {
            asientoGanador: null,
            jugadas: [
              { asiento: 0, carta: { valor: 4 as const, palo: "oro" as const } },
              { asiento: 1, carta: { valor: 4 as const, palo: "copa" as const } },
            ],
          },
        ],
        bazaActual: { asientoGanador: null, jugadas: [] },
        turno: 1,
      };
      await act(async () => socket.recibir({ type: "game.snapshot", snapshot: tresBazas }));
      expect(container.querySelectorAll(".bazas-completadas .anuncio-baza")).toHaveLength(3);
      expect(container.querySelectorAll(".mano-propia .carta")).toHaveLength(3);
      expect(container.textContent).toContain("Ganaste la baza 1.");
      expect(container.textContent).toContain("La máquina ganó la baza 2.");
      expect(container.textContent).toContain("La baza 3 terminó empatada.");
      expect(container.textContent).toContain("Ana ganó la primera baza.");
      expect(container.textContent).toContain("Máquina ganó la segunda baza.");
      expect(container.textContent).toContain("La tercera baza terminó empatada.");
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...tresBazas,
            version: 8,
            desafiosPendientes: {
              envido: null,
              flor: null,
              truco: { nivel: "truco", proponente: 1 },
              oportunidadFlorPropia: false,
            },
          },
        }),
      );
      expect(container.textContent).toContain("La máquina espera tu respuesta al Truco.");
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...tresBazas,
            version: 9,
            desafiosPendientes: {
              envido: null,
              flor: null,
              truco: { nivel: "retruco", proponente: 1 },
              oportunidadFlorPropia: false,
            },
          },
        }),
      );
      expect(container.textContent).toContain("La máquina espera tu respuesta al Retruco.");
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...tresBazas,
            version: 10,
            turno: null,
            desafiosPendientes: {
              envido: null,
              flor: null,
              truco: null,
              oportunidadFlorPropia: true,
            },
          },
        }),
      );
      expect(container.textContent).toContain("La partida espera que anuncies Flor");
      expect(container.textContent).not.toContain("respuesta al Truco");
      expect(container.textContent).not.toContain("respuesta al Retruco");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("no ofrece Envido al responder Truco después de Flor rival adjudicada", async () => {
    const trasFlorRival = {
      ...snapshotIniciado(12),
      idMano: "mano-8",
      marcador: [
        { asiento: 0, puntos: 0 },
        { asiento: 1, puntos: 3 },
      ],
      cartasPropias: snapshotIniciado(12).cartasPropias.slice(1),
      accionesDisponibles: [
        { type: "go-to-mazo" as const },
        { type: "accept-truco" as const },
        { type: "reject-truco" as const },
        { type: "retruco" as const },
      ],
      desafiosPendientes: {
        envido: null,
        flor: null,
        truco: { nivel: "truco" as const, proponente: 1 },
        oportunidadFlorPropia: false,
      },
      turno: 1,
      eventosPublicos: [
        {
          secuencia: 1,
          idMano: "mano-8",
          tipo: "flor-adjudicada",
          asientoGanador: 1,
          adjudicaciones: [
            { asientoGanador: 0, puntos: 0, causa: "sin-desafio" },
            { asientoGanador: 1, puntos: 3, causa: "sin-desafio" },
          ],
        },
        { secuencia: 2, idMano: "mano-8", tipo: "truco-propuesto", asiento: 1 },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(respuesta({ snapshot: trasFlorRival })),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();
    try {
      await iniciar(container);
      const etiquetas = [...container.querySelectorAll<HTMLButtonElement>("button")].map(
        (boton) => boton.textContent,
      );
      expect(etiquetas).toContain("Quiero");
      expect(etiquetas).toContain("No quiero");
      expect(etiquetas).toContain("Retruco");
      expect(etiquetas).not.toContain("Envido");
      expect(etiquetas).not.toContain("Real Envido");
      expect(etiquetas).not.toContain("Falta Envido");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("muestra Flor al responder Envido pendiente sin confundirla con Con Flor Quiero", async () => {
    const respuestaFlor = {
      ...snapshotIniciado(13),
      idMano: "mano-9",
      turno: 1,
      accionesDisponibles: [
        { type: "announce-flor" as const },
        { type: "accept-envido" as const },
        { type: "reject-envido" as const },
      ],
      desafiosPendientes: {
        envido: { proponente: 1, respondedor: 0, valor: 2 },
        flor: null,
        truco: null,
        oportunidadFlorPropia: false,
      },
      eventosPublicos: [
        {
          secuencia: 1,
          idMano: "mano-9",
          tipo: "envido-iniciado",
          asiento: 1,
          canto: "envido",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(respuesta({ snapshot: respuestaFlor })),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();
    try {
      await iniciar(container);
      const etiquetas = [...container.querySelectorAll<HTMLButtonElement>("button")].map(
        (boton) => boton.textContent,
      );
      expect(etiquetas).toContain("Flor");
      expect(etiquetas).toContain("Quiero");
      expect(etiquetas).toContain("No quiero");
      expect(etiquetas).not.toContain("Con Flor Quiero");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("muestra el error de conexión y cierra el socket al desmontar", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(respuesta({ snapshot: snapshotEspera })),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();

    await iniciar(container);
    const socket = SocketDePrueba.instancias[0];
    await act(async () => socket.fallar());
    expect(container.textContent).toContain("No se pudo conectar al servidor.");

    await act(() => root.unmount());
    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it("muestra un estado de espera cuando el snapshot todavía no inició la mano", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(respuesta({ snapshot: snapshotEspera })),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();

    try {
      await iniciar(container);
      expect(container.textContent).toContain("Esperando el inicio de la mano.");
      expect(container.textContent).toContain("Meta: 40 puntos");
    } finally {
      await act(() => root.unmount());
    }
  });

  it("prioriza el cierre autoritativo de partido y crea una partida independiente", async () => {
    const nueva = {
      ...snapshotIniciado(1),
      matchId: "m_nueva",
      marcador: [
        { asiento: 0, puntos: 0 },
        { asiento: 1, puntos: 0 },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(respuesta({ snapshot: snapshotEspera }))
        .mockResolvedValueOnce(respuesta({ token: "token-nuevo" }))
        .mockResolvedValueOnce(respuesta({ snapshot: nueva })),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();
    try {
      await iniciar(container);
      const socket = SocketDePrueba.instancias[0]!;
      await act(async () => socket.abrir());
      await act(async () => socket.recibir({ type: "auth.ok" }));
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...snapshotIniciado(20),
            marcador: [
              { asiento: 0, puntos: 31 },
              { asiento: 1, puntos: 29 },
            ],
            resultadoPartida: { asientoGanador: 0 },
            eventosPublicos: [
              { secuencia: 1, idMano: "mano-2", tipo: "contra-flor-al-resto-propuesta", asiento: 1 },
              {
                secuencia: 2,
                idMano: "mano-2",
                tipo: "mano-cerrada",
                asientoGanador: 0,
                adjudicaciones: [{ asientoGanador: 0, puntos: 2, causa: "bazas" }],
              },
            ],
            ultimoCierre: {
              idMano: "mano-2",
              version: 20,
              asientoGanador: 0,
              equipo: "equipo-0",
              puntos: 2,
              causa: "bazas",
              bazas: [],
            },
          },
        }),
      );
      expect(container.querySelector('[aria-label="Partido finalizado"]')).not.toBeNull();
      expect(container.textContent).toContain("¡Ganaste el partido!");
      expect(container.textContent).toContain("Ana: 31 — Máquina: 29");
      expect(container.textContent).not.toContain("Continuar");
      expect(container.textContent).toContain("Máquina cantó Contra Flor al Resto.");
      expect(container.textContent).toContain("Ana ganó la mano por bazas (+2 puntos).");
      expect(container.querySelectorAll(".historial-publico__evento")).toHaveLength(2);
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...snapshotIniciado(20),
            marcador: [
              { asiento: 0, puntos: 31 },
              { asiento: 1, puntos: 29 },
            ],
            resultadoPartida: { asientoGanador: 0 },
          },
        }),
      );
      expect(container.querySelectorAll('[aria-label="Partido finalizado"]')).toHaveLength(1);
      const jugarOtra = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
        (boton) => boton.textContent === "Jugar otra partida",
      );
      await act(async () => jugarOtra?.click());
      expect(SocketDePrueba.instancias).toHaveLength(2);
      expect(container.textContent).toContain("0 pts");
      expect(container.querySelector('[aria-label="Partido finalizado"]')).toBeNull();
      expect(container.textContent).not.toContain("Contra Flor al Resto");
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("no muestra el cierre de partido sin resultado autoritativo", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(respuesta({ snapshot: snapshotEspera })),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();
    try {
      await iniciar(container);
      const socket = SocketDePrueba.instancias[0]!;
      await act(async () => socket.abrir());
      await act(async () => socket.recibir({ type: "auth.ok" }));
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...snapshotIniciado(3),
            marcador: [
              { asiento: 0, puntos: 40 },
              { asiento: 1, puntos: 40 },
            ],
          },
        }),
      );
      expect(container.querySelector('[aria-label="Partido finalizado"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("conserva Real Envido y anuncia el canto antes de pedir respuesta", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(respuesta({ snapshot: snapshotEspera })),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();
    try {
      await iniciar(container);
      const socket = SocketDePrueba.instancias[0]!;
      await act(async () => socket.abrir());
      await act(async () => socket.recibir({ type: "auth.ok" }));
      const eventos = [
        {
          secuencia: 1,
          idMano: "mano-2",
          tipo: "envido-iniciado",
          asiento: 1,
          canto: "real-envido",
        },
      ];
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...snapshotIniciado(2),
            eventosPublicos: eventos,
            desafiosPendientes: {
              envido: { proponente: 1, respondedor: 0, valor: 3 },
              flor: null,
              truco: null,
              oportunidadFlorPropia: false,
            },
          },
        }),
      );
      expect(container.textContent).toContain("Máquina cantó Real Envido.");
      expect(container.textContent).toContain("La máquina espera tu respuesta al envido.");
      await act(async () => vi.advanceTimersByTimeAsync(3000));
      expect(container.querySelector(".anuncio-evento")).toBeNull();
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: { ...snapshotIniciado(3), eventosPublicos: eventos },
        }),
      );
      expect(container.querySelectorAll(".historial-publico li")).toHaveLength(1);
    } finally {
      await act(async () => root.unmount());
      vi.useRealTimers();
    }
  });

  it("encola los anuncios del snapshot inicial y no los repite al recibirlo de nuevo", async () => {
    vi.useFakeTimers();
    const eventos = [
      { secuencia: 1, idMano: "mano-2", tipo: "flor-anunciada", asiento: 1 },
      {
        secuencia: 2,
        idMano: "mano-2",
        tipo: "flor-adjudicada",
        adjudicaciones: [
          { asientoGanador: 0, puntos: 0, causa: "sin-desafio" },
          { asientoGanador: 1, puntos: 3, causa: "sin-desafio" },
        ],
      },
      { secuencia: 3, idMano: "mano-2", tipo: "truco-propuesto", asiento: 1 },
    ];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(
          respuesta({ snapshot: { ...snapshotIniciado(1), eventosPublicos: eventos } }),
        ),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();
    try {
      await iniciar(container);
      expect(container.textContent).toContain("Máquina cantó Flor.");
      expect(container.textContent).toContain("Máquina ganó 3 puntos.");
      expect(container.textContent).not.toContain("Ana ganó 0 puntos.");
      const socket = SocketDePrueba.instancias[0]!;
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: { ...snapshotIniciado(2), eventosPublicos: eventos },
        }),
      );
      await act(async () => vi.advanceTimersByTimeAsync(3000));
      expect(container.textContent).toContain("Máquina cantó Truco.");
      await act(async () => vi.advanceTimersByTimeAsync(3000));
      expect(container.querySelectorAll(".historial-publico li")).toHaveLength(3);
    } finally {
      await act(async () => root.unmount());
      vi.useRealTimers();
    }
  });

  it("ordena, deduplica y avanza los anuncios públicos cada tres segundos", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(respuesta({ snapshot: snapshotEspera })),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();
    try {
      await iniciar(container);
      const socket = SocketDePrueba.instancias[0]!;
      await act(async () => socket.abrir());
      await act(async () => socket.recibir({ type: "auth.ok" }));
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: { ...snapshotIniciado(2), eventosPublicos: [] },
        }),
      );
      const eventos = [
        { secuencia: 2, idMano: "mano-2", tipo: "flor-anunciada", asiento: 1 },
        { secuencia: 3, idMano: "mano-2", tipo: "truco-propuesto", asiento: 1 },
      ];
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: { ...snapshotIniciado(3), eventosPublicos: eventos },
        }),
      );
      expect(container.textContent).toContain("Máquina cantó Flor.");
      expect(container.textContent).toContain("Historial");
      await act(async () => vi.advanceTimersByTimeAsync(3000));
      expect(container.textContent).toContain("Máquina cantó Truco.");
      await act(async () => vi.advanceTimersByTimeAsync(3000));
      expect(container.querySelector(".anuncio-evento")).toBeNull();
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: { ...snapshotIniciado(4), eventosPublicos: eventos },
        }),
      );
      expect(container.querySelectorAll(".historial-publico li")).toHaveLength(2);
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...snapshotIniciado(5),
            idMano: "mano-3",
            eventosPublicos: [
              ...eventos,
              { secuencia: 4, idMano: "mano-3", tipo: "truco-propuesto", asiento: 1 },
            ],
          },
        }),
      );
      expect(container.textContent).toContain("mano-2");
      expect(container.textContent).toContain("mano-3");
    } finally {
      await act(async () => root.unmount());
      vi.useRealTimers();
    }
  });

  it("agrupa el historial lateral, conserva la lectura y permite abrirlo desde su control", async () => {
    const eventos = [
      { secuencia: 1, idMano: "mano-2", tipo: "truco-propuesto", asiento: 1 },
      { secuencia: 2, idMano: "mano-2", tipo: "truco-aceptado", asiento: 0 },
      { secuencia: 3, idMano: "mano-3", tipo: "carta-jugada", asiento: 1 },
    ];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(
          respuesta({ snapshot: { ...snapshotIniciado(1), eventosPublicos: eventos } }),
        ),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();
    try {
      await iniciar(container);
      expect(container.querySelector(".mesa-distribucion")).not.toBeNull();
      expect(container.querySelectorAll(".historial-publico__grupo")).toHaveLength(2);
      expect(container.querySelectorAll(".historial-publico__grupo")[0]?.textContent).toContain(
        "mano-2",
      );
      expect(container.querySelectorAll(".historial-publico__grupo")[1]?.textContent).toContain(
        "mano-3",
      );

      const boton = container.querySelector<HTMLButtonElement>(".historial-toggle")!;
      expect(boton.getAttribute("aria-expanded")).toBe("false");
      await act(async () => boton.click());
      expect(boton.getAttribute("aria-expanded")).toBe("true");
      await act(async () =>
        container.querySelector<HTMLButtonElement>(".historial-publico__cerrar")?.click(),
      );
      expect(boton.getAttribute("aria-expanded")).toBe("false");

      const desplazable = container.querySelector<HTMLDivElement>(
        ".historial-publico__desplazable",
      )!;
      Object.defineProperties(desplazable, {
        clientHeight: { configurable: true, value: 100 },
        scrollHeight: { configurable: true, value: 300 },
      });
      desplazable.scrollTop = 200;
      const socket = SocketDePrueba.instancias[0]!;
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...snapshotIniciado(2),
            idMano: "mano-3",
            eventosPublicos: [
              ...eventos,
              { secuencia: 4, idMano: "mano-3", tipo: "truco-propuesto", asiento: 1 },
            ],
          },
        }),
      );
      expect(desplazable.scrollTop).toBe(300);

      desplazable.scrollTop = 0;
      await act(async () => desplazable.dispatchEvent(new Event("scroll", { bubbles: true })));
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...snapshotIniciado(3),
            idMano: "mano-3",
            eventosPublicos: [
              ...eventos,
              { secuencia: 4, idMano: "mano-3", tipo: "truco-propuesto", asiento: 1 },
              { secuencia: 5, idMano: "mano-3", tipo: "truco-aceptado", asiento: 0 },
            ],
          },
        }),
      );
      expect(desplazable.scrollTop).toBe(0);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("conserva el tanteador histórico de cada mano, incluido el cierre final", async () => {
    const eventos = [
      {
        secuencia: 1,
        idMano: "mano-1",
        tipo: "mano-cerrada",
        asientoGanador: 0,
        adjudicaciones: [{ asientoGanador: 0, puntos: 2, causa: "bazas" }],
      },
      {
        secuencia: 2,
        idMano: "mano-1",
        tipo: "tanteador-cierre",
        marcadorCierre: [
          { asiento: 0, puntos: 18 },
          { asiento: 1, puntos: 12 },
        ],
      },
      {
        secuencia: 3,
        idMano: "mano-2",
        tipo: "mano-cerrada",
        asientoGanador: 1,
        adjudicaciones: [{ asientoGanador: 1, puntos: 1, causa: "mazo" }],
      },
      {
        secuencia: 4,
        idMano: "mano-2",
        tipo: "tanteador-cierre",
        marcadorCierre: [
          { asiento: 0, puntos: 18 },
          { asiento: 1, puntos: 13 },
        ],
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(respuesta({ token: "token-privado" }))
        .mockResolvedValueOnce(
          respuesta({
            snapshot: {
              ...snapshotIniciado(9),
              marcador: [
                { asiento: 0, puntos: 18 },
                { asiento: 1, puntos: 13 },
              ],
              resultadoPartida: { asientoGanador: 1 },
              eventosPublicos: eventos,
            },
          }),
        ),
    );
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();
    try {
      await iniciar(container);
      expect(container.textContent).toContain("Tanteador al cierre: Ana 18 – Máquina 12.");
      expect(container.textContent).toContain("Tanteador al cierre: Ana 18 – Máquina 13.");
      expect(container.querySelectorAll(".historial-publico__evento--tanteador")).toHaveLength(2);
      const socket = SocketDePrueba.instancias[0]!;
      await act(async () => socket.abrir());
      await act(async () => socket.recibir({ type: "auth.ok" }));
      await act(async () =>
        socket.recibir({
          type: "game.snapshot",
          snapshot: {
            ...snapshotIniciado(10),
            marcador: [
              { asiento: 0, puntos: 22 },
              { asiento: 1, puntos: 13 },
            ],
            resultadoPartida: { asientoGanador: 0 },
            eventosPublicos: eventos,
          },
        }),
      );
      expect(container.textContent).toContain("Tanteador al cierre: Ana 18 – Máquina 12.");
      expect(container.querySelectorAll(".historial-publico__evento--tanteador")).toHaveLength(2);
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("ignora una creación HTTP que termina después del desmontaje", async () => {
    let resolverSesion: ((value: Response) => void) | undefined;
    const pendiente = new Promise<Response>((resolve) => {
      resolverSesion = resolve;
    });
    const fetch = vi.fn().mockReturnValueOnce(pendiente);
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("WebSocket", SocketDePrueba);
    const { container, root } = await montar();

    await act(async () => {
      const input = container.querySelector("input") as HTMLInputElement;
      const formulario = container.querySelector("form") as HTMLFormElement;
      input.value = "Ana";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      formulario.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(() => root.unmount());
    resolverSesion?.(respuesta({ token: "token-privado" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(SocketDePrueba.instancias).toHaveLength(0);
  });
});
