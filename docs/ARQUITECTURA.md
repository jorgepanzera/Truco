# Arquitectura de Truco Uruguayo

## 1. Propósito y alcance

Este documento describe la arquitectura técnica real del monorepo al cierre del correctivo 6C.4-R1. Es una referencia para los incrementos posteriores; no sustituye las reglas de juego ni define requisitos de producto.

El [Reglamento v2.0](REGLAMENTO_TRUCO_URUGUAYO_v2.0.md) prevalece para reglas reglamentarias y la [Especificación Funcional v1.4](ESPECIFICACION_FUNCIONAL_TRUCO_v1.4.md) para comportamiento de producto y alcance. El [README](../README.md) contiene la instalación y los comandos de uso.

### Política documental

Las únicas fuentes normativas vigentes son el Reglamento v2.0 y la Especificación Funcional v1.4. Sus versiones históricas se conservan para trazabilidad; los cierres técnicos viven en `docs/cierres/`. Una consolidación editorial no crea reglas ni modifica requisitos aprobados.

## 2. Principios y decisiones arquitectónicas

- El motor es TypeScript puro, determinista y sin dependencias de red, interfaz, base de datos ni reloj real.
- El azar y el tiempo entran como datos explícitos: el reparto recibe un mazo y las elecciones de barajado; los vencimientos y desconexiones son acciones temporales externas.
- El estado canónico contiene toda la información necesaria para verificar reglas. No debe enviarse directamente a clientes porque incluye cartas privadas.
- `packages/shared` no depende de otros workspaces. `packages/game-engine` solo depende de `@truco/shared`; esta regla se verifica estáticamente.
- El servidor es la autoridad de la creación e inicialización online: autentica al invitado, asigna asientos, genera el reparto y proyecta el estado antes de comunicarlo. El cliente no decide resultados.
- SQLite y Prisma son la decisión vigente de persistencia para v1.

## 3. Estructura del monorepo

```text
apps/
  web/             React + Vite; pantalla de presentación
  server/          HTTP, configuración y base SQLite de infraestructura
packages/
  shared/          Tipos mínimos compartidos
  game-engine/     Reglas puras de cartas, mano, partida y tiempo
docs/              Normativa y documentación técnica
scripts/           Verificaciones de arquitectura y diagnóstico Prisma
.github/workflows/ Integración continua
```

Las dependencias actuales son:

```text
apps/web    ─┬─> @truco/game-engine ─> @truco/shared
             └─> @truco/shared
apps/server ─┬─> @truco/game-engine ─> @truco/shared
             ├─> @truco/shared
             └─> Prisma + adaptador SQLite
```

El control `scripts/check-architecture.mjs` impide que `shared` importe al motor y que el motor importe aplicaciones, Node u otras dependencias. También restringe los manifiestos y las referencias TypeScript de ambos paquetes.

## 4. Tecnologías y herramientas

- Node.js 24 (`>=24 <25`) y npm 11 (`>=11 <12`), definidos en el `package.json` raíz.
- TypeScript estricto, ESM y referencias entre proyectos.
- React 19 y Vite 7 en la web.
- HTTP nativo de Node en el servidor actual.
- Prisma 7, `@prisma/adapter-better-sqlite3` y SQLite en persistencia.
- ESLint, Prettier, `node:test`, Vitest y GitHub Actions.

La CI de [ci.yml](../.github/workflows/ci.yml) usa Node 24.20.0, ejecuta `npm ci` y luego `npm run check` en `push` y `pull_request`.

## 5. Arquitectura del Game Engine

`packages/game-engine` exporta su API desde [index.ts](../packages/game-engine/src/index.ts). Los módulos no mantienen efectos ni temporizadores internos; reciben estado y entradas, y devuelven estado nuevo y eventos o un rechazo estructurado.

### Cartas, mesa y reparto

