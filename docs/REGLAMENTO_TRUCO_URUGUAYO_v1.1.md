# Reglamento del Truco Uruguayo — Versión 1.1

**Proyecto:** Truco  
**Tipo:** especificación normativa de las reglas del juego  
**Estado:** revisión consolidada de las decisiones expresamente acordadas hasta el 17 de octubre de 2026. Las precisiones no acordadas se distinguen expresamente de las reglas confirmadas.  
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

1. **Baza ganada:** sale el jugador que jugó la **carta de mayor jerarquía que ganó esa baza**, aunque sea distinto del mano original.
2. **Dos compañeros empatan en la jerarquía máxima ganadora:** sale el compañero que esté **más cerca del mano original siguiendo el orden antihorario**.
3. **Baza parda:** sale el **mano original**, aunque otro jugador haya iniciado la baza parda.
4. Si la mano ya quedó decidida, no se abre otra baza.

Estas reglas de salida individual son independientes del criterio de qué **equipo** ganó la baza y de los desempates de la mano establecidos en §5.2.

## 6. Envido

### 6.1 Momento y prioridad

- El **primer Envido de la mano** solo puede tocarlo el jugador **a quien le toca jugar una carta**, **antes de jugar su carta de ese turno**, y únicamente **antes de que termine la primera baza**. Puede ocurrir después de que otros jugadores ya hayan jugado sus cartas de esa baza.
- No se puede **iniciar una segunda cadena independiente** de Envido en esa mano. Los Envidos sucesivos, Real Envido y Falta Envido son **aumentos de la misma cadena pendiente**, no nuevos inicios.
- Las **respuestas y aumentos** a un Envido pendiente pueden efectuarse fuera del turno de jugar carta por un integrante habilitado del equipo que debe responder. Una respuesta compromete al equipo completo.
- Un Envido pendiente se resuelve antes de seguir jugando cartas.
- Si aparece una **Flor**, tiene prioridad y **desplaza/cancela** el Envido: no se cobran simultáneamente puntos de Envido y Flor por esa misma situación.
- Si hay un Truco pendiente y se toca válidamente Envido, **se resuelve primero el Envido** y luego se retoma el Truco pendiente. Puede mostrarse el aviso «El Envido está primero».

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

### 7.4 Flores sin desafío

**Regla central de esta variante:** si **no se plantea Contra Flor ni Contra Flor al Resto**, **cada equipo recibe 3 puntos por cada Flor propia**, **sin comparar** valores con el equipo contrario.

| Flores del equipo A | Flores del equipo B | Puntos para A | Puntos para B |
|---:|---:|---:|---:|
| 1 | 0 | 3 | 0 |
| 1 | 1 | 3 | 3 |
| 2 | 1 | 6 | 3 |
| 2 | 2 | 6 | 6 |

Por tanto, tener Flor más alta **no** priva al adversario de sus tres puntos si nadie desafía.

### 7.5 Contra Flor

- Solo es posible cuando **ambos equipos tienen al menos una Flor**.
- Puede plantearse **una sola vez** en la secuencia: **no** existe `Contra Flor → Contra Flor`.
- **Aceptada:** se compara la **Flor individual más alta** de cada equipo; gana el equipo con la mayor. El equipo ganador recibe **3 puntos por cada Flor propia**; el equipo perdedor recibe **0**. No se añade una bonificación extra por el desafío.
- **Rechazada:** el equipo que desafió recibe **3 puntos por cada Flor propia** y el equipo que rechazó recibe **0**, sin comparar valores.
- **Empate de Flor:** prevalece el jugador empatado más próximo al **mano original en sentido antihorario**; gana su equipo.

### 7.6 Contra Flor al Resto

- Puede plantearse **directamente después de Flor** o **como aumento después de Contra Flor**.
- **Aceptada en una mano ordinaria:** se comparan las Flores individuales más altas, con el desempate del §7.5. **El equipo ganador gana inmediatamente el partido**, sin importar el marcador previo. Esta es una **regla especial acordada** para el proyecto.
- **Aceptada en una mano de desempate** (§11.3): **no** da victoria directa. La comparación se realiza igual y el equipo ganador **cobra 3 puntos fijos**. El partido se decide con el marcador y las reglas de §11.
- **Rechazada:** el equipo que lanzó el desafío recibe **3 puntos por cada Flor propia** y el equipo que lo rechazó recibe **0**. No se produce victoria automática, salvo que la puntuación determine una victoria conforme al §11.

