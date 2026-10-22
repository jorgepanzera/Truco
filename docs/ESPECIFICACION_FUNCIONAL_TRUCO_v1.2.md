# Especificación funcional del Truco Uruguayo — v1.2

**Documento vigente:** complementa y sustituye como referencia actual a la [Especificación Funcional v1.1](ESPECIFICACION_FUNCIONAL_TRUCO_v1.1.md), que se conserva como antecedente.
**Reglamento vigente:** [Reglamento v1.2](REGLAMENTO_TRUCO_URUGUAYO_v1.2.md). El Reglamento prevalece ante cuestiones reglamentarias.

> Salvo los cambios expresos de esta v1.2, se mantienen todos los requisitos de v1.1. Las decisiones posteriores aprobadas prevalecen sobre requisitos anteriores contradictorios.

## Flor: comportamiento requerido y estado de implementación

El motor debe aplicar la precisión de cierre del Reglamento v1.2: después de Flores de ambos equipos, una carta válida sin desafío pendiente consume la oportunidad de Contra Flor. La acción inválida no altera esa oportunidad ni el cierre. Los derechos restantes de Flor continúan hasta anuncio o pérdida por primera carta; agotados los derechos y sin desafío pendiente, la adjudicación se realiza exactamente una vez.

`EstadoManoCoordinada` integra `flor` como dominio independiente y no duplica cartas, muestra, turnos ni marcador. El contexto de Flor se deriva de las manos canónicas, la muestra, el orden original de mano y la condición de desempate.

La integración vigente cubre:

- anuncio inicial en turno y anuncios posteriores habilitados;
- pérdida atómica del derecho antes de una primera carta válida;
- Contra Flor y Contra Flor al Resto, sus propuestas, aumentos, respuestas y bloqueo de cartas mientras exista desafío pendiente;
- prioridad de Flor sobre Envido: un anuncio de Flor cancela un Envido pendiente sin puntos y sin reapertura de esa cadena;
- adjudicación diferida de Flor y resultado terminal semántico de Contra Flor al Resto aceptada fuera de desempate;
- eventos semánticos de anuncios, derechos perdidos, propuestas, respuestas, cierre, adjudicación, cancelación de Envido y terminación excepcional.

`resultadoPartida` solo representa la victoria excepcional `{ motivo: "contra-flor-al-resto", equipoGanador }`; no implementa todavía un módulo general de partido ni marcador acumulado.

## Integridad y validación

La validación histórica nivel B de Flor verifica invariantes deducibles del estado: Flor original, anuncios, derechos perdidos, propuestas y respuestas, pendiente, oportunidad consumida, bloqueos por rechazo, cierre, adjudicaciones y resultado terminal. El coordinador verifica además la correspondencia entre el resultado terminal coordinado y Flor, la relación entre primera carta y derecho perdido, y la incompatibilidad de Envido pendiente con Flor anunciada.

Limitaciones conocidas: el estado no conserva la causa individual de cada derecho perdido ni una instantánea de turno por anuncio. Por ello no se reconstruye toda la cronología; se rechazan contradicciones comprobables sin inventar información histórica.

Permanecen fuera de este incremento Truco, timeout, marcador acumulado, persistencia y coordinación completa de partida.

## Control de cambios

**Versión 1.2 — 22/10/2026.** Registra la decisión aprobada de frontera de Contra Flor, el cierre diferido de Flor y el estado técnico implementado de la integración Flor–Cartas–Envido y de su validación histórica. No modifica requisitos no relacionados de v1.1.
