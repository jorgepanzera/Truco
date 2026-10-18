# Informe técnico de cierre preparado — Etapa 1

Este informe describe la base implementada y la auditoría de la Tarea 9. No es un documento normativo de las reglas. Las referencias vigentes son el [Reglamento v1.1](REGLAMENTO_TRUCO_URUGUAYO_v1.1.md) y la [Especificación Funcional v1.1](ESPECIFICACION_FUNCIONAL_TRUCO_v1.1.md); el Reglamento prevalece para las reglas. La aprobación de cierre de etapa corresponde al usuario.

## Objetivo y tareas

La Etapa 1 prepara un monorepositorio reproducible con TypeScript, una aplicación web inicial, un servidor mínimo, persistencia SQLite de infraestructura, controles de calidad y documentación. No entrega un juego jugable.

1. **Monorepositorio:** npm workspaces, entorno local, exclusiones y documentación inicial.
2. **TypeScript y límites:** compilación estricta, ESM y dependencias dirigidas entre paquetes.
3. **Tipos compartidos:** conceptos mínimos de cartas, modalidades y metas respaldados por el Reglamento.
4. **Frontera del motor:** contrato genérico provisional y control estático de aislamiento.
5. **Web:** pantalla inicial React/Vite y prueba de renderizado; la verificación visual en navegador fue aprobada por el usuario.
6. **Servidor:** HTTP nativo, configuración local, `GET /health`, ciclo de vida y pruebas.
7. **Prisma y SQLite:** cliente, migración inicial, entidad técnica provisional y pruebas aisladas.
8. **Calidad y CI:** Prettier, ESLint, comando `check`, diagnóstico de Prisma y workflow de GitHub.
9. **Auditoría y cierre:** revisión de documentación, arquitectura, comandos, Git, CI y riesgos; resultados consignados aquí.

## Arquitectura y tecnologías

- `packages/shared` contiene tipos básicos y no depende de otros módulos del proyecto.
- `packages/game-engine` puede depender de `shared`; su contrato genérico todavía no ejecuta reglas. El control arquitectónico revisa los manifiestos, referencias e imports de ambos paquetes, pero no demuestra por sí solo pureza ni ausencia de toda evasión deliberada.
- `apps/web` usa React y consume los paquetes compartidos; muestra una pantalla de preparación.
- `apps/server` usa HTTP nativo y puede consumir ambos paquetes. Prisma y SQLite permanecen en el servidor y `/health` no depende de la base de datos.
- `docs` reúne las referencias normativas y este informe; `scripts` contiene controles y el diagnóstico; `.github/workflows` contiene la configuración CI.

La configuración TypeScript base activa `strict`, ESM y resolución `NodeNext`; los cuatro workspaces la heredan. Versiones fijadas principales: Node.js **24.20.0** y npm **11.19.0** como referencia; TypeScript **5.9.3**; React/React DOM **19.2.0**; Vite **7.3.7**; Vitest **4.1.12**; Prisma, cliente y adaptador SQLite **7.10.1**; `better-sqlite3` **12.11.1**; Prettier **3.9.10**; ESLint **9.39.5**. El lockfile fija las dependencias transitivas. No se requiere Docker.

## Uso y pruebas

Desde la raíz, con Node 24 y npm 11 disponibles:

```powershell
npm.cmd ci
npm.cmd run dev:web
npm.cmd run dev:server
```

Los dos últimos comandos se ejecutan en terminales distintas. Vite comunica su URL, normalmente `http://localhost:5173/`; el servidor ofrece `http://127.0.0.1:3000/health`. El [README](../README.md) explica cómo activar Node portátil en PowerShell, configurar host y puerto y detener procesos.

```powershell
npm.cmd run check
npm.cmd run test:web
npm.cmd run test:server
npm.cmd run test:db
npm.cmd run db:generate
npm.cmd run db:migrate
```

`check` incluye formato, lint, control arquitectónico, tipos, las tres suites y build. `db:generate` genera el cliente; `db:migrate` aplica las migraciones existentes a la base configurada, por defecto `apps/server/prisma/dev.db`. Es una operación explícita sobre esa base. Las pruebas de persistencia usan otra base creada en un directorio temporal propio y no migran ni borran la base de desarrollo. `.env.example` documenta variables, pero no se carga automáticamente.

## Resultado de la auditoría local

Con Node 24.20.0 y npm 11.19.0 en Windows, después de `npm ci`:

| Control | Resultado |
| --- | --- |
| Instalación | 416 paquetes agregados, 421 auditados, 0 vulnerabilidades reportadas |
| `npm run check` | Correcto: Prettier, ESLint, arquitectura, tipos, pruebas y build |
| Pruebas | Arquitectura 3/3; web 1/1; servidor 6/6; persistencia 2/2 |
| `npm ls --all` | Correcto, código de salida 0 |
| Workflow | YAML y estructura analizados localmente; ejecución real en GitHub pendiente |

Los hashes de los dos documentos normativos permanecieron iguales durante los controles. La base predeterminada de desarrollo estaba ausente antes y después. No se observaron otras bases SQLite locales en la búsqueda realizada fuera de dependencias y la instalación portátil. El cliente Prisma, las salidas de compilación y dependencias son archivos generados excluidos de Git.

