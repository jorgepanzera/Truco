# Reglamento del Truco Uruguayo — Versión 1.7

**Proyecto:** Truco
**Tipo:** especificación normativa de las reglas del juego
**Estado:** versión normativa vigente, completa y autocontenida; incorpora todas las decisiones aprobadas hasta el 8 de noviembre de 2026, incluidas las de retiro al mazo y la excepción de Envido frente a una propuesta pendiente de Truco. Las precisiones no acordadas se distinguen expresamente de las reglas confirmadas.
**Alcance:** partidas de 1 contra 1 y 2 contra 2; puntuación a 30 o 40 puntos. Las modalidades de conexión, la interfaz, la arquitectura y la estrategia de la IA se describirán en documentos separados.

> **Principio de interpretación.** Este documento describe **la variante acordada para este proyecto**, no pretende representar todas las variantes del Truco Uruguayo. Cuando una regla aquí especificada difiera de otras tradiciones, prevalece este documento. **No se deben inventar reglas** para cubrir los casos identificados como pendientes.

## 1. Terminología y estructura

- **Partido:** sucesión de manos hasta que se determina un ganador según las reglas de puntuación y desempate.
- **Mano (ronda):** reparto de tres cartas a cada jugador, exposición de una muestra y desarrollo de las apuestas y hasta tres bazas.
- **Mano original:** jugador inmediatamente a la derecha del repartidor al inicio de esa mano. Su identidad no cambia durante esa mano, aunque cambie el jugador que sale en una baza.
- **Baza:** enfrentamiento de una carta por cada jugador que siga activo. Una mano se decide por las bazas conforme al §5.
- **Equipo:** en 1 contra 1, cada jugador es su propio equipo; en 2 contra 2, los compañeros forman un equipo de dos.
- **Muestra:** carta expuesta que determina el palo de las piezas.
- **Pieza:** carta especial definida por el palo de la muestra; puede existir una sustitución por el 12 (alcahuete).
- **Parda:** baza empatada en la mayor jerarquía de las cartas jugadas por los equipos.
- **Tocar Envido**, **cantar Flor**, **gritar Truco**: verbos normativos usados para estas acciones.
- **Desafío pendiente:** apuesta o canto que exige respuesta y suspende la progresión ordinaria hasta resolverse.
- **Jugador activo:** participante que no se retiró de la mano y puede recibir turnos, jugar cartas y ejercer los derechos que le correspondan.
- **Jugador retirado:** participante que se fue al mazo individualmente. Conserva sus cartas ya jugadas como hechos históricos de la baza, pero no recibe turnos, no juega cartas, no declara ni responde y sus cartas no jugadas permanecen privadas e inutilizables.
- **Victoria competitiva:** determinación del equipo ganador de la mano por bazas, rechazo o abandono. Puede requerir liquidaciones reglamentarias pendientes antes del cierre definitivo de la mano.

## 2. Participantes, posiciones y reparto

### 2.1 Modalidades de jugadores

- **1 contra 1:** dos jugadores, un equipo por jugador.
- **2 contra 2:** cuatro jugadores, compañeros enfrentados y turnos alternados entre equipos alrededor de la mesa.
- Las reglas de cartas, bazas, apuestas y puntuación son comunes a partidas online y offline. Las reglas de comunicación privada entre compañeros se describen en §12.

### 2.2 Baraja

Baraja española de **40 cartas**: cuatro palos (**oros, copas, espadas y bastos**), con los valores **1, 2, 3, 4, 5, 6, 7, 10, 11 y 12** en cada palo. No hay 8 ni 9 ni comodines.

### 2.3 Inicio y rotación

1. Se elige **aleatoriamente** el primer repartidor.
2. Se reparten **tres cartas a cada jugador** y se expone **una muestra**.
3. El repartidor entrega primero una carta al **mano original** (jugador a su derecha), continúa con **una carta por jugador en sentido antihorario** y repite ese recorrido hasta que cada participante tenga tres cartas. El orden de juego y la rotación del repartidor también siguen el sentido antihorario.
4. El repartidor cambia al siguiente jugador en sentido antihorario después de cada mano, incluidas las manos de desempate.
5. El **mano original** es el jugador a la derecha del repartidor; se conserva como referencia para los desempates de Envido, Flor y bazas.
6. **Después de completar el reparto**, se expone la muestra. La muestra no pertenece a ningún jugador ni se juega como carta.
7. Todos pueden ver la muestra antes de empezar a jugar. Una animación de reparto carta por carta no debe impedir que cada jugador consulte sus propias cartas.

## 3. Muestra y piezas

### 3.1 Piezas del palo de la muestra

De mayor a menor jerarquía:

| Carta del palo de la muestra | Jerarquía entre piezas | Valor para Envido/Flor |
|---|---:|---:|
| 2 | 1.ª (máxima) | 30 |
| 4 | 2.ª | 29 |
| 5 | 3.ª | 28 |
| 11 | 4.ª | 27 |
| 10 | 5.ª | 27 |

**Atención:** el 11 y el 10 tienen el mismo valor numérico de Envido/Flor (**27**), pero **no** la misma fuerza para ganar bazas: el 11 supera al 10.

### 3.2 El 12 «alcahuete»

Si la carta expuesta como muestra es una de las cinco piezas potenciales (2, 4, 5, 11 o 10), el **12 del mismo palo** reemplaza **exactamente a esa pieza**, con su jerarquía y su valor de Envido/Flor. Ejemplos:

- Muestra = 2 de oros: el **12 de oros** pasa a ser la pieza máxima, con valor **30**.
- Muestra = 4 de copas: el **12 de copas** reemplaza al 4 de copas, con valor **29**.
- Muestra = 11 de espadas: el **12 de espadas** reemplaza al 11 de espadas, con valor **27** y fuerza superior a la pieza 10 de espadas.

La pieza expuesta como muestra **no está disponible en las manos**. El 12 sustituto sí puede repartirse y cuenta como pieza a todos los efectos. Si la muestra no es una de las cinco piezas potenciales, el 12 de ese palo **no** se transforma y conserva su jerarquía ordinaria.

## 4. Jerarquía de cartas para ganar bazas

De mayor a menor fuerza:

1. Pieza 2 del palo de la muestra, o su 12 sustituto.
2. Pieza 4 del palo de la muestra, o su 12 sustituto.
3. Pieza 5 del palo de la muestra, o su 12 sustituto.
4. Pieza 11 del palo de la muestra, o su 12 sustituto.
5. Pieza 10 del palo de la muestra, o su 12 sustituto.
6. 1 de espadas.
7. 1 de bastos.
8. 7 de espadas.
9. 7 de oros.
10. Todos los 3 ordinarios (iguales entre sí).
11. Los 2 que no sean piezas (iguales entre sí).
12. 1 de oros y 1 de copas (iguales entre sí).
13. Los 12 ordinarios (iguales entre sí).
14. Los 11 ordinarios (iguales entre sí).
15. Los 10 ordinarios (iguales entre sí).
16. 7 de copas y 7 de bastos (iguales entre sí).
17. Todos los 6 (iguales entre sí).
18. Los 5 ordinarios (iguales entre sí).
19. Los 4 ordinarios (iguales entre sí).

La jerarquía depende de la **muestra de esa mano**. Una carta ordinaria no gana fuerza por compartir palo con otra carta, salvo su condición explícita de pieza o alcahuete.

## 5. Bazas y determinación del ganador de la mano

### 5.1 Reglas generales

- Cada jugador activo juega como máximo una carta por baza.
- Se comparan las cartas según el orden de §4. En 2 contra 2, **la carta más fuerte de cada equipo** determina el resultado de la baza; no se suman cartas de compañeros.
- Una baza puede ganarla el equipo A, el equipo B o resultar **parda**.
- La mano termina en cuanto las bazas jugadas determinan de forma definitiva al ganador. **No se juega una tercera baza innecesaria.**
- El equipo del **mano original** es la referencia para desempates de la mano especificados abajo.

### 5.2 Tabla exhaustiva de resultados de bazas

En esta tabla, `A` y `B` son equipos distintos, `P` significa parda y `M` significa **equipo del mano original**. La columna «tercera» indica cuándo corresponde jugarla.

