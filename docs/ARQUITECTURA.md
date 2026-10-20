# Arquitectura de Truco Uruguayo

Este documento describe la organización del código y el estado actual de la aplicación. Para las reglas y los requisitos, consultar el [Reglamento v1.1](REGLAMENTO_TRUCO_URUGUAYO_v1.1.md) y la [Especificación Funcional v1.1](ESPECIFICACION_FUNCIONAL_TRUCO_v1.1.md); el Reglamento prevalece para las reglas de juego. El [README](../README.md) contiene instrucciones de instalación y uso.

## Estado actual

El proyecto es un monorepositorio TypeScript con cuatro npm workspaces: una aplicación web, un servidor y dos paquetes compartidos. Todavía no es jugable. La web muestra una pantalla inicial; el servidor ofrece un endpoint de salud; hay infraestructura provisional de persistencia y lógica de cartas y preparación de manos. La interfaz de mesa, el flujo completo de partidas, la IA y las funciones online quedan para etapas posteriores.

## Organización y dependencias

```text
apps/
  web/             Interfaz React y Vite
  server/          Servidor HTTP y persistencia
packages/
  shared/          Tipos compartidos
  game-engine/     Lógica y futura transición del juego
docs/              Reglamento, especificaciones y documentación
scripts/           Controles de arquitectura y diagnóstico
.github/workflows/ Integración continua
```

Las dependencias están orientadas hacia los paquetes compartidos:

```text
web ────────┐
            ├──> game-engine ──> shared
server ─────┘          │
   └───────────────────┴───────> shared
web ───────────────────────────> shared
```

`shared` no depende de otros módulos del proyecto. `game-engine` puede depender de `shared`, pero no de las aplicaciones, la interfaz, la red, la persistencia ni Node. Las aplicaciones declaran ambos paquetes como dependencias. Esto define límites de código; no implica que ya exista una partida conectada entre la web y el servidor.

## Web: `apps/web`

La interfaz usa React y Vite. [index.html](../apps/web/index.html) proporciona el elemento raíz; [main.tsx](../apps/web/src/main.tsx) monta React y carga los estilos; y [App.tsx](../apps/web/src/App.tsx) renderiza la pantalla de presentación. Los textos están en [textos.ts](../apps/web/src/textos.ts) y los estilos en [styles.css](../apps/web/src/styles.css). [App.test.tsx](../apps/web/tests/App.test.tsx) comprueba el renderizado básico.

Actualmente no hay una mesa de juego ni comunicación de partida con el servidor. `npm run dev:web`, ejecutado desde la raíz, compila primero los paquetes compartidos y luego inicia Vite. Si se cambian esos paquetes durante el desarrollo, hay que volver a ejecutar el comando para actualizar sus builds.

## Servidor: `apps/server`

El backend utiliza el servidor HTTP nativo de Node:

- [main.ts](../apps/server/src/main.ts) lee la configuración, inicia el servidor y gestiona su cierre.
- [config.ts](../apps/server/src/config.ts) valida host y puerto; sus valores predeterminados son `127.0.0.1` y `3000`.
- [server.ts](../apps/server/src/server.ts) crea el servidor y responde a `GET /health` con un estado JSON. Otras rutas reciben 404 y otros métodos sobre `/health`, 405.
- [server.test.ts](../apps/server/src/server.test.ts) prueba el comportamiento HTTP y la configuración.

`/health` verifica la respuesta del servidor, pero no consulta la base de datos. Todavía no hay endpoints ni transporte para partidas.

### Persistencia

La infraestructura usa Prisma y SQLite y reside en el servidor:

- [schema.prisma](../apps/server/prisma/schema.prisma) define el proveedor SQLite, el cliente generado y `InfrastructureProbe`, una tabla técnica de prueba que no representa una entidad del juego.
- [migrations](../apps/server/prisma/migrations) contiene las migraciones del esquema; [prisma7.config.ts](../apps/server/prisma7.config.ts) configura sus rutas y la URL de la base.
- [database-url.ts](../apps/server/src/database-url.ts) resuelve la URL local y [database.ts](../apps/server/src/database.ts) crea y cierra el cliente Prisma. El servidor HTTP aún no utiliza ese cliente.
- [persistence.test.ts](../apps/server/src/persistence.test.ts) prueba las migraciones y la lectura y escritura en una base temporal independiente de la base de desarrollo.

Sin `DATABASE_URL`, la base de desarrollo se ubica en `apps/server/prisma/dev.db`. El cliente Prisma se genera en `apps/server/src/generated/prisma/` y no se versiona. Las cuentas, salas, partidas y estadísticas aún no tienen modelos de persistencia.