## Riesgos y asuntos abiertos

- **Alta — historial y entrega:** la especificación funcional v1.0 figura agregada en el índice y ausente del árbol de trabajo (`AD`). Se debe conservar su contenido histórico y acordar su restauración antes de preparar el siguiente commit. La v1.1 está presente sin seguimiento. La mayoría de los archivos del proyecto también está sin seguimiento.
- **Media — Prisma en Windows:** el diagnóstico previo reprodujo `Schema engine error` vacío con `RUST_LOG=warn` en `migrate deploy` y `migrate dev`; ambos funcionaron con `info`. La causa no está confirmada. `test:db` usa `info` para su proceso de migración; para migraciones manuales se documenta la misma mitigación. No se garantiza que resuelva todos los entornos ni se ha verificado todavía el workflow en Linux remoto.
- **Media — ESLint 9:** la versión solicitada 9.39.5 está fuera de soporte desde el 6 de agosto de 2026. Evaluar actualización compatible en una tarea autorizada, sin cambiarla durante este cierre.
- **Media — CI remoto:** existe configuración para pushes y pull requests, Node 24.20.0, `npm ci` y `npm run check`, sin secretos ni bases externas. El cliente Prisma se genera durante los scripts y la prueba usa SQLite temporal. La ejecución en GitHub aún no fue observada.
- **Baja — dependencias:** npm informó `whatwg-encoding@3.1.1` y `prebuild-install@7.1.3` obsoletos y cuatro scripts de instalación no cubiertos por `allowScripts`: `@prisma/engines`, `better-sqlite3`, `esbuild` y `prisma`. La instalación y las pruebas terminaron correctamente; no se modificó la política de scripts.
- **Baja — señales:** las pruebas emiten `SIGINT` y `SIGTERM` mediante `process.emit` y verifican cierre; además, la prueba HTTP comprueba que el puerto se libera. No consta una verificación manual de Ctrl+C real en esta auditoría, ni una prueba de entrega real de SIGTERM por el sistema operativo Windows.

## Git y preparación del siguiente commit

El repositorio ya tiene el commit `f5126a6` («Commit inicial»). El Reglamento v1.1 está en seguimiento. La v1.0 funcional está preparada en el índice pero ausente del árbol de trabajo; la v1.1 funcional y los archivos de implementación están sin seguimiento. El remoto `origin` usa HTTPS con GitHub; no se consultaron ni publicaron credenciales.

Propuesta sujeta a autorización, sin ejecutar durante esta tarea:

1. Restaurar **desde el índice** el archivo histórico v1.0 al árbol de trabajo con `git restore --worktree -- docs/ESPECIFICACION_FUNCIONAL_TRUCO_v1.0.md`, conservando su contenido preparado.
2. Revisar `git status --short`, el contenido de `.env.example` y los archivos nuevos. Mantener excluidos `node_modules`, `.local/node`, builds, cliente generado, bases y auxiliares SQLite, `.env` privados y temporales. Tras la revisión, una propuesta de preparación explícita es:

   ```powershell
   git add -- .env.example .github/workflows/ci.yml .gitignore .nvmrc .prettierignore .prettierrc.json README.md eslint.config.mjs package.json package-lock.json tsconfig.base.json tsconfig.json apps/ packages/ scripts/ docs/ESPECIFICACION_FUNCIONAL_TRUCO_v1.1.md docs/CIERRE_ETAPA_1.md
   ```

   La v1.0 ya está preparada en el índice y el Reglamento ya está en seguimiento. Antes de usar los directorios de la lista, revisar su contenido y sus exclusiones; no usar `git add -f` para archivos ignorados.
3. Examinar `git diff --cached --stat` y `git diff --cached` antes de un commit autorizado.
4. Después de un push autorizado, abrir **Actions → Verificaciones** y revisar instalación y `check`; no se ha ejecutado ningún push en esta auditoría.

La exploración de patrones comunes de credenciales no mostró coincidencias en los archivos examinados, pero no equivale a una auditoría completa de secretos. Es necesaria una revisión antes de publicar.

## Requisitos para comenzar la Etapa 2

Se requiere aprobación explícita del usuario para cerrar la Etapa 1 y autorizar el alcance siguiente (EF-108). En la Etapa 2 se deberá consultar nuevamente el Reglamento y la especificación, definir los tipos concretos y desarrollar y probar el motor conforme a sus casos obligatorios. Las ambigüedades identificadas en la sección 10 de la especificación deben consultarse cuando afecten una transición; no se deben inventar reglas.

## Funcionalidades aún no implementadas

No existen reglas ejecutables, reparto, turnos, estado completo ni puntuación; tampoco mesa gráfica, cartas ilustradas, IA ni juego offline. Faltan cuentas, autenticación, salas, búsqueda, WebSocket, juego online, acciones idempotentes, recuperación de partidas, estadísticas y despliegue. La entidad `InfrastructureProbe` solo verifica infraestructura y no es un modelo funcional del juego.
