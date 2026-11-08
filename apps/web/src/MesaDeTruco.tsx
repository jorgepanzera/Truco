import { useEffect, useRef, useState } from "react";
import type { Carta as CartaModelo } from "@truco/shared";
import type { AccionWeb, EventoPublico, SnapshotPartida } from "./servidor.js";
import { Carta, DorsoCarta } from "./Carta.js";

type SnapshotIniciado = Extract<SnapshotPartida, { estado: "iniciada" }>;

function nombreDe(snapshot: SnapshotIniciado, asiento: number): string {
  return (
    snapshot.participantes.find((participante) => participante.asiento === asiento)?.apodo ??
    "Jugador"
  );
}

function marcadorDe(snapshot: SnapshotIniciado, asiento: number): number {
  return snapshot.marcador.find((item) => item.asiento === asiento)?.puntos ?? 0;
}

/** Traduce causas canónicas de cierre sin filtrar identificadores internos a la UI. */
export function textoMotivoCierre(causa: string): string {
  const motivos: Record<string, string> = {
    bazas: "definición por bazas",
    "rechazo-truco": "rechazo del Truco",
    mazo: "retiro al mazo",
    "contra-flor-al-resto": "Contra Flor al resto",
  };
  return motivos[causa] ?? "cierre de mano";
}

function EstadoEspera({ snapshot }: Readonly<{ snapshot: SnapshotPartida }>) {
  return (
    <section className="mesa mesa--espera" aria-label="Mesa de Truco">
      <p className="mesa__aviso">Esperando el inicio de la mano.</p>
      <p className="mesa__meta">Meta: {snapshot.metaPuntos} puntos</p>
    </section>
  );
}

function Jugador({
  nombre,
  puntos,
  activo,
  clase,
}: Readonly<{ nombre: string; puntos: number; activo: boolean; clase: string }>) {
  return (
    <section className={`jugador ${clase}${activo ? " jugador--activo" : ""}`}>
      <span className="jugador__nombre">{nombre}</span>
      <span className="jugador__puntos">{puntos} pts</span>
      {activo ? <span className="jugador__turno">Su turno</span> : null}
    </section>
  );
}

function Baza({
  titulo,
  baza,
  asientoPropio,
}: Readonly<{ titulo: string; baza: SnapshotIniciado["bazaActual"]; asientoPropio: number }>) {
  if (baza.jugadas.length === 0) return null;
  return (
    <section className="baza" aria-label={titulo}>
      <span className="baza__titulo">{titulo}</span>
      <div className="cartas-jugadas">
        {baza.jugadas.map((jugada, indice) => (
          <div
            className={`carta-jugada ${jugada.asiento === asientoPropio ? "carta-jugada--propia" : "carta-jugada--rival"}`}
            key={`${jugada.asiento}-${indice}-${jugada.carta.valor}-${jugada.carta.palo}`}
          >
            <Carta carta={jugada.carta} />
          </div>
        ))}
      </div>
    </section>
  );
}

function textoResultadoBaza(
  baza: SnapshotIniciado["bazaActual"],
  asientoPropio: number,
  indice: number,
): string | null {
  if (baza.asientoGanador === null) return `La baza ${indice} terminó empatada.`;
  return baza.asientoGanador === asientoPropio
    ? `Ganaste la baza ${indice}.`
    : `La máquina ganó la baza ${indice}.`;
}

function PanelCierre({
  cierre,
  snapshot,
  onContinuar,
}: Readonly<{
  cierre: NonNullable<SnapshotIniciado["ultimoCierre"]>;
  snapshot: SnapshotIniciado;
  onContinuar: () => void;
}>) {
  const ganador = nombreDe(snapshot, cierre.asientoGanador);
  return (
    <section className="panel-cierre" aria-live="assertive" aria-label="Resultado de la mano">
      <h2>
        {cierre.asientoGanador === snapshot.asientoPropio
          ? "¡Ganaste la mano!"
          : `${ganador} ganó la mano.`}
      </h2>
      <p>
        {snapshot.participantes
          .map((jugador) => `${jugador.apodo}: ${marcadorDe(snapshot, jugador.asiento)}`)
          .join(" — ")}
      </p>
      <p>Motivo: {textoMotivoCierre(cierre.causa)}</p>
      <div className="panel-cierre__bazas">
        {cierre.bazas.map((baza, indice) => (
          <Baza
            asientoPropio={snapshot.asientoPropio}
            baza={baza}
            key={indice}
            titulo={`Baza ${indice + 1} de la mano cerrada`}
          />
        ))}
      </div>
      <button
        disabled={snapshot.continuacion?.confirmadaPropia}
        type="button"
        onClick={onContinuar}
      >
        {snapshot.continuacion?.confirmadaPropia ? "Esperando confirmaciones…" : "Continuar"}
      </button>
    </section>
  );
}