| Primera | Segunda | Tercera | Ganador de la mano |
|---|---|---|---|
| A | A | No se juega | A |
| B | B | No se juega | B |
| A | P | No se juega | A |
| B | P | No se juega | B |
| P | A | No se juega | A |
| P | B | No se juega | B |
| A | B | A | A |
| A | B | B | B |
| A | B | P | M |
| B | A | A | A |
| B | A | B | B |
| B | A | P | M |
| P | P | A | A |
| P | P | B | B |
| P | P | P | M |

**Regla corregida expresamente:** si la primera la gana A y la segunda es parda, **A gana de inmediato**; no se disputa una tercera baza para que B intente revertirla.

### 5.3 Salida y orden de juego

El **mano original** inicia la primera baza y, a partir del jugador que sale, el turno avanza en sentido antihorario. En las bazas siguientes:

1. **Baza ganada:** primero se identifica el **autor histórico** de la carta de mayor jerarquía que ganó esa baza, aunque sea distinto del mano original. Si dos compañeros empatan en la jerarquía máxima ganadora, se aplica el desempate del punto 2 sobre todas las cartas válidamente jugadas, incluidas las de jugadores posteriormente retirados. Solo después de identificar ese autor histórico se consulta su actividad: si está activo, sale él; si está retirado, sale el primer jugador activo posterior a él en sentido antihorario. La búsqueda es circular, omite a todos los jugadores retirados y puede seleccionar a un jugador del equipo contrario.
2. **Dos compañeros empatan en la jerarquía máxima ganadora:** el autor histórico es el compañero que esté **más cerca del mano original siguiendo el orden antihorario**. No se sustituye este procedimiento por la elección del mejor autor todavía activo.
3. **Baza parda:** sale el **mano original**, aunque otro jugador haya iniciado la baza parda. Si el mano original está retirado, sale el primer jugador activo posterior a él en sentido antihorario.
4. Si la mano ya quedó decidida, no se abre otra baza.

Estas reglas de salida individual son independientes del criterio de qué **equipo** ganó la baza y de los desempates de la mano establecidos en §5.2.

## 6. Envido

### 6.1 Momento y prioridad

- El **primer Envido de la mano** solo puede tocarlo el jugador **a quien le toca jugar una carta**, **antes de jugar su carta de ese turno**, y únicamente **antes de que termine la primera baza**. Puede ocurrir después de que otros jugadores ya hayan jugado sus cartas de esa baza.
- **Excepción ante Truco pendiente:** cuando un jugador activo deba responder una propuesta pendiente de **Truco, Retruco o Vale Cuatro**, puede iniciar el primer Envido aunque no tenga el turno de jugar carta, siempre que la primera baza no haya terminado, no exista una cadena de Envido anterior y no haya una fase de Flor pendiente con prioridad. En 2 contra 2 puede hacerlo cualquier integrante activo del equipo habilitado para responder; no se habilita al equipo proponente ni a retirados. Esta excepción permite el farol, no transfiere el turno de carta y no acepta ni cancela la propuesta de Truco.
- No se puede **iniciar una segunda cadena independiente** de Envido en esa mano. Los Envidos sucesivos, Real Envido y Falta Envido son **aumentos de la misma cadena pendiente**, no nuevos inicios.
- Las **respuestas y aumentos** a un Envido pendiente pueden efectuarse fuera del turno de jugar carta por un integrante habilitado del equipo que debe responder. Una respuesta compromete al equipo completo.
- Un Envido pendiente se resuelve antes de seguir jugando cartas.
- Si aparece una **Flor**, tiene prioridad y **desplaza/cancela** el Envido: no se cobran simultáneamente puntos de Envido y Flor por esa misma situación.
- Si hay un Truco pendiente y se toca válidamente Envido, **se resuelve primero el Envido** y luego se retoma la **misma** propuesta pendiente, conservando nivel, proponente y equipo respondedor. Hasta que la cadena de Envido termine no se puede responder ni aumentar ese Truco. Puede mostrarse el aviso «El Envido está primero».

### 6.2 Cálculo del tanto de Envido

Los valores numéricos de las cartas ordinarias son: 1–7 según el número impreso; 10, 11 y 12 valen **0**. Las piezas tienen los valores especiales de §3.

Para una mano **sin Flor**:

1. **Sin piezas, con al menos dos cartas del mismo palo:** el tanto es **20 + suma de los valores numéricos de las dos mejores cartas de ese palo**. Si hubiera tres cartas del mismo palo, sería Flor, no Envido.
2. **Sin piezas y sin dos cartas del mismo palo:** el tanto es el **mayor valor numérico individual**.
3. **Con exactamente una pieza y sin Flor:** el tanto es el **valor de la pieza + el mayor valor numérico de las otras dos cartas**, aunque esas cartas sean de palos distintos.

El **máximo Envido es 37** (pieza de 30 + carta ordinaria de valor 7). Las manos que contienen dos o más piezas constituyen Flor y se rigen por §7.

**Ejemplos:** 6 y 7 del mismo palo sin piezas = 33; 7, 6 y 3 de palos distintos sin piezas = 7; pieza de 30 más 7 ordinario y otra carta ordinaria = 37, siempre que no configure Flor.

### 6.3 Comparación y empate

- En 1 contra 1 se comparan los tantos individuales.
- En 2 contra 2, el equipo compite con el **mayor tanto individual de sus integrantes**; **no se suman** los tantos de compañeros.
- En caso de igualdad de tantos máximos, gana el jugador empatado que esté **primero desde el mano original siguiendo el orden antihorario**. Gana su equipo.

### 6.4 Escalera de apuestas

- **Envido:** suma **2 puntos** al valor aceptado; puede repetirse arbitrariamente en una cadena legal.
- **Real Envido:** suma **3 puntos**; solo puede aparecer **una vez** en la cadena.
- **Falta Envido:** apuesta final; no se puede aumentar después.
- Después de **Real Envido**, únicamente puede aumentarse a **Falta Envido**.
- Aumentar una apuesta implica **aceptar implícitamente el nivel anterior**.

Ejemplos de cadenas legales: `Envido → Envido → Real Envido → Falta Envido`; `Real Envido → Falta Envido`; `Envido → Envido → Envido`.

### 6.5 Aceptación, rechazo y puntos

Si la cadena termina en **«Quiero»**, se compara el tanto y se otorga al equipo ganador el valor aceptado: **2 por cada Envido + 3 por Real Envido**, o el valor calculado de Falta Envido si esa fue la apuesta aceptada.

Si termina en **«No quiero»**, gana el equipo que hizo la última apuesta **el valor del nivel anterior ya aceptado**; si se rechaza la primera apuesta de la cadena, gana **1 punto**. Una subida cuenta como aceptación del nivel anterior.

| Cadena y respuesta final | Puntos por rechazo para quien hizo la última apuesta |
|---|---:|
| Envido → No quiero | 1 |
| Real Envido → No quiero | 1 |
| Falta Envido → No quiero | 1 |
| Envido → Envido → No quiero | 2 |
| Envido → Envido → Envido → No quiero | 4 |
| Envido → Real Envido → No quiero | 2 |
| Real Envido → Falta Envido → No quiero | 3 |
| Envido → Envido → Real Envido → No quiero | 4 |

La tabla es ilustrativa de una **regla general**, no un límite al número de Envidos consecutivos.

### 6.6 Falta Envido: base de cálculo

El cálculo utiliza **los marcadores al comienzo de la mano**, **no** los puntos transitorios ya obtenidos por Flor, Envido u otros conceptos dentro de esa misma mano.

Sea `T` el objetivo del partido (**30** o **40**) y `H = T/2` el comienzo de buenas (**15** o **20**). Se toma el puntaje inicial `s` del **equipo que finalmente gana el Falta Envido**:

- **Ambos equipos comienzan en malas** (`s_A < H` y `s_B < H`): se conceden `H − s` puntos, suficientes para llegar a buenas.
- **Ambos equipos comienzan en buenas** (`s_A >= H` y `s_B >= H`): se conceden `T − s` puntos, suficientes para llegar al objetivo, **salvo en manos de desempate**, según el apartado siguiente.
- **Uno comienza en malas y el otro en buenas:** si gana el equipo que empezó en malas, se conceden `H − s` puntos; si gana el que empezó en buenas, `T − s` puntos.

