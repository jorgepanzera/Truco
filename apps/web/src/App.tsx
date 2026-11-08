import { useEffect, useRef, useState } from "react";
import type { Carta } from "@truco/shared";
import { MesaDeTruco } from "./MesaDeTruco.js";
import {
  conectar,
  crearSesionYPartida,
  enviarAccion,
  suscribir,
  type AccionWeb,
  type EventoPublico,
  type SnapshotPartida,
} from "./servidor.js";
import { textos } from "./textos.js";

type CierreMostrado = NonNullable<Extract<SnapshotPartida, { estado: "iniciada" }>["ultimoCierre"]>;
const DURACION_ANUNCIO_MS = 3000;
const esAnuncioCentral = (evento: EventoPublico) =>
  evento.tipo.startsWith("envido-") ||
  evento.tipo.startsWith("truco-") ||
  evento.tipo === "flor-anunciada" ||
  evento.tipo.startsWith("contra-flor-");

export function App() {
  const [apodo, setApodo] = useState("");
  const [estado, setEstado] = useState<string>(textos.estado);
  const [partida, setPartida] = useState<SnapshotPartida | null>(null);
  const [creando, setCreando] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const solicitud = useRef<AbortController | null>(null);
  const montada = useRef(false);
  const solicitudEnCurso = useRef(false);
  const intento = useRef(0);
  const ultimoSnapshot = useRef<SnapshotPartida | null>(null);
  const accionEnCurso = useRef<string | null>(null);
  const secuenciaAccion = useRef(0);
  const [accionPendiente, setAccionPendiente] = useState(false);
  const [cierreMostrado, setCierreMostrado] = useState<CierreMostrado | null>(null);
  const cierresMostrados = useRef(new Set<string>());
  const [historial, setHistorial] = useState<readonly EventoPublico[]>([]);
  const [colaAnuncios, setColaAnuncios] = useState<readonly EventoPublico[]>([]);
  const [anuncioActual, setAnuncioActual] = useState<EventoPublico | null>(null);
  const secuenciasVistas = useRef(new Set<number>());
  const partidoEventos = useRef<string | null>(null);
  const [cierrePendiente, setCierrePendiente] = useState<CierreMostrado | null>(null);

  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
      intento.current += 1;
      solicitud.current?.abort();
      solicitud.current = null;
      socket.current?.close();
      socket.current = null;
      accionEnCurso.current = null;
    };
  }, []);

  useEffect(() => {
    if (cierreMostrado || anuncioActual) return;
    if (colaAnuncios.length) {
      setAnuncioActual(colaAnuncios[0]!);
      setColaAnuncios((cola) => cola.slice(1));
      return;
    }
    if (cierrePendiente && !cierreMostrado) setCierreMostrado(cierrePendiente);
  }, [anuncioActual, cierreMostrado, cierrePendiente, colaAnuncios]);

  useEffect(() => {
    if (!anuncioActual) return;
    const temporizador = window.setTimeout(() => {
      setAnuncioActual(null);
    }, DURACION_ANUNCIO_MS);
    return () => window.clearTimeout(temporizador);
  }, [anuncioActual, cierrePendiente]);

  const actualizarSnapshot = (snapshot: SnapshotPartida) => {
    const anterior = ultimoSnapshot.current;
    if (anterior?.matchId === snapshot.matchId && snapshot.version < anterior.version) return;
    ultimoSnapshot.current = snapshot;
    setPartida(snapshot);
    if (snapshot.estado === "iniciada") {
      const cambiaPartida = partidoEventos.current !== snapshot.matchId;
      const eventos = [...snapshot.eventosPublicos].sort((a, b) => a.secuencia - b.secuencia);
      if (cambiaPartida) {
        partidoEventos.current = snapshot.matchId;
        secuenciasVistas.current = new Set(eventos.map((evento) => evento.secuencia));
        setHistorial(eventos);
        setColaAnuncios(eventos.filter(esAnuncioCentral));
        setAnuncioActual(null);
      } else {
        const nuevos = eventos.filter((evento) => !secuenciasVistas.current.has(evento.secuencia));
        if (nuevos.length) {
          nuevos.forEach((evento) => secuenciasVistas.current.add(evento.secuencia));
          setHistorial((anterior) =>
            [...anterior, ...nuevos].sort((a, b) => a.secuencia - b.secuencia),
          );
          setColaAnuncios((cola) => [...cola, ...nuevos.filter(esAnuncioCentral)]);
        }
      }
    }
    if (
      snapshot.estado === "iniciada" &&
      snapshot.ultimoCierre &&
      snapshot.idMano !== snapshot.ultimoCierre.idMano &&
      snapshot.continuacion === null
    ) {
      setCierreMostrado(null);
      setCierrePendiente(null);
    }
    if (
      snapshot.estado === "iniciada" &&
      snapshot.ultimoCierre &&
      !cierresMostrados.current.has(snapshot.ultimoCierre.idMano)
    ) {
      cierresMostrados.current.add(snapshot.ultimoCierre.idMano);
      setCierrePendiente(snapshot.ultimoCierre);
      if (
        !snapshot.eventosPublicos.some(
          (evento) =>
            evento.idMano === snapshot.ultimoCierre!.idMano && evento.tipo === "mano-cerrada",
        )
      )
        setCierreMostrado(snapshot.ultimoCierre);
    }
  };

  const limpiarAccionPendiente = (actionId: string) => {
    if (accionEnCurso.current !== actionId) return false;
    accionEnCurso.current = null;
    setAccionPendiente(false);
    return true;
  };

  const enviarAccionDisponible = (accion: AccionWeb) => {
    const snapshot = ultimoSnapshot.current;
    if (
      !snapshot ||
      snapshot.estado !== "iniciada" ||
      !socket.current ||
      accionEnCurso.current ||
      cierreMostrado !== null ||
      !snapshot.accionesDisponibles.some(
        (disponible) => JSON.stringify(disponible) === JSON.stringify(accion),
      )
    )
      return;
    const actionId = `play-${++secuenciaAccion.current}`;
    accionEnCurso.current = actionId;
    setAccionPendiente(true);
    try {
      enviarAccion(socket.current, snapshot.matchId, actionId, snapshot.version, accion);
      setEstado("Enviando acción…");
    } catch {
      limpiarAccionPendiente(actionId);
      setEstado("No se pudo enviar la jugada.");
    }
  };

  const jugarCarta = (carta: Carta) => enviarAccionDisponible({ type: "play-card", card: carta });

  const continuar = () => {
    const snapshot = ultimoSnapshot.current;
    if (
      !snapshot ||
      snapshot.estado !== "iniciada" ||
      snapshot.continuacion?.confirmadaPropia ||
      accionEnCurso.current ||
      !socket.current
    )
      return;
    if (!snapshot.continuacion) {
      setCierreMostrado(null);
      setCierrePendiente(null);
      return;
    }
    const actionId = `continue-${++secuenciaAccion.current}`;
    accionEnCurso.current = actionId;
    setAccionPendiente(true);
    enviarAccion(socket.current, snapshot.matchId, actionId, snapshot.version, {
      type: "continue-hand",
      handId: snapshot.continuacion.idMano,
    });
    setEstado("Confirmando continuación…");
  };

  const iniciarPartida = async () => {
    if (solicitudEnCurso.current) return;

    solicitudEnCurso.current = true;
    setCreando(true);
    setEstado("Creando partida…");
    const intentoActual = ++intento.current;
    const controlador = new AbortController();
    solicitud.current = controlador;

    try {
      const resultado = await crearSesionYPartida(apodo, controlador.signal);
      if (!montada.current || intento.current !== intentoActual) return;

      cierresMostrados.current.clear();
      setCierreMostrado(null);
      setCierrePendiente(null);
      partidoEventos.current = null;
      secuenciasVistas.current.clear();
      setHistorial([]);
      setColaAnuncios([]);
      setAnuncioActual(null);
      actualizarSnapshot(resultado.snapshot);
      accionEnCurso.current = null;
      setAccionPendiente(false);
      const socketAnterior = socket.current;
      socket.current = null;
      socketAnterior?.close();
      setEstado("Conectando a la partida…");

      let conexion: WebSocket | null = null;
      const esConexionActual = () =>
        montada.current && intento.current === intentoActual && socket.current === conexion;
      conexion = conectar(
        resultado.token,
        resultado.snapshot.matchId,
        (snapshot) => {
          if (!esConexionActual()) return;
          actualizarSnapshot(snapshot);
          setEstado("Conectado y suscripto.");
        },
        (mensaje) => {
          if (esConexionActual()) {
            accionEnCurso.current = null;
            setAccionPendiente(false);
            setEstado(mensaje);
          }
        },
        () => {
          if (esConexionActual()) {
            accionEnCurso.current = null;
            setAccionPendiente(false);
            setEstado("La conexión con el servidor se cerró.");
          }
        },
        {
          confirmar: (actionId) => {
            if (esConexionActual() && limpiarAccionPendiente(actionId))
              setEstado("Jugada confirmada.");
          },
          rechazar: (actionId, codigo) => {
            if (esConexionActual() && limpiarAccionPendiente(actionId)) {
              if (codigo === "version-obsoleta") {
                const actual = ultimoSnapshot.current;
                if (actual?.matchId === resultado.snapshot.matchId)
                  suscribir(conexion!, actual.matchId);
                setEstado("La partida se actualizó. Volvé a seleccionar una carta.");
                return;
              }
              setEstado(`Jugada rechazada: ${codigo}.`);
            }
          },
        },
      );
      socket.current = conexion;
    } catch (causa) {
      if (montada.current && intento.current === intentoActual)
        setEstado(causa instanceof Error ? causa.message : "No se pudo iniciar la partida.");
    } finally {
      if (montada.current && intento.current === intentoActual) {
        if (solicitud.current === controlador) solicitud.current = null;
        solicitudEnCurso.current = false;
        setCreando(false);
      }
    }
  };

  const iniciar = (evento: React.FormEvent) => {
    evento.preventDefault();
    void iniciarPartida();
  };

  return (
    <main className="pantalla">
      <section className="presentacion" aria-labelledby="titulo">
        <p className="estado">{estado}</p>
        <h1 id="titulo">{textos.titulo}</h1>
        {!partida ? (
          <form onSubmit={iniciar}>
            <input
              aria-label="Apodo"
              value={apodo}
              onChange={(evento) => setApodo(evento.target.value)}
              required
              minLength={3}
            />
            <button disabled={creando}>{creando ? "Creando…" : "Jugar contra máquina"}</button>
          </form>
        ) : (
          <MesaDeTruco
            accionPendiente={accionPendiente}
            anuncioActual={anuncioActual}
            cierreMostrado={cierreMostrado}
            creando={creando}
            historial={historial}
            onAccion={enviarAccionDisponible}
            onJugarCarta={jugarCarta}
            onJugarOtra={() => void iniciarPartida()}
            onContinuar={continuar}
            snapshot={partida}
          />
        )}
      </section>
    </main>
  );
}