- [cartas.ts](../packages/game-engine/src/cartas.ts) define el mazo español de 40, validación e identidad de cartas, muestra, piezas, alcahuete, jerarquía y valor individual.
- [mano.ts](../packages/game-engine/src/mano.ts) define `Mesa`, `JugadorMesa`, `ManoPreparada` y el recorrido antihorario. Valida 1v1 y 2v2, posiciones, equipos alternados, repartidor, mano original, reparto, muestra y mazo restante.
- `seleccionarPrimerRepartidor` y `barajarMazo` reciben elecciones externas verificables. El motor no genera aleatoriedad por sí mismo.

Una mesa usa identificadores de jugador, equipo y posición entera. El orden del arreglo no decide los asientos: las posiciones crecientes representan el sentido antihorario. En 2v2 los compañeros ocupan posiciones opuestas.

### Cartas, bazas y retiros

[juego-cartas.ts](../packages/game-engine/src/juego-cartas.ts) mantiene `EstadoJuegoCartas`: cartas disponibles, retirados, baza actual, bazas resueltas, turno, ganador y causa de finalización. Implementa:

- jugadas válidas, turnos filtrados y comparación por equipo;
- las quince resoluciones de bazas, pardas y cierre sin tercera baza innecesaria;
- autor histórico de la carta ganadora y salida posterior, incluso con retirados;
- retiro individual, preservación de cartas ya jugadas y exclusión de cartas privadas restantes;
- finalización por rechazo de Truco y por mazo.

Las consultas `estaActivo`, `jugadoresActivos`, `jugadoresActivosDelEquipo` y `siguienteJugadorActivo` derivan la participación desde el estado canónico de cartas. No existen listas paralelas de retirados en otros dominios.

### Envido, Flor y Truco

- [envido.ts](../packages/game-engine/src/envido.ts) calcula tantos, cadenas de Envido/Real/Falta, comparaciones por equipo, rechazos, Falta Envido con puntaje inicial y liquidaciones por retiro. Un Envido aceptado se compara y adjudica atómicamente.
- [flor.ts](../packages/game-engine/src/flor.ts) calcula Flor, conserva derechos individuales, modela anuncios, Contra Flor, Contra Flor al Resto, adjudicaciones y resultado terminal semántico.
- [truco.ts](../packages/game-engine/src/truco.ts) modela Truco, Retruco y Vale Cuatro, sus propuestas, aceptaciones, rechazos, historial y consecuencias de retiro.

[coordinador.ts](../packages/game-engine/src/coordinador.ts) compone estos dominios en `EstadoManoCoordinada` y expone `ejecutarAccionCoordinada`. Conserva el contexto de inicio, las adjudicaciones canónicas de Truco, el ciclo de la mano y la liquidación por mazo. Aplica prioridad Flor → Envido → Truco, suspensión y reanudación de desafíos, `Con Flor Quiero`, adjudicación única y Contra Flor al Resto.

En 2v2 el coordinador implementa la continuidad del compañero, retiros secuenciales, liquidaciones Flor → Envido → Truco, victoria competitiva frente a cierre definitivo y oportunidades individuales de Flor posteriores al abandono completo. Las oportunidades se ordenan desde el mano original y se consumen una a una.

### Partido, marcador y avance de mano

[partida.ts](../packages/game-engine/src/partida.ts) agrega manos en `EstadoPartida`. Sus operaciones públicas son:

- `crearEstadoPartida` para iniciar desde una mano coordinada;
- `ejecutarAccionPartida` para delegar acciones de la mano activa;
- `contabilizarManoCerrada` para incorporar una mano definitivamente cerrada una sola vez;
- `siguienteMano` para rotar repartidor y preparar el siguiente reparto;
- `esEstadoPartidaValido` y las identidades canónicas de mano para comprobar el historial.

El marcador se conserva por equipos, admite metas 30 o 40, Falta Envido usa el marcador al inicio de la mano, y el estado contempla empate de desempate y victoria directa por Contra Flor al Resto cuando corresponde. Tanto 1v1 como 2v2 atraviesan el ciclo completo de mano, contabilización y rotación.

### Tiempo y desconexiones

[temporal.ts](../packages/game-engine/src/temporal.ts) envuelve una mano coordinada en `EstadoTemporalMano`. No usa `Date.now`, `setTimeout` ni `setInterval`; el servidor u otra capa externa agenda los plazos y vuelve a ingresar eventos.