Ejemplo a 40: si ambos comenzaron en malas y el ganador tenía 12 puntos al comienzo, Falta Envido aceptado y ganado concede **8 puntos** (`20 − 12`).

**Excepción de desempate:** si una mano comienza con **ambos equipos empatados en el objetivo o por encima de él**, por continuación de un partido empatado (§11.3), la **Falta Envido aceptada vale 2 puntos fijos**. No se utiliza `T − s`, que en esos casos sería cero o negativo. Se mantienen las reglas generales de rechazo de la cadena de Envido (§6.5).

**Importante:** alcanzar el objetivo con Falta Envido **no siempre finaliza el partido en ese instante**: rige la evaluación de victoria matemáticamente asegurada del §11.

### 6.7 Retiro al mazo y Envido

El retiro individual no cancela una cadena colectiva mientras quede un integrante activo de su equipo; los tantos del retirado quedan excluidos de comparaciones posteriores.

- Si el último activo del equipo respondedor se retira con cadena pendiente, se aplica No quiero implícito: se adjudican los puntos reglamentarios del rechazo y, además, los puntos de mano por abandono.
- Si el equipo proponente se retira completamente antes de recibir respuesta, la propuesta queda sin efecto, no genera puntos adicionales y el adversario gana la mano por abandono.
- Si un equipo se retira completamente después de aceptar y antes de comparar tantos, pierde el desafío por el valor completo aceptado, además de los puntos de mano por abandono. No se aplica valor de rechazo.
- Las adjudicaciones ya resueltas no se recalculan.

## 7. Flor

### 7.1 Cuándo existe Flor

Una mano individual tiene **Flor** cuando cumple **al menos una** de estas condiciones:

1. Sus **tres cartas son del mismo palo**.
2. Tiene **dos o más piezas**.
3. Tiene **exactamente una pieza** y las otras dos cartas **son del mismo palo entre sí**.

El 12 alcahuete se considera pieza si sustituye a la pieza expuesta como muestra.

**Flor prevalece sobre Envido**. No existe la modalidad «Con Flor Envido» en esta variante.

### 7.2 Valor de Flor

- **Sin piezas, tres cartas del mismo palo:** `20 + suma de los valores numéricos de las tres cartas` (las figuras ordinarias valen 0).
- **Con una o más piezas:** se toma el **valor completo de la pieza más alta**; por cada **otra pieza**, se agrega su valor especial **menos 20**; por cada **carta ordinaria**, se agrega su valor numérico (figuras ordinarias = 0).

**Ejemplos:** tres cartas ordinarias 7, 6 y 5 del mismo palo = `20+7+6+5 = 38`; piezas 2, 4 y 5 del palo de muestra = `30+(29−20)+(28−20) = 47`; piezas 2 y 4 del palo de muestra más 7 ordinario = `30+9+7 = 46`.

El **máximo de Flor es 47**.

### 7.3 Obligación de cantar y prioridad

- **La primera Flor** solo puede anunciarla un jugador **en su propio turno de jugar carta y antes de jugar su primera carta**.
- Una vez que se anuncia esa primera Flor, **los demás jugadores con Flor** pueden anunciar las suyas **fuera de turno**, mientras mantengan el derecho a hacerlo y la fase de Flor esté abierta.
- Cada jugador con Flor recibe un **aviso privado** antes de jugar su primera carta. Si, pese al aviso, **juega esa carta sin cantar Flor**, pierde definitivamente el derecho a **anunciar y cobrar** esa Flor. No puede recuperarlo en la segunda baza. Una Flor omitida no cuenta para desafíos ni para puntos.
- Si **vence el reloj de diez segundos** de ese turno y el jugador todavía tiene una Flor no anunciada, **el sistema la canta automáticamente** antes de ejecutar una jugada automática de carta. Esta excepción por tiempo agotado no restituye Flores perdidas por haber jugado voluntariamente la primera carta.
- La Flor se resuelve **antes del Envido y del Truco** cuando haya acciones pendientes que compitan por prioridad. Si un adversario toca Envido y se anuncia una Flor válida, se cancela el Envido.
- La fase de Flor **no se cierra** hasta que todos los jugadores que aún puedan anunciar Flor hayan tenido oportunidad de hacerlo y todos los desafíos hayan sido resueltos. **Una Contra Flor ya planteada no impide que otro jugador habilitado anuncie su Flor** antes de la resolución definitiva.

Cuando ambos equipos hayan anunciado al menos una Flor y no exista desafío pendiente, la **siguiente carta válida** consume la oportunidad de proponer Contra Flor o Contra Flor al Resto. Una carta rechazada no consume oportunidad, no confirma fase ni adjudica puntos. Tras consumirla no hay desafío nuevo; derechos restantes pueden anunciar fuera de turno o perderse al jugar voluntariamente primera carta. La fase se confirma y adjudica al no quedar derechos ni desafío; el cierre puede derivar de anuncio, carta válida o resolución. No cambian valores, empates, secuencias, Quiero/No quiero ni victoria excepcional.

### 7.4 Flores sin desafío

**Regla central de esta variante:** si **no se plantea Contra Flor ni Contra Flor al Resto**, **cada equipo recibe 3 puntos por cada Flor propia**, **sin comparar** valores con el equipo contrario.

| Flores del equipo A | Flores del equipo B | Puntos para A | Puntos para B |
|---:|---:|---:|---:|
| 1 | 0 | 3 | 0 |
| 1 | 1 | 3 | 3 |
| 2 | 1 | 6 | 3 |
| 2 | 2 | 6 | 6 |

Por tanto, tener Flor más alta **no** priva al adversario de sus tres puntos si nadie desafía. La legitimidad de una Flor anunciada se verifica automáticamente contra las tres cartas originales y la muestra, sin acción de exhibición ni revelación de cartas privadas al adversario.

### 7.5 Contra Flor

- Solo es posible cuando **ambos equipos tienen al menos una Flor**.
- Puede plantearse **una sola vez** en la secuencia: **no** existe `Contra Flor → Contra Flor`.
- **Aceptada:** se compara la **Flor individual más alta** de cada equipo; gana el equipo con la mayor. El equipo ganador recibe **3 puntos por cada Flor propia**; el equipo perdedor recibe **0**. No se añade una bonificación extra por el desafío.
- **Rechazada por el equipo respondedor:** el equipo que desafió recibe **3 puntos por cada Flor propia** y el equipo que rechazó recibe **0**, sin comparar valores.
- **Empate de Flor:** prevalece el jugador empatado más próximo al **mano original en sentido antihorario**; gana su equipo.

### 7.6 Contra Flor al Resto

- Puede plantearse **directamente después de Flor** o **como aumento después de Contra Flor**.
- **Aceptada en una mano ordinaria:** se comparan las Flores individuales más altas, con el desempate del §7.5. **El equipo ganador gana inmediatamente el partido**, sin importar el marcador previo. Esta es una **regla especial acordada** para el proyecto.
- **Aceptada en una mano de desempate** (§11.3): **no** da victoria directa. La comparación se realiza igual y el equipo ganador **cobra 3 puntos fijos**. El partido se decide con el marcador y las reglas de §11.
- **Rechazada por el equipo respondedor:** el equipo que lanzó el desafío recibe **3 puntos por cada Flor propia** y el equipo que lo rechazó recibe **0**. No se produce victoria automática, salvo que la puntuación determine una victoria conforme al §11.

### 7.7 Respuestas compuestas vinculadas a Truco

