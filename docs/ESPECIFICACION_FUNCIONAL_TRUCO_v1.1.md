# Especificación funcional del Truco Uruguayo — v1.1

**Proyecto:** Truco  
**Fecha de consolidación:** 17 de octubre de 2026  
**Estado:** especificación funcional consolidada para implementación incremental con Codex  
**Cobertura:** EF-001 a EF-114, con correcciones posteriores expresamente aprobadas respecto de desconexión, respuestas concurrentes y recuperación del servidor.  
**Documento normativo complementario:** `REGLAMENTO_TRUCO_URUGUAYO_v1.1.md`.

> **Regla de precedencia.** El Reglamento v1.1 es la fuente de verdad de cartas, muestra, piezas, bazas, cantos, puntos, mazo y consecuencias reglamentarias de desconexión. Esta especificación define el producto, la interfaz, la IA, las comunicaciones y la arquitectura. Las decisiones posteriores explícitas del usuario prevalecen sobre EF anteriores contradictorias y se incorporan aquí. Ante un vacío real, Codex **no debe inventar una regla**: debe identificarlo y solicitar aprobación (EF-114). No sustituir esta variante por reglas genéricas de otros trucos.

## 1. Objetivo, alcance y principios

Desarrollar un juego de Truco Uruguayo ejecutable en navegador, con partidas offline contra inteligencia artificial y multijugador online en tiempo real, para 1 contra 1 y 2 contra 2. Debe respetar exhaustivamente la variante fijada en el Reglamento v1.1, proteger información privada, ser utilizable en pantallas de distintos tamaños y poder desplegarse en internet. El producto se construirá por etapas verificables con aprobación del usuario entre etapas.

**Principios obligatorios:** (a) un único motor puro de reglas reutilizado por servidor y juego offline; (b) servidor autoritativo online; (c) nunca mostrar cartas ajenas ni señas al adversario; (d) ningún efecto visual altera turnos ni relojes; (e) registrar y validar todas las acciones legales; (f) conservar los puntos realmente adjudicados; (g) distinguir *mano*, *partido*, *sala* y *pareja de búsqueda rápida*; (h) los cambios funcionales requieren aprobación y versionado.

**Fuera del alcance inicial:** partidas online mixtas humanos/IA; observadores; chat libre; foto de avatar; login social; historial consultable de partidas individuales; reportes de usuarios; lista de espera para salas completas; búsqueda textual de salas; replays públicos; traducciones activas; garantía oficial Safari/Firefox; controles avanzados antiabuso y auditoría de seguridad exhaustiva; despliegue público en proveedor específico.

## 2. Contrato del motor de reglas y correspondencia con el reglamento

### 2.1 Reglas de cartas, mano y puntuación

La implementación **debe aplicar íntegramente** los §§1–14 y 16 del Reglamento v1.1; no basta con una versión simplificada del Truco. Para hacer explícitos los requisitos más sensibles:

- Baraja española de 40 cartas (oros, copas, espadas, bastos; 1–7, 10–12), tres cartas por jugador, muestra visible **después** del reparto, primer repartidor aleatorio y rotación antihoraria. Mano original = jugador a la derecha del repartidor; conserva ese carácter durante toda la mano.
- Cinco piezas según palo de la muestra: 2, 4, 5, 11 y 10, con fuerza estrictamente descendente y valores 30, 29, 28, 27, 27 para Envido/Flor. Si la muestra es una pieza potencial, el 12 del mismo palo la reemplaza exactamente; la carta de muestra no puede estar repartida. Respetar toda la jerarquía de 19 categorías del §4.
- Cada baza compara la mejor carta de cada equipo; resolver las quince combinaciones de bazas/pardas del §5.2. No jugar una tercera baza si la mano ya quedó resuelta. La salida de la baza siguiente corresponde al jugador de carta ganadora, con desempate entre compañeros por cercanía antihoraria al mano original; en parda sale el mano original (§5.3).
- Envido: inicio únicamente por quien debe jugar carta, antes de su carta de la primera baza; cadena única con Envidos repetibles, Real Envido como máximo una vez y Falta Envido terminal. Aumentar acepta el nivel anterior; rechazo paga el valor anterior aceptado o 1 si es la primera propuesta. Calcular tantos y empates según §6.2–6.3, Falta Envido con **marcadores al comienzo de la mano** y excepción de **2 puntos fijos en mano de desempate** (§6.6).
- Flor: las tres configuraciones del §7.1, cálculo completo del §7.2 y máximo 47. Primera Flor solo en turno propio antes de la primera carta; Flores adicionales habilitadas fuera de turno después del primer anuncio. Flor omitida voluntariamente se pierde; si expira el turno, anunciarla automáticamente antes de jugar. Sin desafío, **cada equipo cobra tres puntos por cada Flor propia**, incluso si ambos equipos tienen Flor. Contra Flor aceptada/rechazada y Contra Flor al Resto siguen estrictamente §§7.5–7.6; **Contra Flor al Resto aceptada gana el partido directamente fuera del desempate**, pero en desempate paga **3 puntos fijos**, sin victoria directa. Admitir «Con Flor Quiero» y «Flor y Truco» con prioridad correcta.
- Truco/Retruco/Vale Cuatro: aceptados 2/3/4 puntos, sin aceptación 1; rechazados 1/2/3 para el equipo proponente. Solo inicia Truco el jugador cuyo turno de carta está activo; los aumentos se rigen por quién aceptó el nivel anterior (§8).
- Mazo: botón deshabilitado si hay cualquier desafío pendiente. En 2v2, mazo individual deja al compañero activo; la carta ya jugada en la baza sigue contando, y la no jugada no se exige. Si ambos compañeros van al mazo, el contrario gana **la mano**, no automáticamente el partido (§9). En 1v1 se adjudica la mano conforme al nivel de Truco aceptado.
- Puntuación por equipos, meta 30/40 (40 predeterminado), malas/buenas 15/15 o 20/20; nunca truncar marcadores. Flor/Envido y Truco pueden dar puntos a equipos diferentes en la misma mano. La victoria anticipada exige imposibilidad matemática de que el rival alcance o supere el marcador con todos los puntos aún legalmente disponibles; si hay duda, continuar. Empate de ambos en o por encima de la meta obliga a otra mano con puntajes conservados; aplicar excepciones de desempate (§11).
- Prioridad: Flor sobre Envido y Truco; Envido válido sobre Truco pendiente; conservar explícitamente apuestas suspendidas y retomarlas sin borrarlas. Rechazar Truco termina la mano sin borrar puntos previos.
- Reloj de 10 segundos por decisión. Al vencer: respuesta «No quiero»; turno de carta: cantar Flor todavía válida si corresponde y jugar la **carta de menor fuerza real**, desempate de cartas igualmente débiles por oros, copas, espadas, bastos (§13).

