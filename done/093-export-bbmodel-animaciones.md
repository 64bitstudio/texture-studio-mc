# 093 — Exportar .bbmodel: incluir animaciones

## Objetivo
Extender el export del ticket 092 para incluir el array `animations` del `.bbmodel`, con las animaciones nombradas creadas en la Etapa 4 -- cierra el flujo completo de punta a punta del epic. Nace de `docs/definiciones/modelado-3d-custom-y-generacion-con-ia.md` ("Impacto estimado" ticket 14; HU-13, completo). Depende de los tickets 090, 092, y usa el entorno de prueba ya validado en el ticket 080.

## Criterios de aceptación (TDD)
- Dado un mob con al menos una animación, cuando exporto, el `.bbmodel` descargado incluye un array `animations` que refleja correctamente esas animaciones nombradas (nombre + keyframes por hueso).
- Dado ese archivo, cuando se carga en el mismo entorno de prueba de FreeMinecraftModels validado en el ticket 080, las animaciones se reproducen correctamente en el juego (incluyendo el comportamiento automático de `idle`/`walk`/`attack`/`death` si están presentes).

## Hecho

Implementado en la rama `feature/093-export-bbmodel-animaciones`, extendiendo `exportBlockbench.ts` del ticket 092 (ya mergeado).

- **`frontend/src/exportBlockbench.ts`**: `buildBlockbenchModel` gana `animations?: MobAnimation[]`. Formato derivado de la MISMA evidencia real que el ticket 092 (`done/080-assets/test-model.bbmodel`, que ya trae 2 animaciones verificadas en el juego): `animators` indexado por el UUID del GRUPO (bone), un `AnimationKeyframe` se descompone en hasta 3 keyframes de Blockbench (un canal cada uno) en el mismo `time`, `data_points` con componentes como strings, `loop` booleano traducido a `"loop"`/`"once"`.
- **`frontend/src/export.ts`**: `exportMobBlockbench` pasa `entry.animations` tal cual.
- **`frontend/src/components/MobEntryCard.tsx`**/**`Proyecto.tsx`**: nuevo prop `animations?`, viaja desde `ProjectMobEntry.animations`.

**Tests**: 9 casos nuevos en `frontend/test/exportBlockbench.spec.ts` (27 en total en ese archivo). Suite completa: **389/389 tests en verde**. `tsc -b`, `oxlint`, `npm run build` sin hallazgos.

**Verificación real, contra el archivo descargado de verdad**: se exportó un Zombie real con las animaciones `walk`/`idle` ya creadas en el editor de animación (tickets 090/091) -- el `.bbmodel` descargado incluyó ambas animaciones completas (4-5 huesos cada una, 9 keyframes por hueso), con nombres/tiempos/valores exactos. JSON válido, sin errores en consola.

**Criterio de aceptación pendiente, señalado explícitamente (no completado en silencio)**: el segundo criterio de este ticket ("cuando se carga en el mismo entorno de prueba de FreeMinecraftModels validado en el ticket 080, las animaciones se reproducen correctamente en el juego") requiere el servidor de Minecraft real de Marco -- este entorno de desarrollo no tiene acceso a él. Verifiqué la corrección estructural del formato tan a fondo como es posible sin esa carga real (27 tests + el mismo criterio de coincidencia contra la evidencia ya verificada en el juego que usó el ticket 092), pero la prueba EN EL JUEGO queda pendiente de que Marco la haga él mismo con el `.bbmodel` real de un mob con animaciones. Este es también el ÚLTIMO ticket del epic (14/14) -- con este cierre de código, el flujo completo (modelar → texturizar → animar → exportar) queda implementado de punta a punta; solo falta esta validación final en el juego para darlo por completamente cerrado.

Sin hallazgos pendientes del gate de QA automático al momento de escribir esto (se revisa de nuevo tras abrir el PR).
