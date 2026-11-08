# Prueba manual de la mesa de Truco

## Escenario manual: Envido rechazado

En una terminal separada, después de compilar, iniciar el escenario local:

```powershell
& .\.local\node\node.exe .\apps\server\dist\manual-scenarios.js envido-rechazado
```

Iniciar Vite como siempre, crear una partida contra la máquina y pulsar **Envido** cuando esté disponible. La máquina responde **No quiero**: el historial debe mostrar la adjudicación de 1 punto a Jorge y no debe mostrar tantos de ningún participante. Detener este lanzador y volver a iniciar `apps/server/dist/main.js` para usar el servidor normal.

## Historial y anuncios públicos

17. Tras un Envido, Truco, Flor o mazo, comprobar que aparece un anuncio temporal y que los anuncios consecutivos avanzan solos aproximadamente cada dos segundos.
18. Comprobar la sección **Historial**: conserva los acontecimientos públicos en orden, permite desplazarse y no revela cartas de la máquina, tantos ni datos internos.
19. Si una mano termina mientras hay anuncios, esperar a que se anuncie el cierre; recién entonces debe aparecer el panel. Pulsar **Continuar** no envía ninguna acción y revela la mano ya preparada sin mezclar su historial con el cierre anterior.
20. Jugar varias manos: los anuncios nuevos no se repiten al llegar snapshots sucesivos y las acciones de la nueva mano usan la versión actual del servidor.
21. Verificar que el historial separa cada bloque por `mano-N`: una adjudicación de Envido o Truco y el posterior cierre de esa misma mano son información distinta; el marcador sólo debe reflejar el snapshot autoritativo acumulado.

## Requisitos e inicio

- Windows con PowerShell, Node 24.20.0 en `.local/node` y dependencias instaladas con `npm ci`.
- No definir `VITE_SERVER_URL`: Vite reenvía `/api` y `/ws` al servidor local.

Abrir dos terminales en la raíz. En la primera:

```powershell
& .\.local\node\node.exe .\node_modules\prisma\build\index.js generate --schema apps/server/prisma/schema.prisma
& .\.local\node\node.exe .\node_modules\typescript\bin\tsc --build
& .\.local\node\node.exe .\apps\server\dist\main.js
```

o este equivalente
```powershell
& .\.local\node\node.exe .\node_modules\prisma\build\index.js generate --schema apps/server/prisma/schema.prisma; if ($LASTEXITCODE -ne 0) { throw "Error generando Prisma" }; & .\.local\node\node.exe .\node_modules\typescript\bin\tsc --build; if ($LASTEXITCODE -ne 0) { throw "Error compilando TypeScript" }; & .\.local\node\node.exe .\apps\server\dist\main.js
```

En la segunda:

```powershell
& .\.local\node\node.exe .\node_modules\vite\bin\vite.js apps/web
```

Abrir `http://localhost:5173` (o la URL que imprima Vite).

## Juego y comprobaciones

1. Ingresar un apodo válido de al menos tres caracteres y pulsar **Jugar contra máquina**.
2. Esperar **Conectado y suscripto**. La mano propia queda abajo; la máquina arriba, con sólo dorsos y sin palo ni valor visibles.
3. Verificar que el número de dorsos coincide con las cartas restantes de la máquina y que la muestra es visible.
4. Cuando sea **Su turno**, pulsar una carta propia. Aparece **Esperando confirmación de la jugada** y no se elimina ninguna carta de forma optimista.
5. Esperar la respuesta automática: el snapshot siguiente actualiza las cartas restantes de ambos jugadores. La máquina sólo muestra boca arriba las cartas que ya son públicas.
6. Comprobar que las jugadas se ven como **Baza en curso** y que, al cerrarse, pasan a **Baza N completada**. La interfaz no calcula ni anuncia resultados de bazas.
7. Con dos o tres bazas completadas, comprobar en escritorio que se distribuyen horizontalmente en la zona central y que las cartas propias siguen visibles abajo. En móvil, comprobar que no aparece desbordamiento horizontal.
8. Si aparece una oportunidad de Flor propia, pulsar **Flor** en la zona de acciones y comprobar que la partida continúa tras el snapshot autoritativo. Si la máquina canta Flor, usar sólo las respuestas que aparezcan.
9. Probar Envido, Truco, sus subidas y **Irse al mazo** únicamente cuando el botón correspondiente esté visible. Las opciones visibles proceden del servidor; después de cada acción esperar confirmación y snapshot.
10. Si después de jugar la máquina conserva sus dorsos, revisar la insignia de turno y el aviso: puede estar esperando una respuesta humana a un canto. No deben faltar controles para una acción que el servidor haya declarado disponible.
11. Al completar una baza, comprobar el anuncio autoritativo de victoria de jugador, máquina o empate junto a sus cartas públicas.
12. Al cerrar la mano, comprobar el panel con ganador, marcador y motivo legible. No debe mostrar un total agregado de puntos de la mano. Debe permanecer aunque el servidor ya haya preparado la mano siguiente.
13. Pulsar **Continuar**: se oculta el panel y aparece el último snapshot recibido. El mismo cierre no debe volver a mostrarse por snapshots repetidos.
14. Tras **Continuar**, jugar una carta de la nueva mano y comprobar que no aparece `VERSION-OBSOLETA`. Si el servidor rechaza una versión obsoleta, la interfaz debe solicitar un snapshot nuevo y pedir volver a seleccionar la carta, sin reenviarla sola.
15. Si hay un desafío pendiente de envido, flor o truco, se muestra un aviso y las cartas quedan deshabilitadas. Aún no existe una interfaz para responderlo.
16. En escritorio y móvil, comprobar que valores, palos, muestra y cartas propias se leen sin deformarse; ninguna cara debe transparentar la madera.

## Resultado esperado y límites

- Las cartas usan SVG locales de baraja española (oros, copas, espadas y bastos); figuras 10, 11 y 12 son sota, caballo y rey. La atribución CC BY-SA 3.0 está en `apps/web/src/assets/cartas-espanolas/LICENCIA.md`.
- Cada `game.confirmed` libera la espera de envío; cada `game.rejected` conserva la mano y muestra el código de rechazo.
- El servidor sigue siendo la autoridad de legalidad, bazas y privacidad. No se exponen token ni cartas privadas de la máquina.
- Pendiente para etapas posteriores: cantos y respuestas, temporizadores, animaciones y reconexión avanzada.

## Solución de problemas

- Si no conecta, confirmar que el servidor está en `127.0.0.1:3000`, que Vite sigue activo y que `VITE_SERVER_URL` no está definido.
- Si el puerto 3000 está ocupado, liberarlo; el proxy de desarrollo está configurado específicamente para ese puerto.