## Tipos compartidos: `packages/shared`

[src/index.ts](../packages/shared/src/index.ts) define los tipos básicos comunes, entre ellos `Palo`, `ValorNominal`, `Carta`, `Modalidad` y `MetaPuntos`. Su propósito es dar un vocabulario común al motor y a las aplicaciones sin introducir dependencias hacia ellas.

## Motor: `packages/game-engine`

[cartas.ts](../packages/game-engine/src/cartas.ts) contiene lógica de cartas: construcción y validación del mazo de 40 cartas, detección de duplicados, muestra, piezas y alcahuete, jerarquía, comparación y valor individual. [cartas.test.mjs](../packages/game-engine/tests/cartas.test.mjs) cubre esa lógica. El valor individual todavía no constituye un cálculo completo de envido o flor.

[mano.ts](../packages/game-engine/src/mano.ts) define `Mesa` y `JugadorMesa`: cada jugador tiene ID, ID de equipo y posición entera única desde cero, creciente en sentido antihorario. `validarMesa` exige dos o cuatro jugadores según modalidad, dos equipos completos y alternados; en cuatro posiciones esto enfrenta a los compañeros. El orden de entrada del arreglo no determina el asiento. Las funciones de recorrido identifican vecinos, mano original, su equipo, orden de reparto y siguiente repartidor.

`seleccionarPrimerRepartidor` recibe un índice externo entero uniforme entre cero y el número de jugadores menos uno. `barajarMazo` recibe un mazo completo y exactamente 39 índices externos: para Fisher–Yates, cada elección corresponde respectivamente a los límites inclusivos 39 hasta 1 y debe ser uniforme incluso condicionada a las elecciones anteriores. El motor valida los límites, pero la uniformidad y la generación segura corresponden a la capa externa. No genera azar interno.

`prepararMano` valida mesa, repartidor y mazo completo; entrega tres vueltas desde el mano original, toma la carta siguiente como muestra y conserva el remanente. `ManoPreparada` incluye la mesa ordenada, equipos, identidades, orden de recorrido, entregas cronológicas, manos por jugador, muestra, remanente y salida de la primera baza. Las cartas de entrada se copian; las entregas describen las mismas cartas que las manos y no son cartas adicionales. La muestra se toma después de todas las entregas. El remanente es información del mazo, sin operación de reparto adicional durante la mano. [mano.test.mjs](../packages/game-engine/tests/mano.test.mjs) cubre estas operaciones.

[index.ts](../packages/game-engine/src/index.ts) exporta estas operaciones y la lógica de cartas, y define el contrato genérico provisional `Transicion`: recibe estado, acción y entradas externas, y produce un estado nuevo con eventos ordenados o un rechazo. La transición concreta de cartas lo reutiliza sin entradas externas. La intención es que sea pura y reproducible, con azar y tiempo como entradas explícitas; la gestión de efectos, relojes y acceso a información corresponde a capas externas. El contrato de tipos por sí solo no garantiza pureza ni inmutabilidad profunda.

`juego-cartas.ts` representa el juego de cartas de una mano preparada con cartas disponibles, jugadas con autor, baza actual, bazas resueltas y turno. `iniciarJuegoCartas` valida la estructura de la mano; `ejecutarCarta` es una transición pura con eventos o rechazo estructurado. La resolución reutiliza la jerarquía existente, compara la máxima carta por equipo, aplica la tabla de bazas del Reglamento §5.2 y la salida de §5.3. Apuestas, puntuación, relojes y retiro siguen pendientes.

## Configuración y calidad

- [package.json](../package.json) declara los workspaces y los comandos comunes. [package-lock.json](../package-lock.json) fija el árbol de dependencias.
- [tsconfig.base.json](../tsconfig.base.json) y los `tsconfig.json` de cada workspace configuran TypeScript estricto, módulos ESM y referencias entre proyectos.
- [check-architecture.mjs](../scripts/check-architecture.mjs) revisa manifiestos, referencias TypeScript e imports de `shared` y `game-engine` para controlar sus dependencias. Es un control estático, no una demostración de ausencia de efectos secundarios.
- [eslint.config.mjs](../eslint.config.mjs) y [.prettierrc.json](../.prettierrc.json) configuran lint y formato.
- [ci.yml](../.github/workflows/ci.yml) configura GitHub Actions para eventos `push` y `pull_request`: instala dependencias con `npm ci` y ejecuta `npm run check`.

Desde la raíz, `npm run check` comprueba formato, lint, arquitectura y tipos; ejecuta pruebas del motor, web, servidor y base de datos; y compila. El [README](../README.md) detalla los comandos individuales, las variables de entorno y las particularidades de Windows.