- **«Con Flor Quiero»** es acción compuesta y atómica: anuncia Flor y acepta propuesta pendiente de **Truco, Retruco o Vale Cuatro**. Acepta exactamente nivel 2, 3 o 4 para eventual resolución, sin puntos inmediatos. Solo la usa integrante del equipo respondedor con Flor y derecho vigente; no restituye derecho perdido. Excepción exclusiva: permite su primer anuncio fuera de turno, sin habilitar anuncio ordinario fuera de turno. Flor conserva prioridad, incluidos anuncios y desafíos posteriores, y cancela Envido pendiente cuando corresponde.
- **«Flor y Truco» no es una acción válida.** No existe un canto compuesto que anuncie Flor y proponga Truco en una única transición. Flor y Truco pueden anunciarse por separado únicamente cuando cada uno cumpla sus propias condiciones de legalidad.
- La exclusión de «Flor y Truco» no altera «Con Flor Quiero», ni la prioridad de Flor, ni las reglas de conservación y reanudación de desafíos pendientes o suspendidos.

**No confundir:** anunciar una Flor no equivale por sí mismo a plantear Contra Flor.

### 7.8 Retiro al mazo y elegibilidad de Flor

La Flor es un derecho individual. Tener Flor, declararla, participar en un desafío y estar habilitado para comparar tantos son situaciones distintas. El retiro extingue derechos pendientes y elegibilidad comparativa, pero no una Flor legítima ya anunciada ni adjudicaciones cerradas.

- Si durante una Contra Flor pendiente se retira el último jugador habilitado del equipo respondedor que había declarado Flor, su compañero sin Flor no puede responder ni sostener el desafío: corresponde rechazo implícito. Si el compañero tiene Flor, debe declarar primero la propia y puede responder fuera de turno.
- Si se retira el proponente de Contra Flor, su compañero activo con Flor puede sostenerla; si aún no la declaró, debe hacerlo antes. Si no queda ningún jugador habilitado para sostener la propuesta, esta queda **sin efecto**: no es rechazo ni adjudica puntos de rechazo. El proponente retirado pierde su Flor aún no adjudicada; las Flores legítimas ya anunciadas del adversario conservan sus 3 puntos ordinarios y se liquidan una sola vez. El adversario gana la mano por el último nivel de Truco aceptado (1, 2, 3 o 4). Se preservan las adjudicaciones anteriores.
- En Contra Flor aceptada, un retirado deja de aportar tanto. Si un equipo queda sin participantes con Flor elegibles, pierde el desafío aceptado por el valor completo; una Flor ya declarada por el activo no se repite ni exige nuevo Quiero.
- En Contra Flor al Resto pendiente, la falta de jugadores habilitados con Flor del equipo respondedor produce No quiero implícito con los puntos reglamentarios, sin victoria automática del partido. Si se retira el proponente y no queda ningún jugador habilitado para sostener el desafío, la propuesta queda sin efecto conforme al párrafo anterior: el proponente pierde su Flor pendiente, las Flores ordinarias legítimas del adversario se liquidan si corresponden, no hay puntos de rechazo ni victoria automática del partido, y el adversario gana la mano por el último nivel de Truco aceptado. En Contra Flor al Resto aceptada, la falta de elegibles produce pérdida por el valor completo; si esa adjudicación determina victoria inmediata, el partido termina sin esperar bazas.
- Si un equipo abandona completamente, su adversario gana competitivamente la mano. Para las Flores individuales no declaradas, se identifican exclusivamente los jugadores activos del equipo ganador con Flor legítima y derecho individual vigente; se los ordena por recorrido antihorario desde el mano original, aun cuando este esté retirado o pertenezca al equipo perdedor. Se omite a quien no tenga Flor habilitada, ya la hubiera declarado o hubiera perdido voluntariamente su derecho.
- Las oportunidades se procesan secuencialmente, nunca con relojes simultáneos. Al abrirse la oportunidad de cada jugador habilitado, dispone de **10 segundos individuales**: una declaración manual válida la consume; si vence sin declaración, el sistema anuncia automáticamente su Flor con idénticos efectos. Luego continúa con el siguiente jugador habilitado. Un retirado no recibe oportunidad; una oportunidad ya consumida no admite vencimiento ni declaración posterior repetidos.
- No se abren nuevos desafíos de Contra Flor ni de Contra Flor al Resto; los desafíos ya pendientes o aceptados se resuelven según sus reglas. Todas las Flores válidamente declaradas —manual o automáticamente— cuentan, sin alterar adjudicaciones previas ni duplicar una causa. El cierre definitivo ocurre tras procesar las oportunidades conservadas y las adjudicaciones pendientes, sin reabrir bazas ni desafíos ya resueltos.

## 8. Truco, Retruco y Vale Cuatro

### 8.1 Valores

| Estado de la apuesta de la mano | Puntos para el ganador de la mano |
|---|---:|
| Sin Truco aceptado | 1 |
| Truco aceptado | 2 |
| Retruco aceptado | 3 |
| Vale Cuatro aceptado | 4 |

### 8.2 Momento y legitimación

- Se puede **gritar Truco** mientras la mano **todavía no esté decidida**: antes de jugar cartas, entre jugadas y durante la tercera baza si aún queda juego.
- **Solo el jugador al que le toca jugar una carta** puede **iniciar** un Truco; un compañero fuera de turno no puede iniciarlo.
- **Responder** a un desafío pendiente es una excepción al turno de cartas; en 2 contra 2 puede responder cualquiera de los compañeros habilitados y la respuesta compromete al equipo.
- El respondedor habilitado puede ejercer además la excepción de Envido de §6.1 frente a una propuesta pendiente de Truco, Retruco o Vale Cuatro. La suspensión conserva la propuesta y no cambia el turno de carta.
- Flor y Envido tienen prioridad de resolución sobre Truco según sus reglas específicas.

### 8.3 Aceptación y aumentos

- Un Truco puede responderse **Quiero**, **No quiero** o, si corresponde, con **Retruco**.
- Un Retruco puede responderse **Quiero**, **No quiero** o, si corresponde, con **Vale Cuatro**.
- Un Vale Cuatro admite **Quiero** o **No quiero**; no hay un aumento posterior.
- **Aumentar implica aceptar** el nivel anterior. Por ejemplo, `Truco → Retruco → Vale Cuatro → Quiero` es una secuencia válida y la mano vale **4**.
- **Solo el equipo que aceptó el nivel precedente puede proponer el siguiente aumento.** Tras Truco aceptado, **cualquier integrante** de ese equipo puede proponer Retruco aunque no tenga turno; tras Retruco aceptado, **cualquier integrante** de ese equipo puede proponer Vale Cuatro aunque no tenga turno. Siguen exigidas mano activa y prioridades de Flor y Envido; no cambian valores, respuestas, rechazos ni prohibición posterior a Vale Cuatro.

### 8.4 Rechazo

| Apuesta rechazada | Puntos para el equipo que la propuso |
|---|---:|
| Truco | 1 |
| Retruco | 2 |
| Vale Cuatro | 3 |

El rechazo **resuelve la mano** y concede el valor indicado, no el valor que se habría jugado si se aceptaba.

### 8.5 Retiro al mazo y desafío pendiente

El retiro individual de un integrante cuyo compañero sigue activo no equivale a rechazo: el desafío colectivo continúa y el compañero conserva las respuestas legales. Si el último activo del equipo respondedor se retira, equivale a No quiero: se adjudica exactamente una vez el rechazo de §8.4 y la mano termina competitivamente, sin segunda puntuación por mazo. Si abandona completamente el equipo proponente de una propuesta pendiente, esta queda sin efecto, no se considera aceptada ni rechazada y el adversario gana la mano por el último nivel de Truco efectivamente aceptado. Se conservan adjudicaciones anteriores.

## 9. Irse al mazo

### 9.1 En 1 contra 1

Irse al mazo es una acción individual e inmediata, permitida también fuera del turno de carta. Ningún desafío pendiente impide el retiro; las consecuencias de los desafíos se liquidan conforme a §§6–8 y §14.

Si el jugador abandona la mano sin una liquidación de desafío que determine otro valor:

- Sin Truco aceptado: el rival gana **1 punto**.
- Con Truco aceptado: **2 puntos**.
- Con Retruco aceptado: **3 puntos**.
- Con Vale Cuatro aceptado: **4 puntos**.

Si el último jugador activo del equipo que debe responder un desafío de Truco se retira, se aplica el No quiero implícito de §8.5. Si se retira el equipo proponente de un desafío pendiente, la propuesta queda sin efecto y la mano se adjudica por el último nivel de Truco aceptado.

