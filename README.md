# Truco Uruguayo

Base del monorepositorio para la aplicación web de Truco Uruguayo. Los documentos normativos vigentes son el [Reglamento v2.0](docs/REGLAMENTO_TRUCO_URUGUAYO_v2.0.md) y la [Especificación Funcional v1.4](docs/ESPECIFICACION_FUNCIONAL_TRUCO_v1.4.md). El Reglamento prevalece para las reglas de juego; las versiones anteriores se conservan como antecedentes históricos.

La [arquitectura de la aplicación](docs/ARQUITECTURA.md) describe los módulos, sus dependencias y el estado de implementación.

El proyecto todavía no es jugable de extremo a extremo. El motor de reglas está implementado; las Fases 6A y 6B incorporan sesiones de invitado, partidas 1v1 en memoria, acciones versionadas y sincronización privada por WebSocket. `POST /api/matches` admite `mode: "1v1-vs-machine"` para iniciar inmediatamente contra la máquina; no requiere una segunda sesión. La mesa web, la persistencia durable y la reconexión siguen pendientes.

La etapa 6C incorpora el jugador automático 1v1, estrategias de cartas, apuestas y tanteador, e inicio inmediato contra máquina mediante `mode: "1v1-vs-machine"`. La validación integral de partidas completas y la matriz especializada de desafíos contra máquina siguen pendientes.

## Estructura

- `apps/web`: aplicación web inicial con React y Vite.
- `apps/server`: servidor HTTP mínimo con endpoint de salud.
- `packages/game-engine`: futuro motor de reglas compartido.
- `packages/shared`: futuros modelos y contratos compartidos.
- `docs`: documentos normativos.
- `scripts`: controles arquitectónicos y diagnóstico de Prisma.
- `.github/workflows`: verificación automatizada para GitHub Actions.

## Entorno

Se requiere Node.js 24 LTS y npm 11; las versiones de referencia son Node.js 24.20.0 y npm 11.19.0. No se requiere Docker. Una vez disponibles esas herramientas, instalar los workspaces desde la raíz con:

```sh
npm ci
```

En PowerShell, si la política de ejecución bloquea `npm.ps1`, usar `npm.cmd ci` sin modificar dicha política. Para comprobar los workspaces instalados, ejecutar `npm ls --all` (o `npm.cmd ls --all`).

### Node portátil en Windows

Opcionalmente, se puede colocar la distribución oficial portátil de Node 24.20.0 en `.local/node/`, con `node.exe` directamente dentro de esa carpeta. Esta carpeta está excluida de Git. En una terminal PowerShell abierta en la raíz del proyecto, activar esa copia solo para la terminal actual:

```powershell
$env:PATH = "$(Join-Path (Get-Location) '.local\node');$env:PATH"
node --version
npm.cmd --version
npm.cmd ci
```

Al cerrar esa terminal, se descarta el cambio de `PATH`. Abrir una terminal nueva y repetir el comando de activación cuando se vuelva a trabajar en este proyecto. No cambia la instalación global de Node ni el entorno de otras terminales.

## TypeScript y límites entre módulos

TypeScript 5.9 compila en modo estricto con módulos ESM y resolución `NodeNext`. La configuración común está en `tsconfig.base.json`; cada workspace define sus bibliotecas, carpetas y referencias en su propio `tsconfig.json`. Las importaciones locales futuras entre archivos deben usar extensión `.js` en el código TypeScript para ser compatibles con ESM de Node.

`shared` no depende de otros módulos del proyecto; `game-engine` depende de `shared`; `web` y `server` dependen de ambos paquetes. Los paquetes no deben depender de las aplicaciones. El motor debe permanecer independiente de Node, interfaz, red, persistencia e IA.

### Frontera provisional del motor