function PanelPartidaFinalizada({
  resultado,
  snapshot,
  onJugarOtra,
  reiniciando,
}: Readonly<{
  resultado: NonNullable<SnapshotIniciado["resultadoPartida"]>;
  snapshot: SnapshotIniciado;
  onJugarOtra: () => void;
  reiniciando: boolean;
}>) {
  const ganador = nombreDe(snapshot, resultado.asientoGanador);
  return (
    <section className="mesa mesa--partida-finalizada" aria-label="Partido finalizado">
      <div className="panel-partida-finalizada" role="status">
        <h2>Partido finalizado</h2>
        <p>
          {resultado.asientoGanador === snapshot.asientoPropio
            ? "¡Ganaste el partido!"
            : `${ganador} ganó el partido.`}
        </p>
        <p>
          {snapshot.participantes
            .map((jugador) => `${jugador.apodo}: ${marcadorDe(snapshot, jugador.asiento)}`)
            .join(" — ")}
        </p>
        <button disabled={reiniciando} type="button" onClick={onJugarOtra}>
          {reiniciando ? "Creando partida…" : "Jugar otra partida"}
        </button>
      </div>
    </section>
  );
}

function textoDesafioPendiente(snapshot: SnapshotIniciado): string | null {
  const { envido, flor, truco, oportunidadFlorPropia } = snapshot.desafiosPendientes;
  if (envido)
    return envido.respondedor === snapshot.asientoPropio
      ? "La máquina espera tu respuesta al envido."
      : "Esperando respuesta al envido.";
  if (flor)
    return flor.respondedor === snapshot.asientoPropio
      ? "La máquina espera tu respuesta a la flor."
      : "Esperando respuesta a la flor.";
  if (truco) {
    const canto =
      truco.nivel === "retruco"
        ? "Retruco"
        : truco.nivel === "vale-cuatro"
          ? "Vale Cuatro"
          : "Truco";
    return truco.proponente === snapshot.asientoPropio
      ? `La máquina está decidiendo ${canto}.`
      : `La máquina espera tu respuesta al ${canto}.`;
  }
  if (oportunidadFlorPropia)
    return "La partida espera que anuncies Flor; este control aún no está disponible.";
  return null;
}

function etiquetaAccion(accion: AccionWeb): string {
  if (accion.type === "envido" || accion.type === "raise-envido")
    return accion.canto === "real-envido"
      ? "Real Envido"
      : accion.canto === "falta-envido"
        ? "Falta Envido"
        : "Envido";
  const etiquetas: Record<
    Exclude<AccionWeb["type"], "play-card" | "envido" | "raise-envido">,
    string
  > = {
    "continue-hand": "Continuar",
    "announce-flor": "Flor",
    "contra-flor": "Contra Flor",
    "contra-flor-al-resto": "Contra Flor al Resto",
    "accept-contra-flor": "Quiero",
    "reject-contra-flor": "No quiero",
    "accept-contra-flor-al-resto": "Quiero",
    "reject-contra-flor-al-resto": "No quiero",
    "accept-envido": "Quiero",
    "reject-envido": "No quiero",
    "con-flor-quiero": "Con Flor Quiero",
    "go-to-mazo": "Irse al mazo",
    truco: "Truco",
    "accept-truco": "Quiero",
    "reject-truco": "No quiero",
    retruco: "Retruco",
    "accept-retruco": "Quiero",
    "reject-retruco": "No quiero",
    "vale-cuatro": "Vale cuatro",
    "accept-vale-cuatro": "Quiero",
    "reject-vale-cuatro": "No quiero",
  };
  return etiquetas[accion.type as keyof typeof etiquetas];
}