### 9.2 En 2 contra 2

- Un compañero puede irse al mazo **individualmente**, con efecto **inmediato**. El otro permanece activo y sigue jugando solo contra los adversarios activos.
- El retiro puede realizarse fuera del turno de carta. Si se retira quien tenía el turno, este pasa inmediatamente al siguiente jugador activo en sentido antihorario; si se retira otro jugador, el turno se conserva mientras su titular siga activo.
- Si el jugador que se retira **todavía no jugó** en la baza actual, **no juega carta** en esa baza. Los jugadores que siguen activos completan la baza.
- Si el jugador que se retira **ya jugó** su carta de esa baza, **esa carta permanece sobre la mesa y cuenta** para determinar el resultado de la baza. En las bazas posteriores ya no participa.
- El resultado de la baza se determina comparando las cartas válidamente jugadas que correspondan, sin exigir carta a quien ya se retiró. Las reglas de salida de §5.3 siguen aplicándose: si dos compañeros empatan, primero se identifica el autor histórico por cercanía antihoraria al mano original, incluso si luego se retiró; solo entonces se busca desde ese autor el jugador activo que debe salir, en sentido antihorario y de manera circular.
- Los retiros se procesan secuencial y atómicamente. Cada retiro se valida sobre el estado resultante del anterior; el primero que deja a un equipo sin jugadores activos determina su derrota competitiva. Un retiro posterior no modifica esa adjudicación ni crea empate por abandono simultáneo.
- Si ambos compañeros se retiran, el equipo rival gana competitivamente la mano por el valor del Truco ya aceptado, o 1 si no hubo Truco aceptado, salvo las liquidaciones de desafíos previstas en §§6–8 y §14.
- Irse al mazo no borra ni recalcula adjudicaciones ya cerradas de Flor o Envido. Las cartas no jugadas del retirado siguen privadas e inutilizables.

### 9.3 Cierre competitivo y definitivo

Cuando un abandono completo determina vencedor competitivo, no se abren nuevas cartas ni bazas, ni nuevos desafíos de Truco, Envido, Contra Flor o Contra Flor al Resto. Se permiten únicamente las declaraciones individuales de Flor que §7.8 conserva expresamente para jugadores activos del equipo ganador, incluso fuera de turno; no crean un desafío nuevo. Esas oportunidades se procesan una a una, en orden antihorario desde el mano original, con el reloj individual y la declaración automática de §13.2. Los desafíos ya pendientes o aceptados se resuelven conforme a las reglas de su dominio y en el orden **Flor → Envido → Truco**. El cierre definitivo ocurre cuando se consumieron todas las oportunidades de Flor conservadas y no quedan liquidaciones pendientes.

Las adjudicaciones previas se preservan y cada causa se liquida una sola vez: no se confunden rechazo de Truco con puntos de mano, rechazo de Envido con puntos de mano, ni pérdida de Flor aceptada con abandono de mano. Se conserva la terminación inmediata excepcional del partido por Contra Flor al Resto aceptada, cuando corresponda. No se crean reglas adicionales de renuncia, cancelación o extensión del plazo.


## 10. Puntuación del partido

### 10.1 Objetivo configurable

Al crear el partido se elige **30 o 40 puntos**; **40 es el valor predeterminado**.

| Objetivo | Malas | Buenas | Meta |
|---:|---|---|---:|
| 30 | 0–14 | 15–29 | 30 |
| 40 (predeterminado) | 0–19 | 20–39 | 40 |

- Los puntos se registran por **equipo**, no individualmente.
- El marcador puede **superar** 30 o 40. **No se trunca** al objetivo.
- Los puntos de Flor/Envido y los del Truco son **independientes**: una misma mano puede otorgar puntos de Flor o Envido a un equipo y puntos de Truco al otro.
- Si ambos equipos tienen Flores sin desafío, **ambos pueden sumar puntos de Flor** durante la misma mano.

### 10.2 Ejemplo de independencia

Partida a 40:

| Evento | Equipo A | Equipo B |
|---|---:|---:|
| Marcador inicial | 38 | 37 |
| A cobra una Flor | +3 | 0 |
| B gana Vale Cuatro | 0 | +4 |
| Marcador al terminar la mano | **41** | **41** |

El partido **no termina** automáticamente al anotarse el 41 de A: B todavía podía empatar mediante los cuatro puntos del Vale Cuatro. El resultado final es empate y obliga a una mano adicional (§11.3).

## 11. Finalización, victoria anticipada y desempate

### 11.1 Regla general

**No gana necesariamente quien primero alcance la meta durante una mano.** Si aún quedan puntos por disputar que permitirían al rival **empatar o superar** el marcador, la mano debe continuar.

Cuando termina la mano, si al menos un equipo alcanzó el objetivo:

1. Gana el equipo con **mayor puntuación**.
2. Si ambos tienen **exactamente la misma puntuación** y **ambos alcanzaron o superaron** el objetivo, se juega otra mano de desempate.
3. Si ninguno alcanzó el objetivo, comienza la mano siguiente normalmente.

Ejemplo: A termina con **41**, B con **42**; gana **B**, aunque A haya llegado antes a 40 durante la mano.

### 11.2 Finalización anticipada matemáticamente asegurada

El partido **puede terminar durante una mano** si se cumplen simultáneamente estas condiciones:

1. Un equipo ya tiene **al menos el objetivo** (30 o 40).
2. El equipo rival **no puede alcanzar ni superar** el marcador de ese equipo con **todos los puntos que todavía pudiera obtener legalmente** en esa misma mano.

Para una comprobación conservadora, antes de que la apuesta de Truco quede resuelta, se puede considerar **hasta 4 puntos** posibles de Truco para el rival. Si el Truco ya está decidido o ya no quedan puntos por jugar, se utiliza el máximo real restante (que puede ser 0). **No se deben ignorar puntos de Flor o Envido aún pendientes de adjudicación.**

Ejemplos con meta 40, **suponiendo que Flor/Envido ya están totalmente resueltos y que el único puntaje adicional posible para B es un máximo de cuatro puntos de Truco**:

| Marcador A–B | Máximo posible de B | ¿Termina ya? |
|---|---:|---|
| 44–37 | 41 | Sí, gana A |
| 41–38 | 42 | No |
| 42–38 | 42 | No: B puede empatar |
| 43–38 | 42 | Sí, gana A |
| 40–35 | 39 | Sí, gana A |
| 40–37 | 41 | No |

**La misma regla rige para Falta Envido:** si su ganador alcanza la meta, el partido termina de inmediato **solo si** el contrario no puede empatar ni superarlo con los puntos todavía posibles de la mano en curso.

**Precaución para implementación:** «hasta cuatro puntos» es un **límite superior** del Truco, no una orden de adjudicar cuatro puntos. Para declarar victoria anticipada debe considerarse el conjunto completo de puntos todavía alcanzables por el rival, incluido cualquier canto no resuelto. Si hay duda, se continúa la mano en lugar de finalizarla prematuramente.

### 11.3 Empate al alcanzar o superar la meta

Si al terminar una mano ambos equipos están en **30 o más** (partida a 30) o **40 o más** (partida a 40), **y tienen el mismo marcador**, se disputa **otra mano completa**. Los puntos **se conservan**; no se reinicia el marcador. Se repite cuantas veces sea necesario hasta que exista un equipo ganador. **No se favorece automáticamente al equipo del mano original para desempatar el partido.**

En **cada mano de desempate** se aplican las reglas normales, con **dos excepciones expresas**: la **Falta Envido aceptada vale 2 puntos fijos** (§6.6) y la **Contra Flor al Resto aceptada vale 3 puntos fijos para el ganador de la comparación de Flores**, sin victoria automática (§7.6). El Envido simple conserva sus **2 puntos** y Truco, Retruco y Vale Cuatro mantienen sus valores habituales. Las demás reglas de Flor y Contra Flor se conservan. Si persiste el empate, la siguiente mano también es de desempate.

Esta regla de desempate por mano adicional fue elegida expresamente para el proyecto, en lugar de otorgar el partido al mano original.