### 7.7 Respuestas compuestas vinculadas a Truco

- **«Con Flor Quiero»**: anuncia Flor y **acepta** el Truco que estaba pendiente.
- **«Flor y Truco»**: anuncia Flor y **grita Truco** cuando no había un Truco pendiente.
- La parte de Flor se resuelve primero; la aceptación o propuesta de Truco queda registrada y se retoma cuando corresponde.

**No confundir:** anunciar una Flor no equivale por sí mismo a plantear Contra Flor.

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
- Flor y Envido tienen prioridad de resolución sobre Truco según sus reglas específicas.

### 8.3 Aceptación y aumentos

- Un Truco puede responderse **Quiero**, **No quiero** o, si corresponde, con **Retruco**.
- Un Retruco puede responderse **Quiero**, **No quiero** o, si corresponde, con **Vale Cuatro**.
- Un Vale Cuatro admite **Quiero** o **No quiero**; no hay un aumento posterior.
- **Aumentar implica aceptar** el nivel anterior. Por ejemplo, `Truco → Retruco → Vale Cuatro → Quiero` es una secuencia válida y la mano vale **4**.
- **Solo el equipo que aceptó el nivel precedente puede proponer el siguiente aumento.** Después de que un equipo acepta Retruco, ese equipo puede proponer Vale Cuatro si aún es legal hacerlo.

### 8.4 Rechazo

| Apuesta rechazada | Puntos para el equipo que la propuso |
|---|---:|
| Truco | 1 |
| Retruco | 2 |
| Vale Cuatro | 3 |

El rechazo **resuelve la mano** y concede el valor indicado, no el valor que se habría jugado si se aceptaba.

## 9. Irse al mazo

### 9.1 En 1 contra 1

Si el jugador abandona la mano cuando **no hay desafío pendiente**:

- Sin Truco aceptado: el rival gana **1 punto**.
- Con Truco aceptado: **2 puntos**.
- Con Retruco aceptado: **3 puntos**.
- Con Vale Cuatro aceptado: **4 puntos**.

En la práctica tradicional, irse al mazo con una propuesta de Truco pendiente equivale a rechazarla, con el valor de §8.4. **En este juego la interfaz deshabilita «Irse al mazo» mientras exista cualquier desafío pendiente**: hay que contestar explícitamente.

### 9.2 En 2 contra 2

- Un compañero puede irse al mazo **individualmente**, con efecto **inmediato**. El otro permanece activo y sigue jugando solo contra los adversarios activos.
- Si el jugador que se retira **todavía no jugó** en la baza actual, **no juega carta** en esa baza. Los jugadores que siguen activos completan la baza.
- Si el jugador que se retira **ya jugó** su carta de esa baza, **esa carta permanece sobre la mesa y cuenta** para determinar el resultado de la baza. En las bazas posteriores ya no participa.
- El resultado de la baza se determina comparando las cartas válidamente jugadas que correspondan, sin exigir carta a quien ya se retiró. Las reglas de salida de §5.3 siguen aplicándose.
- Si **ambos compañeros** se van al mazo, el equipo rival gana la mano y cobra el valor del Truco **ya aceptado** (o 1 si no hubo Truco aceptado).
- Irse al mazo no borra los puntos de Flor o Envido que correspondan por resoluciones anteriores.
- No se puede seleccionar «Irse al mazo» mientras haya Envido, Flor, Truco o cualquiera de sus desafíos pendientes de respuesta.


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

La «carta de menor jerarquía» se calcula **según la fuerza real de §4, incluyendo muestra, piezas y alcahuete**. No es la carta con el número impreso más bajo ni una elección estratégica de la IA.

Ejemplo: con pieza 2 de muestra, 3 ordinario y 6 ordinario, se juega automáticamente el **6 ordinario** porque es la más débil.