function ordinalBaza(indice: number): string {
  return ["primera", "segunda", "tercera"][indice] ?? `${indice + 1}.ª`;
}

function textoEvento(
  snapshot: SnapshotIniciado,
  evento: EventoPublico,
  baza?: SnapshotIniciado["bazasCompletadas"][number],
): string {
  const actor = evento.asiento === undefined ? null : nombreDe(snapshot, evento.asiento);
  const sujeto = actor ?? "La partida";
  if (evento.tipo === "baza-resuelta") {
    if (!baza) return "Se resolvió una baza.";
    const numero = ordinalBaza(snapshot.bazasCompletadas.indexOf(baza));
    return baza.asientoGanador === null
      ? `La ${numero} baza terminó empatada.`
      : `${nombreDe(snapshot, baza.asientoGanador)} ganó la ${numero} baza.`;
  }
  if (evento.tipo === "mano-cerrada") {
    const adjudicacion = evento.adjudicaciones?.find((item) => item.puntos > 0);
    const ganador = evento.asientoGanador ?? adjudicacion?.asientoGanador;
    const razon =
      adjudicacion?.causa === "rechazo-truco"
        ? " por rechazo del Truco"
        : adjudicacion?.causa === "mazo"
          ? " por retiro al mazo"
          : adjudicacion?.causa === "bazas"
            ? " por bazas"
            : "";
    const puntos = adjudicacion
      ? ` (+${adjudicacion.puntos} punto${adjudicacion.puntos === 1 ? "" : "s"})`
      : "";
    return ganador === undefined
      ? `La mano terminó${puntos}.`
      : `${nombreDe(snapshot, ganador)} ganó la mano${razon}${puntos}.`;
  }
  if (evento.tipo === "tanteador-cierre") {
    const tanteador = evento.marcadorCierre
      ?.map((item) => `${nombreDe(snapshot, item.asiento)} ${item.puntos}`)
      .join(" – ");
    return `Tanteador al cierre: ${tanteador ?? "sin datos"}.`;
  }
  const nombres: Record<string, string> = {
    "carta-jugada": `${sujeto} jugó una carta`,
    "jugador-retirado": `${sujeto} se fue al mazo`,
    "mazo-adjudicado": "Se adjudicó el mazo",
    "envido-iniciado": `${sujeto} cantó`,
    "envido-aumentado": `${sujeto} aumentó a`,
    "envido-aceptado": `${sujeto} aceptó el Envido`,
    "envido-rechazado": `${sujeto} rechazó el Envido`,
    "envido-rechazo-implicito-por-retiro": "El Envido fue rechazado por retiro",
    "envido-cancelado-por-retiro": "El Envido se canceló por retiro",
    "envido-cancelado-por-flor": "El Envido se canceló por Flor",
    "truco-cancelado-por-retiro": "El Truco se canceló por retiro",
    "truco-rechazo-implicito-por-retiro": "El Truco fue rechazado por retiro",
    "flor-anunciada": `${sujeto} cantó Flor`,
    "flor-adjudicada": "Se adjudicó la Flor",
    "contra-flor-propuesta": `${sujeto} cantó Contra Flor`,
    "contra-flor-al-resto-propuesta": `${sujeto} cantó Contra Flor al Resto`,
    "truco-propuesto": `${sujeto} cantó Truco`,
    "retruco-propuesto": `${sujeto} cantó Retruco`,
    "vale-cuatro-propuesto": `${sujeto} cantó Vale Cuatro`,
    "truco-aceptado": `${sujeto} aceptó el Truco`,
    "retruco-aceptado": `${sujeto} aceptó el Retruco`,
    "vale-cuatro-aceptado": `${sujeto} aceptó el Vale Cuatro`,
    "truco-rechazado": `${sujeto} rechazó el Truco`,
    "retruco-rechazado": `${sujeto} rechazó el Retruco`,
    "vale-cuatro-rechazado": `${sujeto} rechazó el Vale Cuatro`,
    "mano-decidida-por-bazas": "La mano quedó definida por bazas",
    "mano-decidida-por-rechazo-truco": "La mano quedó definida por rechazo del Truco",
    "mano-decidida-por-mazo": "La mano quedó definida por retiro al mazo",
  };
  const cantoEnvido =
    evento.canto === "real-envido"
      ? "Real Envido"
      : evento.canto === "falta-envido"
        ? "Falta Envido"
        : "Envido";
  const texto =
    evento.tipo === "envido-iniciado"
      ? `${nombres[evento.tipo]} ${cantoEnvido}`
      : evento.tipo === "envido-aumentado"
        ? `${nombres[evento.tipo]} ${cantoEnvido}`
        : (nombres[evento.tipo] ?? evento.tipo.replaceAll("-", " "));
  const adjudicaciones = evento.adjudicaciones?.filter((adjudicacion) => adjudicacion.puntos > 0);
  const tantos = evento.tantos
    ?.map((tanto) => `${nombreDe(snapshot, tanto.asiento)}: ${tanto.tanto} tantos`)
    .join(" — ");
  if (!adjudicaciones?.length) return `${texto}.${tantos ? ` ${tantos}.` : ""}`;
  const puntos = adjudicaciones
    .map((adjudicacion) => {
      const ganador = nombreDe(snapshot, adjudicacion.asientoGanador);
      return `${ganador} ganó ${adjudicacion.puntos} punto${adjudicacion.puntos === 1 ? "" : "s"}.`;
    })
    .join(" ");
  return `${texto}.${tantos ? ` ${tantos}.` : ""} ${puntos}`;
}