`obtenerTemporizadorAccionPendiente` deriva una única acción de diez segundos: turno de carta, respuesta de Flor, Envido o Truco, u oportunidad de Flor posterior al mazo. `ejecutarAccionTemporal` acepta acciones normales, vencimientos, desconexiones, reconexiones y vencimientos de desconexión. Los identificadores de versión y pausa rechazan vencimientos obsoletos o duplicados.

Al vencer un turno se anuncia Flor válida antes de jugar la carta de menor fuerza real; los empates se resuelven por oros, copas, espadas y bastos. Las respuestas vencidas ejecutan `No quiero`. Las pausas de desconexión son individuales de 30 segundos; al volver un jugador se reinicia el reloj ordinario de diez segundos. Vencimientos simultáneos se procesan secuencialmente y no alteran la primera adjudicación competitiva ya determinada.

### Contratos públicos y límites

El motor exporta tipos, validadores, transiciones y eventos de todos sus módulos. `ResultadoTransicion` y `Transicion` son contratos genéricos reutilizados por dominios especializados. Los archivos `*.typecheck.ts` son comprobaciones de contrato de compilación, no funcionalidad de juego.

El estado canónico se conserva exclusivamente dentro del servidor. La proyección privada por participante es un contrato de lectura deliberadamente construido y no una serialización del motor; HTTP y WebSocket entregan la misma forma de `SnapshotPartida`. En una partida iniciada el snapshot publica `marcador`, `cartasPropias`, `cartasJugadas`, `turno`, `repartidor`, `muestra` y `desafiosPendientes`, además de identidad, versión, meta y participantes. Nunca publica cartas ajenas, mazo, entregas, IDs internos ni el estado canónico.

6B añade `auth.ok`, `game.snapshot`, `game.confirmed`, `game.rejected` y `error`. `game.confirmed` solo identifica la acción y su versión; `game.rejected` añade un código y la versión vigente. Después de una acción aceptada se emite un snapshot privado actualizado a cada suscriptor de la partida. No hay eventos públicos semánticos de adjudicación ni de ciclo de mano. Por ello, el marcador acumulado, las cartas, el turno y los desafíos pendientes están disponibles; los resultados de Envido o Flor solo pueden inferirse parcialmente de un cambio en el marcador. Tampoco se expone el nivel de la apuesta de Truco ya aceptada, el ganador de una mano, su cierre, ni un resultado terminal explícito del partido.

### Contratos de jugador automático (6C.1)

`packages/game-engine/src/jugador-automatico.ts` prepara la integración offline sin conectar aún turnos automáticos al servidor. `crearObservacionJugadorAutomatico` construye `ObservacionJugadorAutomatico` desde el estado canónico y un jugador: copia sus cartas, la muestra, tanteador, turno, bazas y cantos públicos; nunca contiene `EstadoPartida`, mazo, entregas ni cartas de rivales.

`obtenerAccionesLegalesJugador` genera intenciones posibles y conserva únicamente las que `ejecutarAccionPartida` acepta. La IA no duplica reglas ni prioridades: cartas, Envido, Flor, Truco, respuestas, aumentos y mazo siguen siendo autoridad exclusiva del motor. No existe una acción compuesta de Flor y Truco.

`PoliticaEstrategica` recibe solo la observación, esas acciones legales y una `FuenteAleatoria` inyectada. `ejecutarDecisionAutomatica` es el orquestador puro: verifica que la decisión pertenezca al conjunto legal, le asigna el jugador y la ejecuta mediante el motor. `politicaPrimeraAccionLegal` es una política mínima de prueba, no una estrategia. Esta frontera no modifica los contratos HTTP o WebSocket 6B ni agrega dependencias al motor.

### Estrategia de cartas y bazas (6C.2)

`packages/game-engine/src/estrategia-cartas.ts` incorpora `politicaEstrategicaCartas` para 1v1. Reutiliza `obtenerJerarquia` y `compararCartas` de `cartas.ts`, y `evaluarResultadosBazas` del motor para respetar piezas, alcahuete, pardas y la tabla reglamentaria de cierre. No duplica jerarquía ni reglas de determinación de la mano.