### 2.2 Contrato lógico mínimo

El paquete de reglas expondrá una operación conceptual `aplicarAccion(estado, accion) → {estadoNuevo, eventos}` o rechazo estructurado, sin dependencias de React, transporte, base de datos ni IA. Los estados deben representar: partido y mano; posiciones y equipos; repartidor/mano original; mazo/muestra/cartas; turno y baza; cartas ya jugadas y retiradas; cadenas y desafíos pendientes o suspendidos; Flores habilitadas, anunciadas u omitidas; marcador inicial de mano y marcador actual; adjudicaciones y sus causas; relojes externos como eventos/entradas explícitas; condición de desempate; victoria ordinaria o excepcional. La representación concreta queda a diseño técnico sin alterar comportamiento.

El motor debe producir información pública y privada separable; el servidor aplica una proyección autorizada por destinatario. Cada transición inválida se rechaza sin mutar el estado. El orden de eventos es determinista dado un estado, acción y fuente aleatoria inyectada. Nunca confiar en el cliente para barajar, validar puntos o declarar ganadores online.

### 2.3 Desconexión: corrección posterior que sustituye las EF antiguas

**Se conservan literalmente las consecuencias reglamentarias del §15.1 del Reglamento v1.1.** Una desconexión online pausa a todos hasta 30 segundos; si el jugador vuelve, se recupera su estado y se reanuda con un turno de **10 segundos completos** para quien deba actuar. Si no vuelve, **se considera que fue al mazo**, no que su equipo perdió automáticamente el partido. En 2v2 el compañero continúa solo; si ambos integrantes se retiran, el adversario gana **la mano** y sus puntos correspondientes; se conservan los puntos de Flor/Envido ya otorgados. En 1v1, aplicar §9.1. Esta decisión **reemplaza** cualquier texto previo de EF-025 o EF-086–092 que declarara derrota inmediata del partido, victoria automática del rival, anulación por expiraciones en ambos equipos o adjudicación de estadísticas de partido basada en tal derrota. La partida sigue hasta un final válido según §11, siempre que queden participantes para jugar.

Los relojes de reconexión son individuales, de 30 segundos cada uno; la desconexión de otra persona no reinicia ni extiende los anteriores. La partida no corre mientras existan desconexiones todavía dentro de sus ventanas. Al vencer una ventana, se aplica el mazo correspondiente y deja de bloquearse la partida por ese jugador. Si todavía existen otros desconectados dentro de sus ventanas, se sigue esperando su retorno o vencimiento. Cuando la mano termina por mazo de todos los activos de un equipo, el motor adjudica solo los puntos reglamentarios. **No crear un resultado «partido sin ganador» por el solo hecho de que ambos equipos hayan tenido desconexiones**: ese criterio de las antiguas EF queda desplazado. Si una combinación extrema de retiradas simultáneas no está resuelta de forma inequívoca por el reglamento, detener esa transición, registrar el caso y solicitar definición; no inventar puntos ni ganadores.

La salida voluntaria de la **aplicación/partida** y la acción **«Irse al mazo»** deben distinguirse en la interfaz. En la primera versión, toda salida durante una mano que reglamentariamente se traduzca en abandono de juego se resolverá como retiro individual conforme a §9, sin asignar por ello una derrota automática de partido. Si existe desafío pendiente, la acción ordinaria «Irse al mazo» continúa prohibida: el sistema no debe eludir ese bloqueo fingiendo un «No quiero» sin una regla aprobada. Las consecuencias de una salida voluntaria con desafío pendiente que no se puedan derivar inequívocamente del reglamento quedan **pendientes de definición explícita**, no autorizan una implementación ad hoc.

### 2.4 Acciones concurrentes y recuperación técnica

Si dos compañeros intentan responder o aumentar el mismo desafío, **solo la primera acción válida procesada y confirmada por el servidor** modifica el estado. La segunda se rechaza por versión/estado obsoleto, sin doble respuesta ni doble puntuación. Las operaciones de juego usan IDs únicos e idempotencia y se confirman tras persistencia atómica (EF-099).

Una caída **general del servidor** no equivale a desconexión individual: suspende todos los relojes de juego y reconexión punitiva; se reconstruye el último estado consistente, se espera a recuperar las conexiones necesarias y se reanuda con reloj de acción completo. Si no se puede recuperar la integridad, se anula técnicamente el partido sin adjudicar victoria, derrota ni abandono. No confundir esta anulación técnica con la resolución reglamentaria de mazo.

## 3. Matriz íntegra de requisitos EF-001 a EF-114

Los identificadores se preservan para trazabilidad, aunque se agrupan por ámbito. Las correcciones posteriores figuran como **[REVISADA]**; no debe reutilizarse su redacción histórica contradictoria.

### 3.1 Producto, modos y acceso — EF-001 a EF-008

**EF-001 — Plataforma.** Aplicación web responsive para escritorio, tableta y teléfono; interacción con ratón y tacto. No requerir instalación nativa.

**EF-002 — Modalidades iniciales.** Offline: humano vs IA (1v1); humano + IA vs dos IA (2v2). Online: dos humanos (1v1); cuatro humanos (2v2). No mezclar humanos y bots online en v1.

**EF-003 — Acceso al multijugador.** Tres entradas diferenciadas: búsqueda rápida, sala privada por enlace/código y listado de salas públicas. Mostrar estados de búsqueda, sala y partido sin confundirlos.

**EF-004 — Equipos.** Búsqueda rápida 2v2 asigna equipos automáticamente; salas públicas y privadas permiten elección de equipo según vacantes. En mesa 2v2, compañeros en posiciones opuestas.

**EF-005 — Configuración de sala.** Anfitrión fija 1v1/2v2 y meta 30/40, predeterminada 40; inicio manual cuando estén todos los asientos ocupados, equipos válidos y condiciones de listo satisfechas. Primer repartidor aleatorio.

**EF-006 — Búsqueda rápida.** Siempre a 40 puntos. Cola individual 1v1 o 2v2; posibilidad de entrar en pareja preformada mediante enlace/código para ser compañeros en 2v2. Inicio automático cuando se complete emparejamiento válido.

**EF-007 — Identidad por modo.** Offline sin cuenta. Online admite invitado con apodo y usuario registrado opcional; cuenta habilita identidad persistente, amigos y estadísticas.

**EF-008 — Vínculos sociales.** Registrados tienen amigos, presencia e invitaciones. Invitados pueden entrar en salas y formar pareja rápida por código/enlace, sin amistad persistente.

### 3.2 Mesa, interacción y presentación — EF-009 a EF-026

**EF-009 — Dirección visual.** Mesa de madera rústica, sin paño verde, baraja española y estética sobria; identidad visual tradicional sin sacrificar claridad.