`@truco/game-engine` exporta los tipos genéricos `Transicion` y `ResultadoTransicion`. Una transición recibe estado, acción y entradas externas explícitas; devuelve estado nuevo y eventos ordenados, o un rechazo estructurado. La futura implementación debe ser pura, no mutar sus entradas y dar el mismo resultado para entradas equivalentes. El azar y el tiempo deben llegar explícitamente como datos reproducibles; los efectos y la gestión de relojes quedan fuera del motor. La información pública y privada debe poder separarse para que el servidor aplique la proyección autorizada.

El contrato es provisional: los tipos concretos de estado, acción, eventos, rechazo y entradas externas, la representación del azar y tiempo y las garantías de inmutabilidad se definirán y probarán en la Etapa 2. No existe aún una transición ejecutable; TypeScript no garantiza pureza o inmutabilidad profunda.

`npm run check:architecture` ejecuta pruebas del control y revisa manifiestos, referencias TypeScript e imports de los fuentes de `game-engine` y su dependencia `shared`. Permite únicamente imports locales dentro del mismo `src` y, para el motor, `@truco/shared`; rechaza dependencias externas, imports dinámicos no literales, `require` y referencias triple slash. Se ejecuta también al comienzo de `typecheck`. Esta comprobación estática no demuestra ausencia de efectos secundarios ni impide toda evasión deliberada; se complementará con revisión y pruebas del motor.

Desde la raíz, después de `npm ci`:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

`typecheck` comprueba la arquitectura, genera el cliente Prisma y compila las referencias para disponer de sus declaraciones; luego comprueba cada workspace sin emitir archivos adicionales. `build` genera JavaScript ESM y declaraciones de los paquetes, y un build de producción Vite en `apps/web/dist/`; las salidas TypeScript de la web quedan en `apps/web/dist-types/`. Los scripts individuales `typecheck` requieren que las dependencias ya se hayan compilado; el comando raíz prepara ese estado.

## Calidad e integración continua

Desde la raíz, `npm.cmd run check` comprueba formato, lint, arquitectura, tipos, pruebas web, HTTP y de persistencia, y finalmente compila. No aplica migraciones a la base de desarrollo: la prueba de persistencia usa su propia base temporal. Cada control sigue disponible por separado: `format:check`, `lint`, `check:architecture`, `typecheck`, `test:web`, `test:server`, `test:db` y `build`.

Prettier 3 usa la configuración mínima de `.prettierrc.json`, con ancho de 100 caracteres y finales LF. `npm.cmd run format:check` solo verifica; `npm.cmd run format` aplica formato. `.prettierignore` excluye documentos normativos, dependencias, archivos generados, builds y el lockfile. ESLint 9 usa configuración flat, reglas recomendadas de JavaScript y TypeScript y comprobaciones de hooks de React, con entornos de Node y navegador separados. Los archivos generados y builds quedan excluidos.

El workflow de GitHub Actions ejecuta `npm ci` y `npm run check` en pushes y pull requests con Node 24.20.0, sin secretos ni base externa. Su resultado debe comprobarse en GitHub una vez que los archivos estén disponibles allí.

Después de un push autorizado que incluya el workflow, abrir la pestaña **Actions** del repositorio, seleccionar la ejecución «Verificaciones» y revisar el resultado de los pasos `npm ci` y `npm run check`. Un resultado local correcto no confirma por sí solo la ejecución remota.

## Aplicación web

### Distribución local para Windows

La distribución para usuarios finales se genera con Node 24 y no incluye dependencias ni datos locales:

```powershell
npm.cmd run package:windows
```

El comando crea `entregables/Truco-1.0.0/`. Esa carpeta contiene `INSTALAR_TRUCO.bat`, `JUGAR_TRUCO.bat`, las fuentes mínimas para compilar y las [instrucciones para Windows](INSTRUCCIONES_WINDOWS.md). Quien recibe la carpeta instala Node.js 24, ejecuta el instalador una vez con Internet y luego abre el juego con el lanzador; la ejecución normal usa sólo el servidor local en `127.0.0.1:3000` y la web compilada, sin Vite.

El servidor sirve `apps/web/dist/` y aplica fallback SPA únicamente a rutas web. `/api` y `/ws` siguen reservados al transporte del juego y nunca responden el `index.html` de la aplicación.