Al responder una carta pública, prioriza una victoria de mano decisiva, luego ganar, luego empardar, y en igualdad usa la carta de menor costo que logra ese resultado. Al salir, preserva cartas fuertes salvo cuando el historial deja una segunda baza potencialmente decisiva, caso en el que favorece la probabilidad de imponerse. Los desempates consumen solamente `FuenteAleatoria` inyectada.

`estimarIncertidumbre` forma el universo de cartas posibles quitando del mazo únicamente la muestra, las cartas propias y las jugadas públicas. Sus proporciones de carta rival más fuerte, igual o más débil son una heurística explicable: no sabe cuáles cartas tiene el adversario y tampoco condiciona el conjunto a un reparto oculto concreto. No hay simulación Monte Carlo, memoria del rival ni estrategia de tanteador en este slice.

La política sólo toma decisiones estratégicas entre acciones `jugar-carta`. Ante un canto o respuesta que sea la única acción legal usa el primer fallback legal del contrato 6C.1, sin presentarlo como decisión estratégica de Truco, Envido o Flor.

### Estrategia de Truco (6C.3)

`packages/game-engine/src/estrategia-truco.ts` agrega `evaluarManoParaTruco`, `evaluarRiesgoTruco`, `seleccionarAccionTruco` y la política compuesta `politicaEstrategicaTruco`. La fuerza combina las probabilidades por cada carta restante que provee `estimarIncertidumbre`, la cantidad de cartas competitivas y las bazas públicas ganadas o perdidas; no se reduce a la carta de mayor jerarquía ni consulta cartas ocultas.

El riesgo reglamentario está expresado por nivel: Truco vale 2 al aceptarse y 1 al rechazarse; Retruco, 3 y 2; Vale Cuatro, 4 y 3. Los umbrales conservadores separan aceptar de aumentar: subir exige más confianza que mantener la apuesta. La política sólo selecciona una propuesta, aceptación, rechazo o aumento que ya aparezca en las acciones legales del motor. Si una carta puede decidir inmediatamente la mano, conserva la decisión de cartas antes que abrir una apuesta nueva.

`politicaEstrategicaTruco` intenta la selección de Truco y luego reutiliza exactamente `politicaEstrategicaCartas`; no duplica su evaluación. Envido y Flor siguen sin estrategia: sus prioridades dependen del motor y el fallback legal no se presenta como una decisión inteligente. No se incluyen ajuste por tanteador, perfiles del rival, Monte Carlo ni niveles de dificultad.

### Estrategia global (6C.5)

`estrategia-global.ts` agrega una política pura para 1v1 que reconstruye memoria pública desde la observación y calcula distancia a la meta, ventaja, amenaza terminal y utilidad esperada. La utilidad combina puntos esperados con consecuencias de ganar o perder inmediatamente el partido; sus probabilidades son heurísticas explicables, no estimaciones calibradas. Preserva acciones obligatorias y respuestas pendientes antes de comparar apuestas opcionales y cartas. La incertidumbre excluye muestra, cartas propias y cartas públicas, pero distingue implícitamente el conjunto desconocido del reparto real: no presupone que toda carta desconocida sea del rival. No hay memoria entre manos, perfiles, aprendizaje, simulación compleja ni soporte estratégico 2v2.

La capa global modula propuestas y respuestas de Truco según tanteador y puede renunciar a apuestas opcionales para jugar carta. La selección de carta conserva la heurística 6C.2: no implementa todavía sacrificio de baza guiado por el tanteador ni búsqueda de futuro. Las enumeraciones de Envido/Flor son exactas sobre combinaciones públicas compatibles, pero se recomputan por decisión; son adecuadas para 1v1 interactivo y no constituyen una simulación de reparto ni de aceptación rival.

## 6. Modelo de estado y flujo de juego

El flujo reglamentario vigente es:

```text
Mesa + mazo externo
  -> ManoPreparada
  -> EstadoJuegoCartas + EstadoManoCoordinada
  -> EstadoPartida
  -> acciones, bazas, desafíos, retiros y/o vencimientos
  -> cierre definitivo de mano
  -> contabilizarManoCerrada
  -> siguienteMano o partida-finalizada
```

El coordinador valida coherencia cruzada entre cartas, cantos, adjudicaciones y ciclo de mano antes de aceptar una transición. Las transiciones rechazadas no cambian el estado. Las adjudicaciones de Flor, Envido y Truco son independientes y se registran una sola vez.

En 6B el servidor ya asocia una acción autenticada y versionada con `EstadoPartida`: la traduce a una acción del motor, aplica la transición y, cuando corresponde, contabiliza el cierre definitivo y prepara la mano siguiente en la misma operación en memoria. Luego confirma o rechaza el comando y sincroniza snapshots privados. El avance interno no se materializa como un evento de adjudicación, cierre o inicio de mano.

`EstadoTemporalMano` se usa alrededor de una mano coordinada, no alrededor de `EstadoPartida`, y todavía no está conectado al servidor 6B. Persistir versiones, acciones y snapshots, y agendar relojes, siguen siendo responsabilidades posteriores.

## 7. Arquitectura del servidor actual

`apps/server` contiene la primera frontera autoritativa de partidas online. Su almacenamiento es temporal en memoria y no sustituye la persistencia de 6D.

En 6C.6, `POST /api/matches` admite `mode: "1v1-vs-machine"`. El repositorio crea el asiento interno estable `__maquina__`, inicia el reparto de inmediato y encadena decisiones con `politicaEstrategicaGlobal` exclusivamente mediante `ejecutarDecisionAutomatica`. La máquina no posee sesión ni WebSocket y su mano nunca se proyecta al humano. Cada transición automática incrementa la versión canónica; el avance detecta estados repetidos y se detiene al requerir una decisión humana o al finalizar la partida. El flujo humano–humano conserva la sala de espera existente.

- [main.ts](../apps/server/src/main.ts) lee la configuración, abre el servidor y atiende `SIGINT`/`SIGTERM`.
- [config.ts](../apps/server/src/config.ts) valida `TRUCO_SERVER_HOST` y `TRUCO_SERVER_PORT`; los valores predeterminados son `127.0.0.1:3000`.
- [server.ts](../apps/server/src/server.ts) mantiene HTTP y conecta el upgrade `/ws` al mismo servidor y puerto.
- [websocket.ts](../apps/server/src/websocket.ts) autentica el primer mensaje, administra suscripciones privadas y distribuye confirmaciones y snapshots.
- [matches.ts](../apps/server/src/matches.ts) conserva el estado canónico en memoria, versiones, idempotencia provisional y avance de manos mediante el motor.
- [game-actions.ts](../apps/server/src/game-actions.ts) traduce intenciones de red a acciones del motor sin aceptar jugador ni estado enviados por el cliente.
- [server.test.ts](../apps/server/src/server.test.ts) verifica configuración, salud, sesiones, asientos, inicio, privacidad y concurrencia de incorporación.

Una sesión provisional de invitado se crea con `POST /api/guest-sessions`; recibe un token criptográficamente aleatorio de 256 bits y un apodo validado (3–20 caracteres, letras incluidas tildes/ñ, números, espacios, guion y guion bajo). El token se entrega únicamente al crear la sesión y autentica las rutas de partida mediante `Authorization: Bearer <token>`.

La API HTTP de 6A permanece vigente. 6B añade `/ws`: el cliente envía primero `{"type":"auth","token":"…"}`, luego `{"type":"subscribe","matchId":"…"}` y recibe `auth.ok` y `game.snapshot`. Una acción usa `game.action` con `matchId`, `actionId`, `expectedVersion` y una intención (por ejemplo `play-card`, `truco`, `envido` o `go-to-mazo`). No se aceptan jugador ni estado canónico desde la red.