**EF-010 — Distribución.** Usuario local abajo; en 2v2 compañero arriba y rivales a izquierda/derecha; en 1v1 rival arriba. Solo cartas propias boca arriba; ajenas boca abajo; muestra visible. Resaltar repartidor y jugador activo. Diseño adaptable a móvil.

**EF-011 — Jugar cartas.** Un toque/clic en carta legal la juega inmediatamente, sin confirmación ni deshacer. Impedir jugadas fuera de turno o con desafío pendiente. Reloj 10 s; aviso privado de Flor antes de primera carta.

**EF-012 — Controles legales.** Mostrar/habilitar solo cantos, aumentos, respuestas y mazo permitidos por el estado y el reglamento; el servidor igualmente valida todo. Mazo deshabilitado ante desafío pendiente.

**EF-013 — Anuncio de cantos.** Burbuja breve junto a quien canta y anuncio central transitorio; no detener ni prolongar el reloj.

**EF-014 — Marcador.** Tantos tradicionales agrupados de cinco y cifra numérica, diferenciación malas/buenas según meta, nombres de equipos, puntaje real incluso por encima de meta y manos de desempate.

**EF-015 — Historial visual de bazas.** Miniaturas de cartas jugadas en bazas concluidas, participantes y resultado (ganador/parda), en orden cronológico; disposición compacta en móvil; se reinicia por mano.

**EF-016 — Reloj visual.** Anillo circular con 10 segundos y cifra visible junto al jugador/decisión correspondiente; alerta visual en los tres segundos finales. Animaciones y comunicaciones no lo detienen.

**EF-017 — Envío de señas.** Panel exclusivo de 2v2 con las once señas aprobadas en Reglamento §12.2; solo opciones legalmente disponibles según cartas aún en mano, «sin cartas importantes» y cadencia mínima de un segundo. Seña enviada visible solo al compañero, sin indicación a rivales de que se envió; sin alterar turnos/reloj.

**EF-018 — Recepción de señas.** Aviso privado breve y recordatorio persistente de la **última** seña recibida durante la mano; una nueva reemplaza la anterior; limpiar al comenzar la siguiente mano; rivales no reciben contenido ni metadatos que delaten la seña.

**EF-019 — Expresiones predefinidas.** En online, frases de catálogo, visibles para todos, sin texto libre; no cambian el tiempo de acción. Catálogo preciso y limitación de frecuencia no definidos: tratarlos como configuración de producto pendiente, no como mensajes arbitrarios ni chat libre.

**EF-020 — Audio.** Efectos tradicionales para cartas, cantos, puntos y eventos, sin música ni voz. Control de activar/desactivar accesible en cualquier momento; toda información importante también se muestra visualmente.

**EF-021 — Animaciones.** Breves y fluidas para reparto, cartas, bazas, cantos, puntos y fin; nunca bloquean la posibilidad de actuar ni alteran el reloj oficial.

**EF-022 — Panel informativo.** Panel plegable con número/estado de mano, repartidor e historial cronológico **público** de cantos, respuestas, bazas y puntos. Sin cartas ocultas, señas, estrategias ni información privada. No pausa online.

**EF-023 — Fin de partido.** Mostrar ganador, marcador final real (sin truncar), manos ganadas por equipo, puntos por Truco/Envido/Flor y duración; botones «Volver a jugar» y «Menú principal». Para anulación técnica, mostrar claramente que no hubo ganador.

**EF-024 — Revancha online.** Requiere aceptación unánime de todos los participantes de la partida finalizada, conserva participantes, equipos y meta, pero reinicia puntos, baraja, manos y reparte con repartidor inicial aleatorio. Estadísticas del nuevo partido separadas. Reglas de votación EF-075–085.

**EF-025 — Salida [REVISADA].** Confirmar salida voluntaria de un partido online; distinguir salida de aplicación de «Irse al mazo» y no conceder derrota automática de partido por una retirada individual. Aplicar §9 y §15.1 cuando corresponda. Offline salir termina la sesión sin guardar partida. Desconexión involuntaria: ventana de 30 s. **Salida voluntaria durante desafío pendiente requiere resolución normativa expresa si el reglamento no la determina**; no saltar restricciones de mazo.

**EF-026 — Pausa offline.** Botón de pausa manual que congela reloj y acciones de IA; reanudar exactamente el mismo estado. Sin guardado ni continuación tras cerrar. Online no tiene pausa manual.

### 3.3 Inteligencia artificial y perfiles — EF-027 a EF-045

**EF-027 — Dificultades IA.** Fácil (decisiones sencillas/subóptimas), Normal (competente), Difícil (estratégica); todas conocen y respetan todas las reglas. Ninguna ve cartas ajenas ni manipula reparto o azar; IA compañera interpreta señas. Un nivel elegido para todas las IA del partido; sin dificultad adaptativa.

**EF-028 — Preparación offline.** Elegir 1v1 o 2v2, Fácil/Normal/Difícil y 30/40 (40 por defecto). En 2v2: humano + IA contra dos IA. Repartidor inicial aleatorio.

**EF-029 — Señas IA.** Compañero virtual envía espontáneamente señas tradicionales legales y puede interpretar las del humano; únicamente información a la que tendría acceso un jugador legítimo; estrategia depende de dificultad.

**EF-030 — Ritmo IA.** Acciones con demora variable aproximada de 0,5–2 s, siempre dentro de reloj de 10 s; pausa offline congela las demoras pendientes. El retardo no cambia la decisión estratégica ni permite información futura.

**EF-031 — Identificación.** Cada asiento muestra apodo y avatar; bots llevan insignia «IA» inequívoca. Asiento, turno, reparto y acciones visualmente reconocibles.

**EF-032 — Avatares.** Catálogo de ilustraciones tradicionales; elección persistente para registrados y temporal para invitados; IA usa catálogo con marca «IA». Sin carga de imágenes propias.

**EF-033 — Nombres IA.** Apodos tradicionales aleatorios, distintos dentro del partido, constantes en revancha offline, no editables y sin relación con dificultad; siempre marca «IA».

**EF-034 — Invitado.** Elige apodo y avatar al entrar online; conserva datos durante la sesión, sin correo ni cuenta, sin garantía de persistencia entre visitas.

**EF-035 — Registro.** Apodo, correo electrónico único y contraseña; almacenar solo hash seguro, recuperación por correo y cierre de sesión. No login social inicialmente. El apodo no es identificador único.

**EF-036 — Estadísticas registradas.** Partidos jugados, ganados, perdidos y tasa de victoria; separación 1v1/2v2; manos y bazas ganadas; puntos por Truco, Envido y Flor, incluidos sus aumentos/variantes; cantos realizados y aceptados. Sin listado consultable de partidas individuales en v1. No atribuir victoria/derrota por el mero mazo individual; computar el resultado **real del partido**.

**EF-037 — Segmentación.** Separar estadísticas offline/online y, dentro de cada una, 1v1/2v2. Offline sin cuenta no presupone persistencia entre sesiones; definir alcance de persistencia local solo si se implementa sin contradecir EF-007.