En una terminal PowerShell de VS Code, activar Node 24 como se indica arriba, ejecutar `npm.cmd ci` y, desde la raíz:

```powershell
npm.cmd run dev:web
```

Abrir en el navegador la dirección que indique Vite, normalmente `http://localhost:5173/`. Para detenerlo, presionar `Ctrl+C` en la terminal. El comando compila primero los paquetes compartidos; si se modifican sus fuentes durante el desarrollo, volver a ejecutar el comando para actualizar sus builds.

Para ejecutar la prueba básica de renderizado y compilar para producción:

```powershell
npm.cmd run test:web
npm.cmd run build
```

### Desarrollo local de la interfaz (Fase 6C.7.1)

El repositorio incluye Node 24 en `.local/node`. Con dos terminales abiertas en la raíz, ejecutar primero el servidor:

```powershell
& .\.local\node\node.exe .\node_modules\prisma\build\index.js generate --schema apps/server/prisma/schema.prisma
& .\.local\node\node.exe .\node_modules\typescript\bin\tsc --build
& .\.local\node\node.exe .\apps\server\dist\main.js
```

En la segunda terminal, iniciar Vite:

```powershell
& .\.local\node\node.exe .\node_modules\vite\bin\vite.js apps/web
```

Abrir la URL que informa Vite (habitualmente `http://localhost:5173`), ingresar un apodo y crear la partida. Vite reenvía `/api` y el WebSocket `/ws` a `127.0.0.1:3000`, por lo que no hace falta configurar CORS ni un proxy externo. El cliente usa rutas del mismo origen por defecto; no definir `VITE_SERVER_URL` durante esta prueba local.

La pantalla solo comunica que el proyecto está en preparación. Las futuras cartas visuales se incorporarán en la Etapa 3 como imágenes de una baraja española tradicional ilustrada de 40 cartas, con dorso común y licencia de uso adecuada.

## Servidor HTTP y partidas 1v1 (Fase 6A)

Con Node 24 activado en la terminal, desde la raíz:

```powershell
npm.cmd run dev:server
```

Abrir `http://127.0.0.1:3000/health` o consultar desde otra terminal con `Invoke-RestMethod http://127.0.0.1:3000/health`. Para detenerlo, usar `Ctrl+C`. El comando compila antes de arrancar; para ejecutar el servidor ya compilado usar `npm.cmd run start:server`. Para compilar y ejecutar las pruebas HTTP, usar `npm.cmd run test:server`.

El servidor lee `TRUCO_SERVER_HOST` y `TRUCO_SERVER_PORT` del entorno del proceso. Sus valores predeterminados son `127.0.0.1` y `3000`; el puerto debe ser un entero entre 0 y 65535. El puerto 0 solicita al sistema uno disponible y se muestra al iniciar. Por ejemplo, en PowerShell se puede configurar el puerto de la sesión con `$env:TRUCO_SERVER_PORT = '3001'`. `.env.example` documenta las variables: no se carga automáticamente.

El cierre escucha SIGINT y SIGTERM; en Windows, Ctrl+C genera SIGINT, mientras que SIGTERM no se entrega de forma equivalente a Unix. `/health` no abre ni comprueba la base de datos.

La API HTTP inicial usa JSON. Crear un invitado con `POST /api/guest-sessions` y `{"nickname":"Ana"}` devuelve un token Bearer impredecible y el apodo. Ese token se envía en `Authorization: Bearer <token>` para crear una partida con `POST /api/matches` (meta 40 por defecto o `{"targetScore":30}`), unirse mediante `POST /api/matches/:matchId/join`, iniciarla con `POST /api/matches/:matchId/start` y leer su snapshot autorizado con `GET /api/matches/:matchId`.

La implementación sólo admite 1v1 y conserva sesiones y partidas en memoria: un reinicio del servidor las elimina. El snapshot contiene únicamente cartas del solicitante, además de información pública de mesa; no expone cartas ajenas, mazo, reparto, tokens ni el estado canónico. No hay interfaz visual, persistencia de partidas, reconexión ni control definitivo de dispositivos.