Las acciones se validan y ejecutan mediante `ejecutarAccionPartida`; una aceptación incrementa la versión y emite `game.confirmed` al emisor más snapshots privados a los suscriptores. Rechazos y reintentos usan `game.rejected`; la misma pareja jugador/actionId devuelve el resultado previo si el contenido es idéntico y se rechaza si difiere. El registro está acotado en memoria. Tras un cierre definitivo, el servidor contabiliza la mano y prepara la siguiente con aleatoriedad segura, salvo al finalizar el partido.

Para iniciar, el servidor construye una `Mesa` 1v1 y reutiliza `crearMazo`, `barajarMazo`, `seleccionarPrimerRepartidor`, `prepararMano`, `iniciarJuegoCartas`, `crearEstadoManoCoordinada` y `crearEstadoPartida`. La aleatoriedad de producción proviene de `node:crypto`; la fuente de enteros se inyecta en pruebas. No hay una segunda implementación del reparto ni de las reglas.

## 8. Persistencia y acceso a datos

La configuración de Prisma está en `apps/server/prisma` y [prisma7.config.ts](../apps/server/prisma7.config.ts). El esquema usa SQLite y el cliente generado se ubica en `apps/server/src/generated/prisma/`.

El único modelo actual es `InfrastructureProbe`: demuestra migración y acceso a SQLite, pero no representa una entidad de juego. [database.ts](../apps/server/src/database.ts) construye y cierra el cliente Prisma mediante el adaptador Better SQLite3. [database-url.ts](../apps/server/src/database-url.ts) resuelve una URL `file:` local; sin `DATABASE_URL`, la base de desarrollo es `apps/server/prisma/dev.db`.

La migración `20261017000000_infrastructure_probe` y [persistence.test.ts](../apps/server/src/persistence.test.ts) prueban una migración y lectura/escritura en una base temporal aislada. No hay modelos ni persistencia de usuarios, salas, partidas, acciones, snapshots, estadísticas o transacciones de juego.

## 9. Arquitectura del cliente web actual

`apps/web` usa React 19 y Vite 7.

- [main.tsx](../apps/web/src/main.tsx) monta React en modo estricto.
- [App.tsx](../apps/web/src/App.tsx), [textos.ts](../apps/web/src/textos.ts) y [styles.css](../apps/web/src/styles.css) forman una pantalla de presentación estática.
- [App.test.tsx](../apps/web/tests/App.test.tsx) verifica su renderizado básico.

La web declara dependencias sobre el motor y `shared`, pero no tiene mesa, estado de partida, conexión HTTP o WebSocket, acciones de juego, reloj ni manejo de reconexión. No existe todavía una interfaz jugable offline u online.

## 10. Contratos compartidos y comunicación

`packages/shared` exporta `Palo`, `ValorNominal`, `Carta`, `Modalidad`, `MetaPuntos` y la constante `sharedPackage`. Constituye un vocabulario sin lógica de transporte ni reglas de juego.

El contrato HTTP de 6A usa JSON y devuelve `400`, `401`, `403`, `404`, `405` o `409` según corresponda, sin trazas ni datos internos. `POST /api/guest-sessions` recibe, por ejemplo, `{"nickname":"Ana"}` y devuelve `{"token":"…","apodo":"Ana"}`. Una creación autenticada devuelve `matchId`, asiento y snapshot. La credencial no se incluye en snapshots ni en respuestas de terceros.

El contrato WebSocket de 6B usa el mismo puerto en `/ws`. Tras `auth` y `subscribe`, entrega `auth.ok` y `game.snapshot`. `game.action` exige `matchId`, `actionId`, `expectedVersion` y una intención válida; responde `game.confirmed` con acción y versión, o `game.rejected` con acción, código y versión. Una aceptación también distribuye un `game.snapshot` actualizado a los participantes suscritos. Los errores de protocolo y autenticación usan `error` con código y mensaje.

Un snapshot de espera contiene configuración, versión, asiento propio y apodos/asientos ocupados. Tras el inicio añade marcador, repartidor, muestra, cartas propias, cartas ya jugadas, turno y desafíos pendientes. El servidor crea esa estructura desde campos permitidos: nunca serializa `EstadoPartida` para luego ocultar propiedades. El mazo, entregas, manos ajenas, IDs internos, semillas y estado canónico no forman parte del contrato.