**EF-038 — Amigos.** Registrados buscan por apodo (resolviendo homónimos por ID), envían solicitud, aceptan/rechazan, consultan pendientes y mantienen amistades persistentes; invitados sin amigos persistentes.

**EF-039 — Presencia.** Disponible / Jugando / Desconectado, actualizada automáticamente; no revelar sala privada, cartas, modalidad ni otros datos no autorizados.

**EF-040 — Invitación.** Un amigo puede invitar a otro a una sala privada **ya creada y todavía en lobby**; invitación incluye remitente, modo y meta. Aceptar entra si queda plaza; en 2v2 elegir equipo; anfitrión inicia al cumplirse requisitos. No invitar a partido en curso. La pareja rápida por código/enlace es mecanismo separado.

**EF-041 — Bloqueo.** Eliminar amistad, bloquear y desbloquear. Bloquear elimina amistad y prohíbe nuevas solicitudes y **invitaciones directas a salas privadas** entre ambos; no garantiza separación en salas públicas ni búsqueda rápida. Desbloquear no restaura amistad. Sin sistema de reportes en v1.

**EF-042 — Privacidad del perfil.** Apodo/avatar públicos; estadísticas detalladas visibles únicamente al propietario y a amigos aceptados. Correo y contraseña nunca visibles en perfiles. Configuración fija en v1.

**EF-043 — Identificador.** Apodos pueden repetirse; cuenta registrada posee ID persistente único y visible para desambiguar búsqueda, invitaciones y estadísticas. Invitados no poseen ID persistente de cuenta (pueden tener identificador técnico de sesión privado).

**EF-044 — Edición.** Registrado cambia apodo/avatar cuando quiera, sin límite de frecuencia inicial; mantiene ID, amistades y estadísticas.

**EF-045 — Validación de apodos.** Entre 3 y 20 caracteres; letras con tildes/ñ, números, espacios, guion y guion bajo; sin emojis ni otros símbolos. Validar en cliente **y servidor** para invitados y registrados. No exigir unicidad.

### 3.4 Salas públicas/privadas y lobby — EF-046 a EF-065

**EF-046 — Desconexión en lobby.** Reservar asiento y equipo 30 s; reconexión restaura posición; vencimiento libera plaza; salida voluntaria la libera inmediatamente. No comenzar sala incompleta ni con reserva desconectada.

**EF-047 — Transferencia de anfitrión.** Si sale voluntariamente, transferir de inmediato; si se desconecta, conservar rol hasta vencer 30 s y transferir si no regresa. Mantener configuración. Sala vacía se cierra.

**EF-048 — Nuevo anfitrión.** Jugador **conectado** de mayor antigüedad en la sala por orden de ingreso, sin importar equipo.

**EF-049 — Expulsión.** Anfitrión puede expulsar con confirmación a otros participantes de lobby **privado**, nunca en sala pública ni partido en curso; libera asiento, avisa y no altera estadísticas.

**EF-050 — Reingreso de expulsado.** No puede volver a esa misma sala privada mientras exista, aun con código/enlace, identificado por cuenta o sesión, nunca solo por apodo. Puede entrar en otras salas o colas.

**EF-051 — Sala reutilizable.** Tras terminar partido público/privado y no iniciar revancha, volver a lobby de la **misma** sala; se conservan publicidad, código, nombre, modo y meta. Pueden salir/entrar participantes, cambiar equipos y prepararse para nuevo partido; reiniciar marcador, baraja y repartidor aleatorio al comenzar. Revancha unánime es un flujo diferente.

**EF-052 — Cierre por inactividad.** Sala sin ocupantes se cierra al vencer reservas. Lobby ocupado sin actividad relevante durante 30 min se cierra tras aviso; no aplicar a partido en curso. Regresar a menú de salas.

**EF-053 — Aviso de inactividad.** A los 25 min, advertencia con cuenta atrás y botón «Mantener sala abierta» utilizable por cualquier participante; restablece plazo de 30 min; repetible.

**EF-054 — Directorio público.** Filtrar por modalidad (1v1/2v2/todas), meta (30/40/todas), disponibilidad de plazas (con plazas/todas). Mostrar nombre, apodo de anfitrión, ocupación y estado. Sin búsqueda textual. Privadas excluidas.

**EF-055 — Nombre de sala.** Predeterminado `Sala de [apodo del creador]`, editable por creador al crearla; no exige unicidad; se conserva si cambia anfitrión.

**EF-056 — Cambios de configuración.** Anfitrión puede cambiar modo/meta **solo cuando sea único ocupante** y no haya partido; reservas de desconectados bloquean edición. Vale para lobby reutilizado y anfitrión transferido.

**EF-057 — Sala pública llena.** Sigue visible como «Completa», no permite ingreso ni lista de espera; filtro de plazas libres la oculta.

**EF-058 — Sala en partido.** Sigue visible en directorio público como «Jugando», sin ingreso ni espectadores; privada nunca aparece.

**EF-059 — Cambio de equipo.** En lobby 2v2 público/privado se puede cambiar a un equipo con asiento libre; no desplazar jugadores ni intercambiar equipos completos. Reflejar inmediatamente. Equipo inmóvil durante partido.

**EF-060 — Asignación al entrar.** En lobby 2v2 cada ingresante elige manualmente equipo con vacante antes de ocupar plaza de equipo. No autoasignar (salvo búsqueda rápida).

**EF-061 — Creador 2v2.** El creador también debe elegir equipo manualmente; ser anfitrión no implica equipo determinado.

**EF-062 — Listos e inicio.** Todos, incluido anfitrión, marcan «Estoy listo». Solo anfitrión inicia manualmente cuando sala completa, equipos válidos, todos listos y conectados. No autoarranque de salas; sí de búsqueda rápida.

**EF-063 — Reinicio de listos.** Cada jugador alterna listo/no listo. Cambio de integrantes o distribución de equipos reinicia **todos** a no listos.

**EF-064 — Desconexión y listos.** Durante reserva de 30 s, solo el desconectado pasa a no listo; los demás conservan estado. Al regresar debe marcar listo de nuevo. Si vence reserva y se libera asiento, reiniciar todos según EF-063. No iniciar durante desconexión.

**EF-065 — Espera de listos.** Sin límite individual de tiempo para marcar listo; sigue vigente cierre de lobby por inactividad a los 30 min.

### 3.5 Búsqueda rápida y parejas — EF-066 a EF-074

**EF-066 — Cancelación individual.** Cancelar búsqueda antes de emparejar de inmediato, sin confirmación, castigo, derrota ni estadísticas; volver a pantalla anterior.

**EF-067 — Cancelación de pareja buscando.** Si cualquiera cancela búsqueda conjunta, se cancela para ambos y se avisa; **la pareja persiste** para intentar otra búsqueda.