function claseEvento(evento: EventoPublico): string {
  if (evento.tipo === "tanteador-cierre") return "historial-publico__evento--tanteador";
  if (
    evento.tipo === "flor-anunciada" ||
    evento.tipo.startsWith("contra-flor-") ||
    evento.tipo.startsWith("envido-") ||
    evento.tipo === "truco-propuesto" ||
    evento.tipo === "retruco-propuesto" ||
    evento.tipo === "vale-cuatro-propuesto"
  )
    return "historial-publico__evento--canto";
  if (evento.adjudicaciones?.some((adjudicacion) => adjudicacion.puntos > 0))
    return "historial-publico__evento--adjudicacion";
  return "";
}

function Historial({
  historial,
  snapshot,
  abierto,
  onCerrar,
}: Readonly<{
  historial: readonly EventoPublico[];
  snapshot: SnapshotIniciado;
  abierto: boolean;
  onCerrar: () => void;
}>) {
  const desplazable = useRef<HTMLDivElement | null>(null);
  const seguirAlFinal = useRef(true);
  const partidoAnterior = useRef(snapshot.matchId);
  const manos = historial.reduce<ReadonlyArray<Readonly<{ id: string; eventos: EventoPublico[] }>>>(
    (acumulado, evento) => {
      const ultima = acumulado.at(-1);
      if (ultima?.id === evento.idMano)
        return [...acumulado.slice(0, -1), { ...ultima, eventos: [...ultima.eventos, evento] }];
      return [...acumulado, { id: evento.idMano, eventos: [evento] }];
    },
    [],
  );

  useEffect(() => {
    const panel = desplazable.current;
    if (panel && seguirAlFinal.current) panel.scrollTop = panel.scrollHeight;
  }, [historial]);

  useEffect(() => {
    if (partidoAnterior.current === snapshot.matchId) return;
    partidoAnterior.current = snapshot.matchId;
    seguirAlFinal.current = true;
    if (desplazable.current) desplazable.current.scrollTop = 0;
  }, [snapshot.matchId]);

  const actualizarSeguimiento = () => {
    const panel = desplazable.current;
    if (!panel) return;
    seguirAlFinal.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 24;
  };

  return (
    <aside
      aria-label="Historial público"
      className={`historial-publico${abierto ? " historial-publico--abierto" : ""}`}
      id="historial-partida"
    >
      <header className="historial-publico__cabecera">
        <h2>Historial</h2>
        <button
          aria-label="Cerrar historial"
          className="historial-publico__cerrar"
          onClick={onCerrar}
          type="button"
        >
          Cerrar
        </button>
      </header>
      <div className="historial-publico__desplazable" onScroll={actualizarSeguimiento} ref={desplazable}>
        {manos.length ? (
          manos.map((mano) => {
            const tieneCierre = mano.eventos.some((evento) => evento.tipo === "mano-cerrada");
            let indiceBaza = 0;
            const eventosVisibles = mano.eventos.filter(
              (evento) =>
                !(
                  tieneCierre &&
                  [
                    "mano-decidida-por-bazas",
                    "mano-decidida-por-rechazo-truco",
                    "mano-decidida-por-mazo",
                  ].includes(evento.tipo)
                ),
            );
            return (
              <section className="historial-publico__grupo" key={mano.id}>
                <h3 className="historial-publico__mano">{mano.id}</h3>
                <ol>
                  {eventosVisibles.map((evento) => {
                    const baza =
                      evento.tipo === "baza-resuelta" && mano.id === snapshot.idMano
                        ? snapshot.bazasCompletadas[indiceBaza++]
                        : undefined;
                    return (
                      <li
                        className={`historial-publico__evento ${claseEvento(evento)}`.trim()}
                        key={evento.secuencia}
                      >
                        {textoEvento(snapshot, evento, baza)}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })
        ) : (
          <p className="historial-publico__vacio">Los eventos de la mano aparecerán aquí.</p>
        )}
      </div>
    </aside>
  );
}

export function MesaDeTruco({
  snapshot,
  onJugarCarta,
  accionPendiente = false,
  cierreMostrado = null,
  onContinuar,
  onAccion,
  anuncioActual = null,
  historial = [],
  onJugarOtra,
  creando = false,
}: Readonly<{
  snapshot: SnapshotPartida;
  onJugarCarta?: (carta: CartaModelo) => void;
  accionPendiente?: boolean;
  cierreMostrado?: NonNullable<SnapshotIniciado["ultimoCierre"]> | null;
  onContinuar?: () => void;
  onAccion?: (accion: AccionWeb) => void;
  anuncioActual?: EventoPublico | null;
  historial?: readonly EventoPublico[];
  onJugarOtra?: () => void;
  creando?: boolean;
}>) {
  const [historialAbierto, setHistorialAbierto] = useState(false);
  if (snapshot.estado !== "iniciada") return <EstadoEspera snapshot={snapshot} />;
  if (snapshot.resultadoPartida && onJugarOtra)
    return (
      <div className="mesa-distribucion">
        <PanelPartidaFinalizada
          resultado={snapshot.resultadoPartida}
          snapshot={snapshot}
          onJugarOtra={onJugarOtra}
          reiniciando={creando}
        />
        <button
          aria-controls="historial-partida"
          aria-expanded={historialAbierto}
          className="historial-toggle"
          onClick={() => setHistorialAbierto((abierto) => !abierto)}
          type="button"
        >
          Historial
        </button>
        <Historial
          abierto={historialAbierto}
          historial={historial}
          onCerrar={() => setHistorialAbierto(false)}
          snapshot={snapshot}
        />
      </div>
    );
  const asientoRival = snapshot.participantes.find(
    (participante) => participante.asiento !== snapshot.asientoPropio,
  )?.asiento;
  const turnoPropio = snapshot.turno === snapshot.asientoPropio;
  const turnoRival = asientoRival !== undefined && snapshot.turno === asientoRival;
  const nombreRival = asientoRival === undefined ? "Máquina" : nombreDe(snapshot, asientoRival);
  const puntosRival = asientoRival === undefined ? 0 : marcadorDe(snapshot, asientoRival);
  const cartasMostradas = snapshot.bazasCompletadas.reduce(
    (cantidad, baza) => cantidad + baza.jugadas.length,
    snapshot.bazaActual.jugadas.length,
  );
  const avisoPendiente = textoDesafioPendiente(snapshot);
  const cartaEsLegal = (carta: CartaModelo) =>
    snapshot.accionesDisponibles.some(
      (accion) =>
        accion.type === "play-card" &&
        accion.card.valor === carta.valor &&
        accion.card.palo === carta.palo,
    );
  const puedeJugar =
    turnoPropio &&
    snapshot.cartasPropias.some(cartaEsLegal) &&
    !accionPendiente &&
    !cierreMostrado &&
    Boolean(onJugarCarta);

  return (
    <div className="mesa-distribucion">
      <section className="mesa" aria-label="Mesa de Truco">
      <header className="mesa__cabecera">
        <span>Mano en curso</span>
        <span>
          {cartasMostradas} carta{cartasMostradas === 1 ? "" : "s"} pública
          {cartasMostradas === 1 ? "" : "s"} en mesa
        </span>
      </header>
      <Jugador
        clase="jugador--rival"
        nombre={nombreRival}
        puntos={puntosRival}
        activo={turnoRival}
      />
      <div className="mano-rival" aria-label="Cartas de la máquina ocultas">
        {Array.from({ length: snapshot.cartasRivalesRestantes }, (_, indice) => (
          <DorsoCarta key={indice} />
        ))}
      </div>
      <section className="centro-mesa" aria-label="Centro de la mesa">
        <div className="muestra">
          <span className="muestra__titulo">Muestra</span>
          <Carta carta={snapshot.muestra} />
        </div>
        <div className="zona-jugadas">
          <span className="zona-jugadas__titulo">Bazas</span>
          <div className="bazas-completadas">
            {snapshot.bazasCompletadas.map((baza, indice) => (
              <div className="anuncio-baza" key={indice}>
                <p>{textoResultadoBaza(baza, snapshot.asientoPropio, indice + 1)}</p>
                <Baza
                  baza={baza}
                  asientoPropio={snapshot.asientoPropio}
                  titulo={`Baza ${indice + 1} completada`}
                />
              </div>
            ))}
          </div>
          <Baza
            baza={snapshot.bazaActual}
            asientoPropio={snapshot.asientoPropio}
            titulo="Baza en curso"
          />
          {cartasMostradas === 0 ? (
            <p className="mesa__sin-cartas">Aún no hay cartas jugadas.</p>
          ) : null}
        </div>
      </section>
      {avisoPendiente ? <p className="mesa__desafio">{avisoPendiente}</p> : null}
      {anuncioActual ? (
        <p aria-live="assertive" className="anuncio-evento">
          {textoEvento(snapshot, anuncioActual)}
        </p>
      ) : null}
      {onAccion ? (
        <div className="acciones" aria-label="Acciones disponibles">
          {snapshot.accionesDisponibles
            .filter((accion) => accion.type !== "play-card")
            .map((accion, indice) => (
              <button
                disabled={accionPendiente || Boolean(cierreMostrado)}
                key={`${accion.type}-${indice}`}
                onClick={() => onAccion(accion)}
                type="button"
              >
                {etiquetaAccion(accion)}
              </button>
            ))}
        </div>
      ) : null}
      {accionPendiente ? <p className="mesa__aviso">Esperando confirmación de la jugada.</p> : null}
      {cierreMostrado && onContinuar ? (
        <PanelCierre cierre={cierreMostrado} snapshot={snapshot} onContinuar={onContinuar} />
      ) : null}
      <Jugador
        clase="jugador--propio"
        nombre={nombreDe(snapshot, snapshot.asientoPropio)}
        puntos={marcadorDe(snapshot, snapshot.asientoPropio)}
        activo={turnoPropio}
      />
      <div className="mano-propia" aria-label="Tus cartas">
        {snapshot.cartasPropias.map((carta) => (
          <Carta
            carta={carta}
            deshabilitada={!puedeJugar || !cartaEsLegal(carta)}
            key={`${carta.valor}-${carta.palo}`}
            onSeleccionar={onJugarCarta}
          />
        ))}
      </div>
      </section>
      <button
        aria-controls="historial-partida"
        aria-expanded={historialAbierto}
        className="historial-toggle"
        onClick={() => setHistorialAbierto((abierto) => !abierto)}
        type="button"
      >
        Historial
      </button>
      <Historial
        abierto={historialAbierto}
        historial={historial}
        onCerrar={() => setHistorialAbierto(false)}
        snapshot={snapshot}
      />
    </div>
  );
}
