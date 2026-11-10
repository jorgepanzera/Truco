@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === Instalador de Truco Uruguayo ===
echo.
where node >nul 2>nul || goto :sin_node
where npm.cmd >nul 2>nul || goto :sin_npm
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAYOR=%%V"
if not "%NODE_MAYOR%"=="24" goto :node_incorrecto

echo Node.js 24 detectado. Instalando dependencias...
call npm.cmd ci
if errorlevel 1 goto :error_instalacion

echo.
echo Compilando Truco para uso local...
call npm.cmd run build
if errorlevel 1 goto :error_compilacion

if not exist "apps\web\dist\index.html" goto :error_archivos
if not exist "apps\server\dist\main.js" goto :error_archivos

echo.
echo Instalacion finalizada correctamente.
echo Ahora podes ejecutar JUGAR_TRUCO.bat con doble clic.
pause
exit /b 0

:sin_node
echo ERROR: No se encontro Node.js.
echo Instala Node.js 24.x y volve a ejecutar este archivo.
goto :error

:sin_npm
echo ERROR: No se encontro npm junto a Node.js.
echo Reinstala Node.js 24.x y volve a intentar.
goto :error

:node_incorrecto
echo ERROR: Se requiere Node.js 24.x. Se detecto la version actual:
node --version
goto :error

:error_instalacion
echo ERROR: No se pudieron instalar las dependencias.
echo Verifica la conexion a Internet y revisa el mensaje anterior.
goto :error

:error_compilacion
echo ERROR: No se pudo compilar Truco.
echo Revisa el mensaje anterior y volve a ejecutar el instalador.
goto :error

:error_archivos
echo ERROR: La compilación no generó todos los archivos necesarios.
goto :error

:error
echo.
echo La instalación no se completó. Esta ventana quedará abierta para mostrar el error.
pause
exit /b 1