**EF-068 — Desconexión de pareja buscando.** Suspender búsqueda de ambos hasta 30 s; si vuelve, reanudar automáticamente; si no, cancelar sin sanción y conservar pareja. Conectado puede cancelar voluntariamente según EF-067.

**EF-069 — Desconexión de búsqueda individual.** Suspender hasta 30 s; reconectar retoma; expirar cancela sin sanción.

**EF-070 — Duración de búsqueda.** No hay máximo de espera; mostrar tiempo transcurrido y posibilidad de cancelar; plazo de reconexión es independiente.

**EF-071 — Creación de pareja rápida.** Un jugador crea código/enlace para 2v2, otro se une, ambos conectados; **solo el creador** inicia búsqueda conjunta. El emparejador garantiza que sean compañeros.

**EF-072 — Disolución fuera de búsqueda.** Si cualquiera abandona voluntariamente pareja cuando no está buscando ni jugando, se disuelve, se notifica a ambos, vuelven al menú rápido y código queda inválido; sin sanción.

**EF-073 — Desconexión en pareja inactiva.** Conservar pareja 30 s sin iniciar búsqueda; regreso restaura; vencimiento disuelve, avisa y no sanciona.

**EF-074 — Dos acciones durante búsqueda de pareja.** «Cancelar búsqueda»: inmediata, mantiene pareja. «Abandonar pareja»: requiere confirmación, cancela búsqueda de ambos, disuelve pareja, invalida código, notifica; sin penalización.

### 3.6 Revancha y reinicio — EF-075 a EF-085

**EF-075 — Votación.** Al terminar partido online se abre ventana de **30 s**; solo aceptación de **todos** produce revancha. Rechazo o silencio hasta vencimiento cancela.

**EF-076 — Desconexión votando.** No pausa ni reinicia esos 30 s; votos previos se conservan; solo puede comenzar revancha si todos aceptaron **y están conectados** antes de vencer.

**EF-077 — Inicio automático de votación.** Todos reciben votación al finalizar partido; no se necesita solicitud inicial.

**EF-078 — Si falla revancha.** Participantes de sala vuelven a lobby de esa sala; participantes de búsqueda rápida al menú de búsqueda, sin búsqueda automática.

**EF-079 — Pareja rápida persistente.** Si no hay revancha, la pareja preformada 2v2 sigue existiendo para nueva búsqueda por iniciativa del creador, mientras no se disuelva conforme a EF-072–074.

**EF-080 — Revancha offline.** «Volver a jugar» inicia de inmediato nuevo partido con mismo modo, nivel IA y meta; puntuación/baraja reiniciadas y repartidor inicial aleatorio.

**EF-081 — Identidad IA en revancha.** Conservar nombres, avatares y roles (compañero/oponente); no arrastrar cartas ni información de mano previa.

**EF-082 — Salida durante votación.** Equivale a rechazo inmediato, cancela revancha para todos; no constituye abandono del partido ya terminado ni genera derrota/abandono estadístico.

**EF-083 — Cuenta atrás.** Tras aceptación unánime, mostrar cuenta atrás sincronizada de **3 s** antes de iniciar nuevo partido.

**EF-084 — Desconexión durante cuenta atrás.** Cancela revancha de inmediato, sin iniciar partido ni aplicar consecuencias de abandono.

**EF-085 — Salida durante cuenta atrás.** Cancela revancha de inmediato para todos, sin confirmación ni penalización.

### 3.7 Salida de partida, mazo y reconexión — EF-086 a EF-092 [REVISADAS]

**EF-086 — Retirada en 2v2 [REVISADA].** Un jugador que deja de participar **no causa derrota automática del partido**. Su retiro reglamentario equivale a ir al mazo; su compañero sigue jugando solo, sin reemplazo por IA. Si ambos compañeros se retiran, el rival gana **la mano** (§9.2). Si la salida ocurre con desafío pendiente, respetar la prohibición de mazo y señalar la necesidad de resolución expresa en vez de inventar una respuesta.

**EF-087 — Puntos reales [REVISADA].** Conservar todos los puntos válidamente adjudicados; no otorgar puntos artificiales ni forzar una victoria del partido por abandono. Adjudicar únicamente la mano y sus puntos según el reglamento y luego evaluar el marcador §11.

**EF-088 — Estadísticas 2v2 [REVISADA].** No registrar derrotas de partido de ambos compañeros por el mero abandono individual. Partidos ganados/perdidos se derivan del **resultado real**. Un eventual contador personal de retiros/desconexiones puede registrarse separado por modo, sin transformarse en sanción ni victoria ficticia; su definición exacta debe mantenerse diferenciada del resultado del partido.

**EF-089 — Retirada 1v1 [REVISADA].** Ir al mazo adjudica **la mano** al rival por el valor de Truco aceptado (§9.1), no automáticamente el partido. El resultado final del partido depende del marcador y §11.

**EF-090 — Desconexiones en ambos equipos [REVISADA].** No declarar automáticamente «partido sin ganador» por vencimientos de reconexión en ambos equipos. Aplicar a cada jugador su retiro reglamentario y evaluar la mano/partido. Casos sin resolución inequívoca (p. ej., ausencia simultánea de todo jugador activo) deben marcarse pendientes, no resolverse con resultados inventados. La anulación técnica por falla irrecuperable del servidor es un supuesto **distinto** (EF-098/103).

**EF-091 — Plazos individuales.** Cada desconectado tiene ventana propia de **30 s**, no ampliada por otras desconexiones; el partido se pausa mientras haya desconectados todavía en período de retorno. Tras su vencimiento se aplica mazo al jugador y deja de esperárselo. Al reanudar, el jugador que deba actuar dispone de **10 s completos**.

**EF-092 — Concurrencia de desconexiones [REVISADA].** Si se desconectan jugadores de ambos equipos, esperar individualmente retornos o expiraciones; aplicar mazo por cada vencimiento, sin victoria/derrota automática de partido por equipo. Reanudar cuando no queden reconexiones pendientes y exista continuación reglamentaria posible. Mantener integridad de cartas ya jugadas y puntos de Flor/Envido adjudicados.

### 3.8 Servidor, integridad y persistencia — EF-093 a EF-103

**EF-093 — Autoridad.** Servidor online determina reparto/azar, turnos, acciones válidas, cantos, tiempos y puntos. Enviar a cada cliente únicamente información autorizada: cartas propias, muestra y eventos públicos; señas solo al compañero. Rechazar acciones inválidas, duplicadas o fuera de turno. Offline reutiliza motor localmente.

**EF-094 — Comunicación.** WebSocket bidireccional para estado en vivo, sala, búsqueda, cantos, acciones y señas privadas. HTTP para registro, sesión, perfiles, amistades y estadísticas. Asegurar autenticación/autorización también en mensajes WebSocket.

