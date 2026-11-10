@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>nul || goto :sin_node
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAYOR=%%V"
if not "%NODE_MAYOR%"=="24" goto :node_incorrecto
if not exist "node_modules" goto :sin_instalacion
if not exist "apps\web\dist\index.html" goto :sin_instalacion
if not exist "apps\server\dist\main.js" goto :sin_instalacion

echo.
echo === Truco Uruguayo ===
echo Iniciando juego local...
node scripts\lanzar-truco-local.mjs
set "RESULTADO=%ERRORLEVEL%"
if not "%RESULTADO%"=="0" goto :error
exit /b 0

:sin_node
echo ERROR: No se encontro Node.js. Instala Node.js 24.x.
goto :error

:node_incorrecto
echo ERROR: Se requiere Node.js 24.x. Se detecto:
node --version
goto :error

:sin_instalacion
echo ERROR: Truco todavia no esta instalado o compilado.
echo Ejecuta INSTALAR_TRUCO.bat primero.
goto :error

:error
echo.
echo No se pudo iniciar Truco. Esta ventana quedará abierta para mostrar el error.
pause
exit /b 1