Si dos cartas disponibles comparten exactamente la misma jerarquía, el motor escoge la primera según este **orden fijo de palos: oros → copas → espadas → bastos**. Es un desempate **solo para la selección automática**, sin efecto sobre la fuerza de las cartas ni sobre los resultados de bazas.

### 13.3 Protección de Flor

La interfaz debe advertir **en privado** a quien tenga Flor antes de que juegue su primera carta. Si el jugador **elige jugarla sin cantar Flor**, **pierde los puntos y el derecho a anunciar esa Flor**, sin que se adjudiquen automáticamente tres puntos al rival. Si en cambio **se agota el reloj de su turno** antes de que haya jugado esa primera carta, el sistema **canta la Flor automáticamente**. Una omisión voluntaria y el vencimiento del reloj son eventos distintos.

## 14. Orden de prioridad y resolución de desafíos

### 14.1 Prioridad de conceptos

1. **Flor**, cuando exista, tiene prioridad sobre Envido y sobre el desarrollo de Truco.
2. **Envido** válido tiene prioridad sobre un **Truco pendiente**.
3. **Truco** se retoma después de resolver los conceptos anteriores, si la mano y el partido siguen activos.
4. Una respuesta o aumento legal debe resolverse **antes** de continuar jugando cartas.

### 14.2 Ejemplos normativos

- Hay un Truco pendiente y se toca válidamente Envido: se suspende la respuesta de Truco, se resuelve Envido y se regresa al Truco pendiente.
- Se toca Envido y un jugador tiene Flor: se anuncia Flor y **se cancela Envido**; se resuelve Flor.
- Un jugador con Flor responde **«Con Flor Quiero»** a Truco: queda aceptado el Truco, pero primero se resuelve Flor.
- Un jugador dice **«Flor y Truco»** sin Truco pendiente: primero se procesa Flor; el Truco queda planteado conforme a sus condiciones de legalidad.
- Se rechaza un Truco pendiente: se conceden los puntos por rechazo de §8.4 y termina la mano, sin borrar puntos ya adjudicados de Flor o Envido.

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

No se deben inventar reglas no acordadas. En particular, este documento **no fija** aún una política específica para eventos simultáneos a nivel de red (por ejemplo, dos respuestas de compañeros que llegan en el mismo instante), ni un criterio de desempate entre decisiones técnicas de entrega de mensajes. Estas situaciones se deben formalizar en la especificación funcional sin alterar las reglas de cartas aquí establecidas.

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
- Baza ganada por una carta de C: C sale en la siguiente, aunque A sea el mano original; si dos compañeros empatan en la carta ganadora, sale el más próximo al mano original en sentido antihorario.
- Baza parda: sale el mano original.
- Primera y segunda pardas, tercera parda: gana equipo del mano original.

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
- Contra Flor rechazada: cobra 3 por cada Flor propia el desafiante.
- Contra Flor al Resto aceptada: victoria directa del ganador de la comparación de Flores.
- Contra Flor al Resto rechazada: no hay victoria directa; cobra 3 por Flor propia el desafiante.
- Piezas 2, 4 y 5 de muestra en la misma mano: Flor 47.
- Una Flor anunciada cancela Envido pendiente.
- Primera Flor: solo en turno propio y antes de jugar la primera carta; después otros pueden cantar fuera de turno.
- Si un jugador juega voluntariamente su primera carta sin cantar Flor pese al aviso privado, pierde los puntos de esa Flor.
- Si se plantea Contra Flor y un compañero todavía tiene Flor habilitada, puede anunciarla antes de resolver el desafío.
- Contra Flor al Resto aceptada **en desempate**: gana la comparación de Flores y cobra **3 puntos**, sin ganar el partido directamente.

### 16.5 Truco, abandono y reloj

- Sin Truco aceptado, mano ganada: 1.
- Truco/Retruco/Vale Cuatro aceptados: 2/3/4 respectivamente.
- Truco/Retruco/Vale Cuatro rechazados: 1/2/3 para quien propuso el nivel rechazado.
- Truco → Retruco → Vale Cuatro → Quiero: mano por 4.
- Un compañero va al mazo: el otro sigue jugando; si ambos abandonan, gana el rival.
- Hay desafío pendiente: la opción «Irse al mazo» está deshabilitada.
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