**EF-095 — Snapshot de reconexión.** Dentro de ventana de 30 s, autenticar sesión y enviar fotografía **actualizada y filtrada por jugador**: cartas propias restantes, muestra, marcador, mesa, turnos, desafíos, relojes y señas privadas pertinentes; nunca cartas de otros ni señas ajenas. Continuar solo cuando se cumplan condiciones de reconexión.

**EF-096 — Control de dispositivo.** Cuenta registrada puede iniciar sesión en varios dispositivos, pero solo **uno** controla su partida activa. Transferencia explícita de control invalida el controlador previo; no reinicia partida ni relojes. Sesiones no controladoras no reciben datos privados de partida salvo autorización de diseño explícita.

**EF-097 — Recarga/reapertura.** Intentar recuperar automáticamente sesión y partida online dentro de ventana de 30 s, con snapshot actualizado; sin pedir reingresar por código ni reconstruir estado desde el navegador.

**EF-098 — Caída del servidor [ACLARADA].** Persistir partidas recuperables; durante falla general suspender relojes de juego y penalizaciones de desconexión. Recuperar último estado consistente y esperar conexiones necesarias antes de continuar, con 10 s completos al retomar. Si imposible, anular partido sin victoria/derrota/abandono.

**EF-099 — Atomicidad e idempotencia [ACLARADA].** Cada acción online tiene ID único, número de versión/orden y validación; guardar acción validada y estado resultante de forma atómica **antes** de confirmar. Reintentos con mismo ID devuelven resultado ya confirmado sin duplicar efectos. Ante dos respuestas simultáneas de compañeros a un desafío, gana la primera acción válida confirmada; rechazar la otra por estado obsoleto.

**EF-100 — Motor TypeScript puro.** Paquete compartido de reglas sin dependencias de UI, red o IA; transición de estado + acción a estado nuevo/eventos o rechazo. Misma semántica offline y servidor online.

**EF-101 — Pruebas de reglas.** Cobertura automatizada exhaustiva de reglas y excepciones del Reglamento §16, partidas completas, acciones inválidas, regresiones y escenarios de concurrencia/reconexión. Ninguna etapa funcional se acepta si sus pruebas obligatorias fallan.

**EF-102 — Aleatoriedad y trazas.** Inyectar semilla determinista para tests/reproducción; registrar información suficiente para reconstruir estados y diagnosticar errores, protegida del acceso de rivales. Reparto real impredecible. No visor público de replays en v1.

**EF-103 — Inconsistencia grave.** Suspender **solo** el partido afectado, registrar incidente, intentar restaurar último estado persistido válido; si no puede garantizarse integridad, anular sin ganador, derrotas ni abandono y comunicarlo a jugadores.

### 3.9 Stack, entrega, calidad y gobierno — EF-104 a EF-114

**EF-104 — Stack.** Frontend React + TypeScript; backend Node.js + TypeScript; paquete de reglas compartido. Evitar duplicación de reglas cliente/servidor.

**EF-105 — Base de datos.** **SQLite + Prisma**, decisión expresa pese a limitaciones de concurrencia. Usar transacciones en operaciones críticas, índices y gestión de bloqueos; aislar repositorios para facilitar migración futura si escala. No cambiar a PostgreSQL sin aprobación.

**EF-106 — Monorepo modular.** `apps/web`, `apps/server`, `packages/game-engine`, `packages/shared` (estructura conceptual); dependencias aisladas, tests por módulo, comandos raíz, esquema/migraciones Prisma y documentación.

**EF-107 — Desarrollo local.** Requiere Node.js, gestor de paquetes y SQLite; **no** requiere Docker. Proveer comandos unificados de instalación, configuración, migración, desarrollo, pruebas y build; `.env.example` y guía de arranque reproducible.

**EF-108 — Desarrollo por etapas.** Codex implementa incrementos con entregables, pruebas y criterios de aceptación verificables. Cada etapa debe ser **validada y aprobada expresamente por el usuario** antes de avanzar. No considerar aprobadas automáticamente etapas futuras.

**EF-109 — Navegadores oficialmente probados v1.** Chrome y Edge en escritorio; Chrome en Android. No bloquear deliberadamente otros, pero Safari/Firefox no cuentan con garantía oficial inicial.

**EF-110 — Seguridad esencial v1.** Autenticación, sesiones, contraseñas con hash seguro, servidor autoritativo, autorización y filtrado de datos privados, rechazo de acciones inválidas/duplicadas. Controles antiabuso avanzados y pruebas de seguridad dedicadas quedan para fases posteriores. Esto **no** autoriza exponer información sensible ni omitir validación de servidor.

**EF-111 — Preparación para producción.** Build de producción, configuración por entorno, HTTPS/WSS, almacenamiento SQLite persistente, migraciones y documentación de despliegue. No se selecciona proveedor ni se exige publicación pública efectiva en v1.

**EF-112 — Accesibilidad básica obligatoria.** Navegación por teclado, controles con nombres identificables, contraste suficiente, tipografía legible, foco visible y equivalentes visuales para sonidos. Procurar compatibilidad con lectores de pantalla en funciones principales. No exigir conformidad integral WCAG en v1. Incluir verificaciones en aceptación de interfaz.

**EF-113 — Idioma.** Interfaz solo en español de Uruguay en v1; preservar términos tradicionales. Centralizar textos de interfaz y separarlos de identificadores/reglas para facilitar futuras traducciones; sin selector de idiomas inicialmente.

**EF-114 — Gobierno de especificaciones.** Reglamento y esta especificación son referencias obligatorias y versionadas. Ante ambigüedad, contradicción o cambio funcional relevante, Codex debe informar, proponer alternativas y **pedir aprobación previa**. Toda modificación aprobada se registra en nueva versión, con efecto en pruebas y criterios de aceptación. No cambiar silenciosamente reglas ni comportamiento confirmado.

## 4. Flujos y máquinas de estado requeridos

### 4.1 Partido y mano

Un partido comienza con modo, meta, equipos y participantes válidos. Elegir repartidor inicial al azar; para cada mano barajar, repartir tres cartas por jugador en orden reglamentario, revelar muestra, establecer mano original y turnos. Fases conceptuales: preparación → mano en juego → desafíos pendientes/suspendidos → resolución de baza → adjudicación de puntos → evaluación de victoria anticipada o fin de mano → siguiente mano / desempate / fin de partido. La interfaz no define reglas; reproduce el estado del motor. Registrar eventos públicos cronológicos y eventos privados por destinatario.

La resolución de mano puede ocurrir por bazas, rechazo de Truco, mazo reglamentario o victoria excepcional por Contra Flor al Resto. Una Flor omitida voluntariamente no genera puntos. La adjudicación de puntos debe poder producir puntos para ambos equipos en la misma mano. No cerrar partido al cruzar meta si todavía existe posibilidad legal de empate/superación; no truncar puntajes.