### 11.4 Excepción: Contra Flor al Resto aceptada

**Fuera de las manos de desempate**, la **Contra Flor al Resto aceptada** tiene una regla de victoria directa: el equipo que gana la comparación de Flores **gana inmediatamente el partido**, independientemente de puntos, meta o posibilidad de Truco posterior. El rechazo **no** produce esta victoria automática. **En manos de desempate**, rige el valor fijo de **3 puntos**, sin victoria directa (§7.6 y §11.3).

## 12. Señas entre compañeros

### 12.1 Privacidad y modalidades

- Solo existen en **2 contra 2**; no se utilizan en 1 contra 1.
- Las señas son **privadas entre compañeros**: los adversarios **no deben recibirlas ni verlas**.
- En online, el servidor transmite cada seña **solo al compañero destinatario**. En offline, el humano y su compañero virtual pueden enviarse señas y la IA debe interpretar las recibidas.
- Una seña comunica **solo el significado aprobado**, sin revelar automáticamente toda la mano; no modifica cartas, apuestas, turnos ni puntos.
- Cuando el **12 alcahuete** reemplaza una pieza, se utiliza **la seña de esa pieza**.

### 12.2 Catálogo aprobado (11 señas)

| Carta o información | Seña privada |
|---|---|
| 2 de la muestra (o 12 que la sustituye) | Levantar ambas cejas |
| 4 de la muestra (o 12 que la sustituye) | Tirar un beso |
| 5 de la muestra (o 12 que la sustituye) | Arrugar la nariz |
| 11 de la muestra (o 12 que la sustituye) | Guiñar el ojo derecho |
| 10 de la muestra (o 12 que la sustituye) | Guiñar el ojo izquierdo |
| 1 de espadas o 1 de bastos | Torcer la boca hacia la derecha |
| 7 de espadas o 7 de oros | Torcer la boca hacia la izquierda |
| Cualquier 3 | Morder el labio inferior |
| Cualquier 2 **que no sea pieza** | Abrir ligeramente la boca |
| 1 de copas o 1 de oros | Sacar la punta de la lengua |
| Sin cartas importantes de las categorías anteriores | Cerrar ambos ojos |

**Excluidas expresamente por ahora:** «Tengo Flor — inflar cachetes» y «Mucho Envido — inclinar cabeza». No deben aparecer en el catálogo del juego.

### 12.3 Disponibilidad y límites

1. Se pueden enviar señas **en cualquier momento mientras la mano esté en juego**, incluso fuera del turno de carta.
2. Se pueden enviar **varias señas distintas en una misma mano**; no hay límite numérico por mano.
3. Una seña referida a una carta solo está disponible si el emisor **todavía tiene esa carta en su mano**; no puede señalar cartas que ya jugó.
4. «Sin cartas importantes» solo está disponible si **ninguna de las cartas que conserva** pertenece a alguna de las diez categorías de cartas señalables.
5. Debe transcurrir **al menos un segundo entre envíos de señas** del mismo jugador, para evitar repeticiones excesivas.

## 13. Tiempo límite y acciones automáticas

### 13.1 Reloj

- Cada acción que exige una decisión tiene un **máximo de 10 segundos**.
- El contador se **reinicia** para cada nuevo turno de jugar carta o para cada nueva respuesta pendiente.
- El límite se aplica a las acciones de juego y respuestas a desafíos; la ausencia de charla libre entre compañeros no cambia las reglas de apuestas.

### 13.2 Agotamiento del tiempo

| Situación al agotarse los 10 segundos | Acción automática obligatoria |
|---|---|
| Debe jugar una carta | **Jugar la carta de menor jerarquía** entre las que le quedan |
| Debe responder Truco | **No quiero** |
| Debe responder Retruco | **No quiero** |
| Debe responder Vale Cuatro | **No quiero** |
| Debe responder Envido | **No quiero** |
| Debe responder Real Envido | **No quiero** |
| Debe responder Falta Envido | **No quiero** |
| Debe responder Contra Flor | **No quiero** |
| Debe responder Contra Flor al Resto | **No quiero** |
| Tiene Flor aún no anunciada cuando vence el reloj de su turno antes de jugar la primera carta | **Cantar Flor automáticamente antes de jugar carta** |
| Oportunidad excepcional de Flor conservada durante liquidación por victoria competitiva | **Cantar automáticamente la Flor del jugador habilitado y continuar con la siguiente oportunidad** |

La «carta de menor jerarquía» se calcula **según la fuerza real de §4, incluyendo muestra, piezas y alcahuete**. No es la carta con el número impreso más bajo ni una elección estratégica de la IA.

Ejemplo: con pieza 2 de muestra, 3 ordinario y 6 ordinario, se juega automáticamente el **6 ordinario** porque es la más débil.

Si dos cartas disponibles comparten exactamente la misma jerarquía, el motor escoge la primera según este **orden fijo de palos: oros → copas → espadas → bastos**. Es un desempate **solo para la selección automática**, sin efecto sobre la fuerza de las cartas ni sobre los resultados de bazas.

### 13.3 Protección de Flor

La interfaz debe advertir **en privado** a quien tenga Flor antes de que juegue su primera carta. Si el jugador **elige jugarla sin cantar Flor**, **pierde los puntos y el derecho a anunciar esa Flor**, sin que se adjudiquen automáticamente tres puntos al rival. Si en cambio **se agota el reloj de su turno** antes de que haya jugado esa primera carta, el sistema **canta la Flor automáticamente**. Una omisión voluntaria y el vencimiento del reloj son eventos distintos.

La protección ordinaria anterior no sustituye el procedimiento excepcional de §7.8: después de una victoria competitiva por abandono completo, cada jugador activo ganador con Flor legítima no declarada y derecho vigente recibe su propia oportunidad secuencial de 10 segundos, aunque esté fuera de turno. El vencimiento anuncia automáticamente esa misma Flor; no recupera derechos ya perdidos, no repite Flores anunciadas y no habilita a retirados.

## 14. Orden de prioridad y resolución de desafíos

### 14.1 Prioridad de conceptos

1. **Flor**, cuando exista, tiene prioridad sobre Envido y sobre el desarrollo de Truco.
2. **Envido** válido tiene prioridad sobre un **Truco pendiente**. Si se inició por la excepción de §6.1, conserva íntegramente la propuesta suspendida y el turno de carta.
3. **Truco** se retoma después de resolver los conceptos anteriores, si la mano y el partido siguen activos.
4. Una respuesta o aumento legal debe resolverse **antes** de continuar jugando cartas.
5. Un retiro al mazo no queda bloqueado por desafíos pendientes. Si el retiro exige liquidar varios desafíos o desafíos suspendidos, se respeta el orden **Flor → Envido → Truco**, aplicando las consecuencias específicas de §§6–8 y sin adjudicar dos veces la misma causa.
6. Tras una victoria competitiva por abandono completo no se abren cartas, bazas ni desafíos nuevos; solo subsisten las declaraciones individuales de Flor conservadas por §7.8 y la liquidación de desafíos ya pendientes o aceptados, en el orden de prioridad de este artículo. La Contra Flor al Resto aceptada conserva su terminación inmediata excepcional cuando corresponda.
7. Las oportunidades excepcionales de Flor se coordinan antes de continuar la liquidación: se ordenan por asientos antihorarios desde el mano original, se resuelven secuencialmente con sus vencimientos de §13.2 y cada declaración conserva la prioridad de Flor sin duplicar adjudicaciones.

### 14.2 Ejemplos normativos

- Hay un Truco pendiente y se toca válidamente Envido: se suspende la respuesta de Truco, se resuelve Envido y se regresa a la misma propuesta pendiente, sin cambiar su nivel, proponente, equipo respondedor ni el turno de carta. Si quien inicia Envido es el respondedor habilitado, puede hacerlo fuera de turno exclusivamente conforme a §6.1.
- Se toca Envido y un jugador tiene Flor: se anuncia Flor y **se cancela Envido**; se resuelve Flor.
- Un jugador con Flor responde **«Con Flor Quiero»** a Truco: queda aceptado el Truco, pero primero se resuelve Flor.
- «Flor y Truco» no es un canto compuesto permitido. Un anuncio de Flor y una propuesta de Truco solo pueden realizarse como acciones separadas y legales, respetando su prioridad.
- Se rechaza un Truco pendiente: se conceden los puntos por rechazo de §8.4 y termina la mano, sin borrar puntos ya adjudicados de Flor o Envido.
- Un retiro puede ocurrir durante un desafío pendiente. Su liquidación respeta Flor → Envido → Truco; no habilita nuevas cartas ni nuevos desafíos competitivos después de una victoria competitiva.