### WebSocket de partidas (Fase 6B)

El mismo puerto ofrece `ws://127.0.0.1:3000/ws`. Por seguridad, el cliente no coloca el token en la URL: su primer mensaje debe ser `{"type":"auth","token":"..."}`; después envía `{"type":"subscribe","matchId":"..."}` y recibe un `game.snapshot` privado. Las acciones usan `game.action` con `matchId`, `actionId`, `expectedVersion` y una intención como `play-card`, `truco`, `envido` o `go-to-mazo`.

El servidor confirma una transición con `game.confirmed`, rechaza errores o versiones obsoletas con `game.rejected` y entrega snapshots privados actualizados a los participantes suscritos. El transporte es provisional: no hay persistencia, recuperación tras reinicio, relojes ni control definitivo de un único dispositivo.

## Persistencia local con Prisma y SQLite

Prisma 7 utiliza `apps/server/prisma7.config.ts` para configurar la URL y las rutas del esquema y de las migraciones. El esquema está en `apps/server/prisma/schema.prisma` y las migraciones en `apps/server/prisma/migrations/`. El generador `prisma-client` produce el cliente ESM en `apps/server/src/generated/prisma/`, una salida excluida de Git. El adaptador `@prisma/adapter-better-sqlite3` permite al cliente acceder a SQLite. El módulo `apps/server/src/database.ts` construye el cliente y permite cerrarlo; el servidor HTTP no lo utiliza.

Sin `DATABASE_URL`, la base de desarrollo queda en `apps/server/prisma/dev.db`. Se aceptan URL locales `file:`; las rutas relativas se resuelven desde `apps/server`, por ejemplo `file:./prisma/dev.db`. La variable se lee del entorno: `.env.example` no se carga automáticamente. Para elegir otra base en PowerShell, configurar, por ejemplo, `$env:DATABASE_URL = 'file:./prisma/dev.db'` en la terminal actual. Los archivos SQLite locales y sus auxiliares están excluidos de Git.

Desde la raíz, con Node 24 activado:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run test:db
```

`db:generate` genera el cliente sin crear ni migrar una base. `db:migrate` aplica las migraciones existentes a la base configurada y permite crearla desde cero. `db:migrate:dev` está disponible para crear y aplicar migraciones durante el desarrollo; revisar cualquier solicitud de reinicialización y cancelarla si contiene datos que deban conservarse. `test:db` genera el cliente y ejecuta las migraciones sobre una base nueva en un directorio temporal propio de la prueba; escribe, lee y cierra el cliente, y elimina únicamente sus archivos temporales conocidos. No usa ni borra la base de desarrollo.

`InfrastructureProbe` es una tabla técnica provisional para verificar las migraciones y la persistencia; no representa ninguna entidad del juego. Los modelos de cuentas, salas, partidas y estadísticas se definirán en etapas posteriores. La recuperación de partidas de EF-098 y la atomicidad e idempotencia de acciones de EF-099 todavía no están implementadas.

En este entorno Windows se observó que Prisma Migrate puede fallar con `Schema engine error` sin detalles cuando `RUST_LOG=warn`. Las pruebas activan `RUST_LOG=info` solo en el proceso de migración. Si ocurre al ejecutar una migración manual, probar `$env:RUST_LOG = 'info'` en la terminal y volver a ejecutar el comando; esto no modifica la configuración global. La causa del fallo no está confirmada.

Para repetir el diagnóstico aislado, ejecutar `node scripts/diagnose-prisma.mjs`: copia el esquema y las migraciones a un directorio temporal, prueba `migrate deploy` y `migrate dev` con ambos niveles de log y elimina ese directorio. La configuración temporal usa la misma URL SQLite local, pero no carga el archivo de configuración del proyecto. Con `$env:DEBUG = 'prisma:*'` se pueden consultar registros adicionales; para desactivarlos en esa terminal, ejecutar `Remove-Item Env:DEBUG`.
