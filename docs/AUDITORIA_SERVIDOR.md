# Auditoría del servidor

Fecha de cierre: 2026-11-09.

## Diagnóstico y correcciones

- **API 6A y Unicode.** La respuesta pública ya serializaba correctamente el apodo `Ana Núñez`; la expectativa de prueba contenía texto doblemente codificado. Se sustituyó por literales Unicode escapados, por lo que la comprobación es independiente de la codificación del archivo fuente.
- **Privacidad de `ultimoCierre`.** La proyección pública propagaba el objeto interno mediante un *spread*. Esto podía incluir `comprobacionInterna`, con identificadores canónicos y cartas privadas. Se reemplazó por una lista explícita de campos públicos. La comprobación reglamentaria autorizada se proyecta bajo `ultimoCierre.comprobacion`, con asientos, cartas y tantos sólo cuando el cierre los autoriza.
- **Caso WebSocket de Envido intermitente.** La fixture combinaba repartos de Flor y de no-Flor, pero intentaba cantar Envido en una mano que ocasionalmente tenía Flor pendiente. Se corrigió la secuencia determinista: cada reparto consume primero el sorteo de repartidor y los casos Envido usan repartos sin Flor; el caso dedicado de Flor conserva su reparto con Flor. No se modificaron reglas ni producción.
- **Cierre por mazo.** La corrección ya presente permite cerrar una segunda baza iniciada tras Truco aceptado, conservando adjudicaciones anteriores de Flor/Envido y liquidando una sola vez el nivel aceptado de Truco.

## Privacidad y comprobación pública

La prueba `6C.6-R2` verifica que el snapshot serializado no expone `__maquina__`, `comprobacionInterna`, `jugadorId`, token ni estado canónico. `cartasRivalesRestantes` se mantiene: es información pública permitida. Las pruebas de motor y servidor que cubren Flor, Envido, cierre y snapshots confirman que las revelaciones reglamentarias siguen disponibles a través de la proyección pública autorizada, sin devolver el objeto canónico interno.

## Validaciones realizadas

La suite completa del servidor se ejecutó directamente con Node 24 (`.local/node/node.exe --test apps/server/dist/server.test.js`) mediante procesos persistentes. El límite de 30 segundos pertenecía a la interfaz de ejecución, no a Node ni a las pruebas; cada corrida se esperó hasta su código de salida real.

| Ejecución | Resultado | Pruebas | Duración del proceso |
| --- | --- | ---: | ---: |
| 1 | código 0 | 33 aprobadas, 0 fallidas | 84.322 s |
| 2 | código 0 | 33 aprobadas, 0 fallidas | 82.374 s |
| 3 | código 0 | 33 aprobadas, 0 fallidas | 80.977 s |
| 4 | código 0 | 33 aprobadas, 0 fallidas | 80.436 s |
| 5 | código 0 | 33 aprobadas, 0 fallidas | 80.567 s |

También se ejecutó:

- TypeScript del servidor y TypeScript raíz: correctos.
- Prueba focalizada API 6A: correcta.
- Prueba focalizada de privacidad `6C.6-R2`: correcta.
- Motor: 253 aprobadas, 0 fallidas.
- Web: 21 aprobadas, 0 fallidas.
- Build raíz (Prisma generate, TypeScript y Vite): correcto.

La primera invocación de `npm` sin anteponer Node 24 usó accidentalmente Node 18 del sistema y no es un resultado de la auditoría: falló antes de cargar las pruebas por incompatibilidad de entorno. Todas las validaciones registradas arriba usan Node 24.20.0.

## Riesgos residuales

- Las suites WebSocket integrales tardan aproximadamente 80--84 segundos por su cobertura de partidas completas; se validaron mediante procesos persistentes para no confundir el límite operativo de la consola con un resultado de prueba.
- No se detectaron fallos intermitentes durante las cinco ejecuciones consecutivas.