**Regla de seguridad:** el motor debe mantener explícitamente el estado de apuestas suspendidas y reanudarlas en el orden correcto; no debe interpretar que una nueva apuesta borra automáticamente una apuesta de Truco pendiente, salvo la cancelación expresa del **Envido por Flor**.

## 15. Precisiones de implementación y decisiones de alcance

Las diez cuestiones que figuraban como pendientes en la versión 1.0 fueron tratadas expresamente y sus decisiones están **integradas en las secciones normativas correspondientes**: salida y pardas (§5.3), oportunidades de apuestas (§6.1, §7.3, §8.2), Falta Envido en desempate (§6.6), varias Flores (§7.3–7.6), mazo individual (§9.2), selección automática (§13.2), señas (§12), reparto (§2.3) y desconexiones (§15.1). Esta sección **no sustituye** las reglas ubicadas en sus capítulos.

### 15.1 Desconexiones online

1. Cuando un jugador se desconecta, el partido se **pausa para todos** durante un máximo de **30 segundos** para permitir su reconexión.
2. Si regresa dentro de ese plazo, se **reanuda** la partida y dispone de **10 segundos** para su acción, conforme al reloj ordinario (§13).
3. Si no regresa al vencer los 30 segundos, se considera que **se fue al mazo** (§9).
4. En 2 contra 2, el compañero del desconectado sigue jugando solo. Si ambos integrantes abandonan, el equipo contrario gana la mano con los puntos que correspondan.
5. Los puntos de Flor y Envido **ya adjudicados se conservan**.

La gestión técnica de reconexión y persistencia de sesión pertenece a la especificación funcional; las consecuencias reglamentarias anteriores son obligatorias.

### 15.2 Límites de lo definido

No se deben inventar reglas no acordadas. Los retiros al mazo se procesan secuencial y atómicamente conforme a §9.2. Fuera de ello, este documento no fija una política específica para eventos simultáneos a nivel de red —por ejemplo, dos respuestas de compañeros que llegan en el mismo instante— ni un criterio de desempate entre decisiones técnicas de entrega de mensajes. Estas situaciones se deben formalizar en la especificación funcional sin alterar las reglas de cartas aquí establecidas.

## 16. Casos de aceptación obligatorios para el futuro motor

Los siguientes casos deben convertirse en pruebas automatizadas; las cantidades de cartas o manos de los ejemplos deben ajustarse a repartos físicamente posibles sin duplicar cartas.

### 16.1 Muestra y jerarquía

- Muestra 2 de oros: 12 de oros vale 30 y ocupa el puesto de la pieza 2; 2 de oros no puede estar en mano.
- Muestra 11 de espadas: 12 de espadas sustituye al 11, vale 27 y supera a la pieza 10 de espadas.
- Pieza 11 supera a pieza 10 aunque ambas valgan 27 para Envido/Flor.
- Un 1 de espadas supera a un 1 de bastos, pero ambos pierden frente a cualquier pieza.
- Dos 3 ordinarios de distintos palos empatan en fuerza.

### 16.2 Bazas

- A gana primera y segunda: no se juega tercera.
- A gana primera, segunda parda: gana A sin tercera.
- Primera parda, segunda B: gana B sin tercera.
- A gana primera, B segunda, tercera parda: gana equipo del mano original.
- Baza ganada por una carta de C: C sale en la siguiente, aunque A sea el mano original; si dos compañeros empatan en la carta ganadora, se determina primero el autor histórico por cercanía al mano original en sentido antihorario, aun si luego se retiró.
- Empate entre compañeros con uno retirado: no se elige al mejor autor todavía activo; identificado el autor histórico, si está retirado se busca circularmente el primer activo posterior a él en sentido antihorario.
- Carta ganadora de jugador activo: sale ese autor, conforme a la regla habitual.
- Carta ganadora jugada válidamente antes del retiro de su autor: conserva su jerarquía y determina normalmente el equipo ganador; si el autor está retirado al abrir la baza siguiente, sale el primer jugador activo posterior a él en sentido antihorario, mediante recorrido circular.
- Si hay varios jugadores retirados consecutivos después del autor, se los omite en esa búsqueda; el jugador activo seleccionado puede pertenecer al equipo rival.
- Baza parda: sale el mano original.
- Baza parda con mano original retirado: sale el primer jugador activo posterior al mano original en sentido antihorario.
- Primera y segunda pardas, tercera parda: gana equipo del mano original.
- Si la mano ya quedó decidida, no se abre una baza adicional, incluso si se configuraría una salida conforme a las reglas anteriores.
- La repetición de un retiro ya procesado se rechaza y no duplica adjudicaciones.

### 16.3 Envido

- Sin piezas, 6 y 7 del mismo palo: 33.
- Sin piezas ni palo repetido, máximo ordinario 7: 7.
- Exactamente una pieza de 30 más 7 ordinario sin Flor: 37.
- Envido rechazado al inicio: 1.
- Envido → Envido → No quiero: 2.
- Envido → Envido → Envido → No quiero: 4.
- Envido → Real Envido → No quiero: 2.
- Real Envido → Falta Envido → No quiero: 3.
- Falta Envido con ambos equipos en malas a 40, ganador inicialmente en 12: 8 puntos aunque el marcador transitorio de la mano haya cambiado.
- Empate de tantos: gana el jugador más próximo al mano original en sentido antihorario.
- Solo el jugador de turno puede **iniciar** Envido antes de jugar su carta de la primera baza; respuestas y aumentos son fuera de turno.
- En mano de desempate iniciada con empate por encima de la meta, Falta Envido aceptada = **2 puntos**, sin aplicar `T − s`.

### 16.4 Flor

- Flor 1 contra Flor 1 sin desafío: 3 puntos para cada equipo.
- Flor 2 contra Flor 1 sin desafío: 6 para un equipo y 3 para el otro.
- Contra Flor aceptada: solo cobra el equipo de mejor Flor, 3 por cada Flor propia.
- Contra Flor rechazada por el equipo respondedor: cobra 3 por cada Flor propia el desafiante.
- Contra Flor al Resto aceptada: victoria directa del ganador de la comparación de Flores.
- Contra Flor al Resto rechazada por el equipo respondedor: no hay victoria directa; cobra 3 por Flor propia el desafiante.
- Piezas 2, 4 y 5 de muestra en la misma mano: Flor 47.
- Una Flor anunciada cancela Envido pendiente.
- Primera Flor: solo en turno propio y antes de jugar la primera carta; después otros pueden cantar fuera de turno.
- Si un jugador juega voluntariamente su primera carta sin cantar Flor pese al aviso privado, pierde los puntos de esa Flor.
- Si se plantea Contra Flor y un compañero todavía tiene Flor habilitada, puede anunciarla antes de resolver el desafío.
- Contra Flor al Resto aceptada **en desempate**: gana la comparación de Flores y cobra **3 puntos**, sin ganar el partido directamente.
- Truco pendiente + «Con Flor Quiero» válido: acepta exactamente Truco (2), sin adjudicar esos puntos de inmediato.
- Retruco pendiente + «Con Flor Quiero» válido: acepta exactamente Retruco (3), sin adjudicación inmediata.
- Vale Cuatro pendiente + «Con Flor Quiero» válido: acepta exactamente Vale Cuatro (4), sin adjudicación inmediata.
- Primer anuncio de Flor fuera de turno mediante «Con Flor Quiero», con Flor legítima y derecho vigente: permitido; el anuncio ordinario fuera de turno: rechazado.
- «Con Flor Quiero» sin Flor, tras perder derecho, desde equipo no respondedor o sin propuesta pendiente: rechazado.
- «Con Flor Quiero» válido con Envido pendiente: Flor se resuelve primero, Envido se cancela cuando corresponde y se conserva aceptación exacta de Truco.
- La aceptación compuesta no decide sola mano ni anticipa puntos; tras resolver Flor, la mano continúa por turnos, bazas y nivel aceptado si no terminó legalmente.
- Victoria competitiva por abandono con un ganador activo y Flor conservada: recibe una oportunidad individual de 10 segundos; si no declara, se anuncia automáticamente esa Flor.
- Dos ganadores activos con Flores conservadas: las oportunidades se procesan una por una en orden antihorario desde el mano original, sin relojes simultáneos ni doble adjudicación.
- Mano original retirado o del equipo perdedor: sigue siendo la referencia histórica para ordenar oportunidades de Flor.
- Flor ya anunciada, derecho perdido voluntariamente o jugador retirado: no generan oportunidad ni anuncio automático durante la liquidación.
- Vencimiento repetido o acción tardía sobre oportunidad consumida, e intento de carta o desafío nuevo durante liquidación: se rechazan sin mutación ni puntuación adicional.
- Agotadas las oportunidades conservadas y las liquidaciones pendientes: la mano cierra definitivamente; Contra Flor al Resto aceptada que produce victoria inmediata no prolonga artificialmente el partido.

