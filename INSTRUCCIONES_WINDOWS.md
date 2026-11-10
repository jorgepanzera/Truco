# Truco Uruguayo para Windows

## Primera instalación

1. Instalá **Node.js 24.x** desde el sitio oficial de Node.js.
2. Descomprimí la carpeta `Truco-1.0.0` en una ubicación donde tengas permisos de escritura, por ejemplo Documentos.
3. Verificá que haya conexión a Internet sólo para esta primera preparación.
4. Hacé doble clic en `INSTALAR_TRUCO.bat` y esperá el mensaje de instalación finalizada.

No hace falta abrir PowerShell, CMD, Git ni instalar una base de datos.

## Jugar

1. Hacé doble clic en `JUGAR_TRUCO.bat`.
2. Esperá a que se abra el navegador con Truco Uruguayo.
3. Dejá abierta la ventana negra de Truco mientras jugás: es el servidor local del juego.

El juego funciona en `http://127.0.0.1:3000` y no necesita Internet después de haber sido instalado.

## Cerrar el juego

Cerrá la ventana negra de Truco cuando termines. Eso detiene el servidor local. Cerrar solamente el navegador no detiene la partida que está en memoria.

## Si aparece un error

- Si se pide Node.js 24, instalá o actualizá Node.js y repetí el paso.
- Si la instalación falla, comprobá Internet y ejecutá nuevamente `INSTALAR_TRUCO.bat`.
- Si el puerto 3000 está ocupado por otro programa, cerrá ese programa e intentá de nuevo. Si ya hay otra instancia de Truco abierta, el lanzador reutiliza esa instancia.
- Para más detalles del servidor, revisá `logs\servidor.log` dentro de la carpeta del juego.