### 4.2 Desafíos

Modelar al menos: tipo de desafío, proponente/equipo, receptor/equipo, valor actual, niveles previos aceptados, posibilidades de aumento, momento de apertura, quién puede responder, temporizador y desafío de Truco suspendido por Flor/Envido. Una respuesta válida resuelve para todo el equipo. La primera acción confirmada gana en carrera concurrente. Si vence el reloj de respuesta, «No quiero». La pantalla muestra solo acciones legales; el servidor verifica siempre.

### 4.3 Salas y colas

Estados distinguibles: menú → sala/pareja/búsqueda → lobby con asientos y equipos → listos → partido → votación de revancha → cuenta atrás / retorno al lobby o menú. Las salas públicas se listan aun completas o jugando, pero no admiten nuevos jugadores en esos estados. Las privadas requieren código/enlace o invitación válida y no aparecen en el directorio. El anfitrión solo inicia sala completa, conectada, con equipos válidos y todos listos. Búsqueda rápida no usa anfitrión de sala ni estado listo y comienza automáticamente.

### 4.4 Identidad y permisos

Roles separados: invitado, registrado, anfitrión de sala, participante, controlador activo de cuenta, IA offline. Permisos validados en backend: modificar sala, expulsar, elegir equipo, marcar listo, iniciar, enviar invitación, administrar amistad, responder canto, jugar carta, enviar seña, acceder a estadísticas privadas. El anfitrión no obtiene acceso a cartas ajenas ni a señas de rivales. El cliente nunca recibe secretos que solo «oculta visualmente».

### 4.5 Reconexión, pausas y reanudación

Distinguir **pausa manual offline**, **espera de reconexión individual online** y **suspensión por falla de infraestructura**. No mezclar temporizadores: acción 10 s, desconexión 30 s, lobby 30 min/advertencia a 25 min, revancha 30 s y cuenta atrás 3 s. Los temporizadores son autoritativos en servidor online; el cliente presenta el tiempo restante. Tras reconexión válida y retorno de condiciones para jugar, reiniciar a 10 s el turno de acción pertinente. Una expiración individual produce mazo reglamentario, no final artificial del partido.

## 5. Modelo de datos lógico mínimo

La implementación debe contemplar, sin imponer nombres de tablas definitivos: `Cuenta` (ID único, apodo, correo único, hash de contraseña, avatar, estado), `Sesion` (invitado/registrado, autenticación, dispositivo controlador), `Amistad` y `SolicitudAmistad`, `Bloqueo`, `Invitacion`, `Sala` (tipo, código privado, nombre, modo, meta, anfitrión, estado, actividad), `Asiento` (usuario/sesión, equipo, orden de ingreso, listo, conexión/reserva), `ParejaRapida`, `Busqueda`, `Partido` (tipo, participantes, equipos, meta, resultado y causa), `EstadoPartida` persistido/versionado, `AccionConfirmada` idempotente, `Evento` público/privado con control de acceso, `Estadistica` por persona/modalidad/entorno, y registros de fallas/recuperación. Es una enumeración conceptual, no una orden de exponer todas estas entidades como tablas independientes.

**Privacidad de almacenamiento:** cartas ocultas, semillas y señas se almacenan protegidas y jamás se envían a un destinatario no autorizado. No registrar contraseñas ni tokens en trazas. Las estadísticas de partidas anuladas técnicamente no asignan victorias/derrotas. La eliminación o retención de datos personales no fue definida expresamente en EF-001–114: no inventar una política de conservación o borrado; antes de despliegue público debe resolverse de acuerdo con obligaciones aplicables y aprobación del usuario.

**SQLite:** diseñar transacciones cortas y control de concurrencia; confirmar acciones únicamente tras persistencia de transición consistente; manejar conflictos de versión y reintentos. Los IDs de acción son únicos por contexto de juego, con respuesta idempotente. Repartos de producción no usan semillas previsibles.

## 6. API y eventos: obligaciones de comportamiento

No se fijan nombres de endpoints ni formatos wire definitivos, pero el contrato debe cubrir: autenticación, recuperación de cuenta, edición de perfil, amistad/bloqueos, consulta autorizada de estadísticas; directorio/creación/unión/abandono de salas, asientos, equipos, listo, inicio, expulsión, invitación; creación/unión/disolución de pareja rápida, búsqueda/cancelación; acciones de juego (carta, canto, respuesta, aumento, mazo, seña); snapshot de reconexión; votos de revancha y su cuenta atrás.

Cada comando de juego lleva identidad autenticada de sesión, referencia de partido, ID de acción y versión esperada. El servidor devuelve confirmación o rechazo con causa comprensible y versión vigente; emite eventos públicos a todos y privados únicamente al destinatario. Las señas **no** se difunden por canal público ni se filtran por presencia, historial o logs visibles a adversarios. El cliente debe soportar reconexión, deduplicación de eventos y snapshot como estado autoritativo, sin inventar cartas faltantes.

## 7. Comportamientos visuales y accesibilidad verificables

La mesa debe conservar legibilidad en móviles y permitir acciones táctiles sin hover obligatorio. El teclado debe poder recorrer cartas propias, cantos y respuestas; el foco debe ser visible. Los controles se deshabilitan/ocultan según legalidad, pero se explica de forma accesible por qué una acción no está disponible cuando resulte útil. Los eventos críticos —turno, canto, respuesta, puntos, victoria, desconexión, reconexión y cuenta atrás— tienen indicación visual independiente de audio. La seña privada no aparece en notificaciones globales ni puede observarse desde la cuenta rival. Las animaciones se pueden omitir en el render si el estado avanza más rápido; jamás se pierde un evento oficial por la animación.

## 8. Plan de implementación incremental propuesto (EF-108)

Este orden es una **propuesta de ejecución**, no una modificación de las 114 EF. Cada etapa exige demo verificable, pruebas automáticas pertinentes, documentación actualizada y aprobación explícita antes de avanzar:

1. **Base del repositorio:** monorepo, TypeScript, React/Node, Prisma/SQLite, scripts, configuración, CI/test/build, modelos compartidos.
2. **Motor de reglas completo:** baraja/muestra/piezas, reparto, turnos, bazas/pardas, Envido, Flor, Truco, mazo, reloj, puntos, desempates, prioridad y casos §16. Probar exhaustivamente antes de conectar interfaz.
3. **Offline jugable:** mesa responsive, modos 1v1/2v2, IA en tres niveles, señas privadas con IA, pausa, temporizadores, revancha, sonido y animaciones.
4. **Cuentas y perfiles:** invitado, registro/recuperación, avatar/apodo, amistades, bloqueo, privacidad y estadísticas segmentadas.
5. **Salas online:** servidor autoritativo, WebSocket, lobby público/privado, asientos/equipos/listos, anfitrión, expulsión, invitaciones, ciclo de sala y cierres por inactividad.
6. **Juego online robusto:** acciones versionadas/idempotentes, privacidad por destinatario, reconexión/mazo reglamentario, recuperación de servidor, transferencias de control, pruebas concurrentes.
7. **Búsqueda rápida y parejas:** colas 1v1/2v2, parejas por enlace/código, cancelaciones, suspensiones y persistencia de pareja.
8. **Revancha y cierre:** votación, desconexión, cuenta atrás, resultados/estadísticas, refinamiento visual, accesibilidad, navegadores objetivo y documentación de despliegue.

