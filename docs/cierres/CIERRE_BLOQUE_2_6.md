# Cierre del bloque 2.6 — Motor de Truco Uruguayo

## Identificación

- **Proyecto:** Truco.
- **Etapa:** 2 — Motor de reglas.
- **Bloque:** 2.6 — Truco e integración coordinada.
- **Fecha de cierre:** 30/10/2026.
- **Estado:** completado.

## Alcance implementado

El motor incorpora un estado canónico independiente para Truco, con propuesta pendiente y apuesta activa. Implementa Truco, Retruco y Vale Cuatro; sus respuestas Quiero y No Quiero; y los aumentos directos que aceptan implícitamente el nivel previo cuando corresponde.

Los rechazos producen adjudicaciones semánticas y finalizan canónicamente la mano; las bazas adjudican el valor de la apuesta aceptada una única vez. La integración coordinada conserva como fuentes canónicas las cartas, bazas, turnos, equipos, Flor y Envido. Aplica sus prioridades: Flor puede cancelar un Envido pendiente sin adjudicarlo y suspende las operaciones incompatibles de Truco.

`con-flor-quiero` es una transición compuesta, pura y atómica: anuncia una Flor legítima y acepta la propuesta pendiente de Truco, Retruco o Vale Cuatro sin adjudicar puntos anticipadamente. La excepción de primer anuncio de Flor fuera de turno está encapsulada en esa transición coordinada. El motor produce eventos semánticos ordenados y rechazos estructurados; sus validadores comprueban invariantes estructurales e históricos deducibles.

## Normativa

El Reglamento v1.3 precisa la legitimación y oportunidad de los aumentos de Truco. El Reglamento v1.4 precisa el alcance de «Con Flor Quiero» y su excepción exclusiva de turno. Ambas versiones complementan las reglas anteriores no modificadas.

## Pruebas y verificaciones

Al cierre se ejecutaron correctamente:

- Suite completa del motor: **121/121** pruebas aprobadas.
- Pruebas focalizadas de Truco, Flor, Envido y coordinador.
- `npm.cmd run check`.
- `git diff --check`.

Las pruebas cubren propuestas, respuestas, aumentos, aumentos directos, bloqueos y prioridades Flor–Envido–Truco, rechazos, bazas, estados adulterados, inmutabilidad, determinismo y «Con Flor Quiero».

## Limitaciones conocidas

- No existe todavía marcador acumulado canónico.
- Las adjudicaciones se comunican mediante eventos semánticos.
- No existe un historial persistente completo de acciones.
- La causa histórica de un primer anuncio de Flor fuera de turno no puede reconstruirse retrospectivamente: el estado no almacena procedencia redundante.
- La excepción de «Con Flor Quiero» se garantiza al ejecutar su transición pública encapsulada.

Estas limitaciones no representan defectos del alcance cerrado de 2.6.

## Próximos bloques

Sin implementarlos en este cierre, quedan previstos «Flor y Truco», irse al mazo, marcador y finalización de partido, automatismos de tiempo y las demás funcionalidades contempladas por la especificación.