## 11. Seguridad, autoridad y privacidad

### Estado actual

- El motor valida reglas, participantes, cartas, turnos, adjudicaciones y estados manipulados antes de transicionar.
- El motor es puro y no confía en una fuente de azar o tiempo interna.
- Las sesiones de invitado y los IDs de partida se generan con `node:crypto`; todas las operaciones de partida autentican y autorizan al participante.
- El estado canónico mantiene cartas privadas en memoria. Los snapshots se construyen explícitamente para el solicitante y solo incluyen sus cartas; participantes ajenos no pueden consultarlos.

### Arquitectura objetivo

En partidas online, Fase 6 debe colocar al servidor como autoridad: generar azar seguro, recibir acciones autenticadas, aplicar el motor, persistir cada transición de forma atómica y emitir proyecciones autorizadas. Las proyecciones deberán incluir solo las cartas del destinatario, la muestra y eventos públicos; las señas solo podrán llegar al compañero.

También son futuros: control definitivo de dispositivo, sesiones persistentes, idempotencia durable/transaccional, recuperación luego de reinicios, relojes y anulación técnica por fallas irrecuperables. La versión ya se exige en comandos WebSocket, pero sólo existe mientras el proceso continúa activo.

## 12. Pruebas y controles de calidad

Las pruebas del motor están organizadas por dominio (`cartas`, `mano`, `juego-cartas`, `envido`, `flor`, `truco`, `coordinador`, `partida`, `temporal` e `integracion`). Cubren tanto unidades reglamentarias como recorridos públicos 1v1 y 2v2, puntuación, cierres, retiros, Flor posterior al abandono, temporizadores y desconexiones.

Comandos principales desde la raíz:

- `npm run test:engine`, `npm run test:web`, `npm run test:server` y `npm run test:db` ejecutan las suites por componente.
- `npm run format:check`, `npm run lint`, `npm run check:architecture` y `npm run typecheck` ejecutan controles estáticos.
- `npm run build` genera Prisma, compila TypeScript y construye la web.
- `npm run check` encadena formato, lint, arquitectura, tipos, todas las pruebas y build.

Al cierre técnico de Fase 5, el motor tenía 214 pruebas aprobadas. El resultado de cualquier ejecución posterior debe consultarse en la salida real del comando, no inferirse de ese dato histórico.

## 13. Estado de implementación por componente

| Componente | Estado | Alcance actual |
|---|---|---|
| Game Engine | Implementado y verificado | Reglas completas de mano y partido 1v1/2v2, puntuación, retiros y tiempo lógico. |
| Tipos compartidos | Implementado | Vocabulario mínimo de cartas, modalidades y metas. |
| Servidor HTTP y WebSocket | Implementado parcialmente | Salud, sesiones y partidas 1v1 en memoria; comandos versionados, idempotencia provisional y snapshots privados por WebSocket. Sin persistencia, relojes, reconexión ni contrato de resultados semánticos. |
| Persistencia | Implementado parcialmente | Prisma/SQLite y prueba de infraestructura; sin datos de dominio. |
| Cliente web | Implementado parcialmente | Presentación React; sin mesa ni flujo de juego. |
| Seguridad online | Implementado parcialmente | Credenciales de invitado, autorización por partida, filtrado de snapshots e idempotencia acotada en memoria; sin sesiones durables, idempotencia transaccional ni recuperación. |
| Señas 2v2 | Pendiente | Catálogo, privacidad y entrega al compañero. |

## 14. Estado de la Fase 6 al cierre de 6C.4-R1

La Fase 6 reutiliza el Game Engine como núcleo reglamentario y agrega infraestructura alrededor de él. Al cierre de 6C.4-R1, los incrementos tienen el siguiente estado:

| Incremento | Responsabilidad arquitectónica |
|---|---|
| 6A | Implementado: servidor autoritativo inicial y API HTTP de partidas 1v1. |
| 6B | Implementado: autenticación inicial, suscripción privada, comandos 1v1 versionados, confirmación/rechazo y snapshots actualizados. No incluye eventos de resultado, persistencia, relojes ni reconexión. |
| 6C.1 | Implementado: contratos de observación, acciones legales, políticas intercambiables y orquestador puro para jugador automático. Sin estrategia, UI ni activación de turnos automáticos. |
| 6C.2 | Implementado: estrategia 1v1 de cartas y bazas con jerarquía canónica, conservación de fuerza e incertidumbre simple. Sin estrategia de apuestas. |
| 6C.3 | Implementado: evaluación de mano, riesgo por nivel y política compuesta de cartas con Truco, Retruco y Vale Cuatro. Sin estrategia de Envido o Flor. |
| 6C.4 | Implementado (R1): estrategia 1v1 de Envido y Flor. Selecciona explícitamente Envido, Real Envido y Falta Envido entre las acciones legales, y compone Flor → Envido → Truco → cartas. La valoración de Flor simple es determinista (3 puntos por Flor sin comparación); Contra Flor y Contra Flor al Resto sólo usan comparación cuando existe desafío. En empate de desempate, Contra Flor al Resto no se modela como victoria directa; el motor conserva la adjudicación reglamentaria de 3 puntos. Las estimaciones de comparación y prioridad de mano son deliberadamente 1v1; no se aplican silenciosamente a 2v2. |
| 6C.5 | Implementado: política global 1v1 con evaluación de tanteador, riesgo/beneficio, memoria pública reconstruida e incertidumbre explícitamente heurística. Sin 2v2. |
| 6C.6 | Implementado: integración servidor humano contra máquina, inicio inmediato, decisiones automáticas reglamentarias, versionado, privacidad y resumen público de cierre. Pendiente de validación integral hasta victoria, matriz especializada de desafíos y matriz WebSocket de secuencias automáticas. |
| 6C.7 | Pendiente: interfaz jugable. |
| 6C.8 | Pendiente: pruebas integrales. |
| 6D | Persistencia transaccional, registro de acciones e idempotencia. |
| 6E | Agenda real de relojes, desconexiones y reconexión. |
| 6F | Multijugador 2v2, proyecciones por destinatario y señas privadas. |
| 6G | Integración, endurecimiento y cierre operativo. |

HTTP crea, une, inicia y consulta recursos; WebSocket recibe acciones y sincroniza el estado vivo; el servidor valida contra el motor y la web futura presentará una proyección privada sin reproducir reglas. La persistencia deberá guardar estado canónico y metadatos de versión suficientes para recuperación, sin hacer visibles cartas ajenas.

## 15. Restricciones y decisiones pendientes

- El Reglamento y la Especificación no autorizan resolver silenciosamente vacíos funcionales.
- La continuidad de futuras manos si un participante abandona definitivamente una mesa es una decisión pendiente: no se deben inventar reemplazos, bots o derrotas automáticas.
- El snapshot 6B no expone el nivel aceptado ni el equipo aceptante de Truco/Retruco/Vale Cuatro: `desafiosPendientes.truco` solo representa una propuesta pendiente. Si 6C debe mostrar esa apuesta, se requiere decidir una ampliación explícita del contrato.
- Envido y Flor actualizan el marcador, pero 6B no publica adjudicación, ganador, tantos, puntos ni causa. Una mesa que deba explicar el resultado necesita una proyección o evento semántico definido antes de depender de esa información.
- El servidor avanza automáticamente tras el cierre de una mano, pero el contrato no identifica el ganador, la causa, el cierre ni el inicio de la siguiente mano. Tampoco expone una finalización de partido ni su ganador; llegar a la meta puede inferirse del marcador, pero no sustituye un estado terminal público.
- Las señas 2v2, salas, búsqueda, identidades, estadísticas, revancha y accesibilidad de la mesa pertenecen a trabajo futuro de producto.
- El documento anterior describía 2v2, retiros individuales, marcador acumulado y relojes como capacidades previstas. Esas capacidades son parte del motor actual; las responsabilidades de servidor y cliente siguen siendo futuras.