La división puede ajustarse con aprobación, pero no se omiten pruebas ni se implementan etapas posteriores sin validar la anterior.

## 9. Pruebas de aceptación obligatorias

### 9.1 Motor reglamentario

Implementar **todos** los casos de Reglamento §16, incluyendo pruebas parametrizadas de las quince filas de §5.2 y todas las jerarquías. Construir repartos físicamente posibles (sin cartas duplicadas y con muestra fuera de las manos). Probar 1v1 y 2v2, con retiradas individuales antes/después de jugar carta en baza, sin tercer turno innecesario, prioridad de cantos, empate de tanto por mano original, varias Flores sin desafío, cadena arbitraria de Envidos, rechazo de apuestas, Contra Flor al Resto normal/desempate, Falta Envido con marcador inicial, metas sobrepasadas, victoria anticipada conservadora y empates sucesivos. Verificar autojuego de carta mínima por fuerza real y desempate fijo de palos, Flor automática y rechazo automático de desafíos.

### 9.2 Seguridad de información y concurrencia

Dos clientes rivales no pueden recibir cartas privadas ni señas del otro, incluso inspeccionando mensajes de red, snapshots, logs accesibles e historial público. Una seña solo llega al compañero; verificar cooldown de 1 s y catálogo de 11. Acciones duplicadas no puntúan dos veces. Respuestas simultáneas de compañeros confirman solo una. Intentos fuera de turno, con carta inexistente, con versión obsoleta o sobre desafío resuelto son rechazados sin cambios de estado.

### 9.3 Desconexiones y recuperación

Probar retorno antes de 30 s y reloj renovado de 10 s; vencimiento 30 s → mazo, compañero 2v2 continúa, cartas previas siguen en baza y puntos adjudicados se conservan; vencimientos múltiples independientes; no generar derrota automática del partido; pausa de acción mientras espera reconexión; lobby reserva y cambios de listo; pareja rápida suspendida; votación de revancha que no se pausa; cuenta atrás cancelada ante desconexión. Simular caída de servidor con restauración íntegra y sin penalizaciones, y falla irrecuperable con anulación técnica sin resultado deportivo.

### 9.4 Flujos completos de producto

Validar offline 1v1/2v2 en tres niveles, pausa/revancha y señas con IA; online invitado/registrado; salas públicas y privadas, cambios de anfitrión, expulsión y veto, equipos y listos, persistencia postpartido; búsqueda rápida individual y pareja; perfiles/amigos/bloqueos/estadísticas; accesibilidad por teclado, avisos visuales y responsive; navegadores objetivo; builds y migraciones. Las estadísticas no deben contar partidos anulados ni inventar victorias por mazo individual.

## 10. Vacíos acotados que no autorizan inventar reglas

Las siguientes precisiones **no están aprobadas como nuevas reglas** y no deben resolverse silenciosamente. Se documentan para que Codex pida aprobación cuando una etapa concreta las necesite:

1. **Salida voluntaria con desafío pendiente:** el Reglamento §9 prohíbe mazo mientras haya desafío, y las EF anteriores de derrota inmediata de partido fueron sustituidas. Se requiere criterio explícito para una salida definitiva en ese preciso estado, sin vulnerar el bloqueo de mazo ni forzar una respuesta no acordada.
2. **Todos los jugadores activos retirados simultáneamente:** si la combinación no produce ganador de mano de forma inequívoca según §9, no atribuir arbitrariamente mano, puntos o partido.
3. **Continuación de partido con un participante retirado definitivamente:** el reglamento define continuidad del compañero en 2v2 y adjudicación de la mano; no define exhaustivamente reasignación de asientos o continuidad de **manos futuras** con plazas vacías. No introducir bots, reemplazos humanos ni derrotas automáticas sin autorización.
4. **Detalle de contadores de abandono:** se acordó previamente un contador personal, pero la revisión eliminó su uso como criterio de derrota automática. Registrar hechos objetivos si se implementa, sin inferir resultados deportivos; precisar exposición y condiciones si aparece ambigüedad.
5. **Catálogo y frecuencia exacta de frases predefinidas**, **formato visible del ID de cuenta** y **política formal de conservación/borrado de datos** no fueron especificados; su definición no debe modificar reglas ni privacidad acordadas.

Estos puntos **no invalidan** las decisiones confirmadas ni autorizan a sustituirlas. Cuando afecten a una etapa, detener únicamente la implementación de la transición ambigua, plantear alternativas y esperar la aprobación del usuario (EF-114).

## 11. Control de cambios y trazabilidad

**Versión 1.1 — 17/10/2026.** Cambio EF-009 aprobado expresamente por el usuario: la mesa pasa de paño verde y madera a madera rústica sin paño verde, para reflejar la presentación solicitada del Truco Uruguayo. No se modifican reglas del Reglamento. En la Etapa 3, la implementación y sus criterios de aceptación deberán verificar esta dirección visual y mantener la claridad y accesibilidad; las pruebas visuales correspondientes se actualizarán al implementarla. La pantalla inicial existente aún no implementa la mesa.

**Versión 1.0 — 17/10/2026.** Consolidación de EF-001–EF-114. Incorporación de decisiones posteriores de coherencia: prevalencia de Reglamento §15.1 sobre antiguas EF-025 y EF-086–092; reinicio a 10 s tras reanudación; primera respuesta válida confirmada en carreras de compañeros; suspensión y recuperación diferenciada ante caída general del servidor. **El Reglamento v1.1 no se modifica.**

Para cada cambio futuro, registrar: identificador, versión anterior/nueva, motivo, reglas/EF afectadas, aprobación del usuario, cambios de implementación y pruebas actualizadas. Una modificación de reglas exige revisar primero el Reglamento versionado; una modificación de producto exige revisar esta especificación. No interpretar ausencia de una prueba como permiso para cambiar el comportamiento.

---

**Criterio de finalización de v1:** producto ejecutable localmente y preparable para producción, modos offline/online acordados, reglas y casos de aceptación verificados, privacidad de cartas y señas garantizada, documentación y comandos reproducibles, y cada etapa aprobada por el usuario. Las ambigüedades pendientes deben quedar resueltas mediante aprobación antes de que el flujo afectado pueda declararse completo.