### 16.5 Truco, abandono y reloj

- Sin Truco aceptado, mano ganada: 1.
- Truco/Retruco/Vale Cuatro aceptados: 2/3/4 respectivamente.
- Truco/Retruco/Vale Cuatro rechazados: 1/2/3 para quien propuso el nivel rechazado.
- Truco → Retruco → Vale Cuatro → Quiero: mano por 4.
- Un compañero va al mazo: el otro sigue jugando; si ambos abandonan, gana el rival.
- El mazo es individual, puede ejercerse fuera de turno y no queda bloqueado por desafío pendiente.
- Retiro antes de jugar en una baza: no aporta carta; retiro después de jugar: su carta permanece y cuenta. Una baza se completa con los activos restantes.
- Retiro del jugador de turno: el turno pasa al siguiente activo antihorario; retiro ajeno: el turno se conserva. En parda con mano retirado, sale el primer activo posterior al mano.
- Último respondedor de Truco/Retruco/Vale Cuatro retirado: No quiero implícito, una sola adjudicación de rechazo y sin segunda por mazo. Equipo proponente agotado: propuesta sin efecto.
- Último respondedor de Envido retirado: No quiero implícito y puntos de mano independientes; Envido aceptado con equipo agotado: valor completo aceptado y puntos de mano.
- Retiro durante Flor/Contra Flor: se pierde elegibilidad individual; Contra Flor o Contra Flor al Resto se liquidan conforme a §7.8. Si se retira el último proponente habilitado de una propuesta pendiente, esta queda sin efecto sin puntos de rechazo y el adversario cobra el último nivel de Truco aceptado; una Contra Flor al Resto pendiente no determina victoria automática del partido. Una Contra Flor al Resto aceptada que determine victoria finaliza el partido.
- Tras abandono completo rival, las Flores no declaradas del equipo ganador activo pueden declararse fuera de turno antes del cierre definitivo.
- Se agota el reloj de carta: se juega **la carta más débil**, no una carta al azar.
- Se agota el reloj de respuesta: **No quiero**.
- Se agota el reloj del turno con Flor sin anunciar y sin haber jugado primera carta: **canto automático**.
- Si dos cartas son igual de débiles, selección automática por **oros → copas → espadas → bastos**.
- Si un jugador se va al mazo antes de jugar en una baza, no aporta carta; si ya jugó, su carta permanece y cuenta.
- Desconexión online: pausa de 30 segundos, reconexión reanuda con 10 segundos; sin reconexión, se va al mazo.

### 16.6 Final de partido

- Objetivos disponibles: 30 y 40; predeterminado 40.
- A 38, B 37; A cobra 3 Flor y B gana Vale Cuatro: resultado 41–41; se juega otra mano con marcador conservado.
- A 38, B 37; A cobra 3 Flor y B gana Truco de 2: resultado 41–39; gana A al cerrar la mano.
- Resultado final A 41, B 42: gana B aunque A haya llegado primero al objetivo.
- Tras resolver los demás puntos pendientes, A 42 y B 38, con máximo de 4 puntos de Truco todavía para B: **no** se declara victoria anticipada; B puede empatar.
- Tras resolver los demás puntos pendientes, A 43 y B 38, con máximo de 4 puntos de Truco todavía para B: A **sí** puede ganar anticipadamente.
- Si se acepta Contra Flor al Resto **fuera de desempate**, el ganador de Flor gana inmediatamente el partido incluso si el Truco pudiera alterar la diferencia.
- Si se acepta Contra Flor al Resto **en desempate**, solo concede **3 puntos** al ganador de Flor y se evalúa el marcador final.

---

## 17. Jerarquía de fuentes para desarrollar el proyecto

1. **Este reglamento** para las reglas expresamente definidas.
2. **Decisiones posteriores expresas del usuario**, que deberán incorporarse mediante revisión versionada.
3. **Especificación funcional** (documento separado) para presentación, modos online/offline, IA, comunicaciones y temporizadores, siempre sin contradecir este reglamento.
4. **Pruebas de aceptación** (documento separado), derivadas del reglamento, sin introducir reglas nuevas.

Ante una situación no cubierta, **marcarla como pendiente y pedir definición**. No completar huecos apelando automáticamente a otras variantes del Truco.

## 18. Control de cambios

**Versión 1.7 — 08/11/2026.** Incorpora la excepción de §6.1: el respondedor activo de una propuesta pendiente de Truco, Retruco o Vale Cuatro puede iniciar el primer Envido fuera del turno de carta mientras la oportunidad de Envido siga abierta. Conserva el orden Flor → Envido → Truco, la propuesta suspendida y el turno original; no habilita una segunda cadena de Envido ni altera puntuación, respuestas o aumentos.

**Versión 1.6 — 30/10/2026.** Integra las decisiones aprobadas sobre irse al mazo en 1v1 y 2v2: retiro individual fuera de turno, participantes activos, cartas históricas, turnos filtrados, retiros secuenciales, liquidación Flor → Envido → Truco, desafíos implícitos, elegibilidad individual de Flor/Envido, conservación de adjudicaciones y distinción entre victoria competitiva y cierre definitivo. Sustituye el bloqueo anterior de mazo ante desafíos pendientes.

**Corrección puntual v1.6 — 30/10/2026.** Precisa la salida de la baza posterior cuando el autor histórico de la carta ganadora se retiró: se inicia con el primer jugador activo posterior a ese autor, en sentido antihorario y mediante búsqueda circular, sin afectar la regla independiente de parda ni abrir una baza después de decidida la mano.

**AUD-05 y AUD-06 — 30/10/2026.** Precisan, respectivamente, que el desempate entre compañeros determina primero el autor histórico sobre todas las cartas válidas antes de consultar retiros, y que la victoria competitiva por abandono bloquea cartas, bazas y desafíos nuevos mientras conserva únicamente las declaraciones individuales de Flor habilitadas y liquida los desafíos ya existentes en prioridad Flor → Envido → Truco. No se introduce un mecanismo automático de cierre de la ventana de Flor.

**AUD-07 — 30/10/2026.** Establece el procedimiento de agotamiento de las declaraciones de Flor conservadas tras victoria competitiva: jugadores activos ganadores con derecho vigente, ordenados antihorariamente desde el mano original, reciben oportunidades individuales y secuenciales de 10 segundos; su vencimiento anuncia automáticamente la Flor con idénticos efectos. Tras ellas y la liquidación pendiente, la mano cierra definitivamente.

**Versión 1.5 — 30/10/2026.** Por decisión expresa aprobada por el propietario del proyecto, «Flor y Truco» queda excluida definitivamente: no es una acción válida ni puede implementarse como canto compuesto. Se conservan sin cambios «Con Flor Quiero», las prioridades Flor > Envido > Truco y las reglas de desafíos pendientes o suspendidos.
