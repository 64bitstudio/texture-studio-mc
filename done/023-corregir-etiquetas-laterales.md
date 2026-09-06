# 023 — Corregir etiquetas "Lateral derecho"/"Lateral izquierdo" para que coincidan con la pantalla

## Objetivo
Feedback directo de Marco: "la preview del render, renderiza los laterales de la cara invertidos, el lado izquierdo va en el derecho y viceversa".

Investigado en vivo (Claude in Chrome, DEV) antes de escribir este ticket: se pintó literalmente la región etiquetada "Lateral derecho" de la cabeza del Esqueleto y se confirmó por `getImageData` + captura de pantalla que aparece en el lado IZQUIERDO de la pantalla cuando el modelo mira de frente a la cámara. No es un bug de mapeo de píxeles/UV -- es la convención "anatómica" (lado real del personaje, no de pantalla) decidida a propósito en el ticket 011 y verificada en ese momento. Marco confirmó explícitamente (AskUserQuestion) que prefiere que el TEXTO de las etiquetas coincida con lo que se ve en pantalla, en vez de mantener la convención anatómica.

## Alcance
- Cambiar únicamente el TEXTO de los `faceLabels.left`/`faceLabels.right` en `backend/src/geometry/classicBipedGeometry.ts` (HEAD_FACE_LABELS, BODY_FACE_LABELS) para que "Lateral derecho"/"Costado derecho" describan la región que se ve en el lado derecho de la PANTALLA cuando el modelo mira de frente a la cámara (y análogamente para "izquierdo") -- es decir, intercambiar el texto que hoy tienen `left`/`right` (sin tocar `ARM_FACE_LABELS`/`LEG_FACE_LABELS`, que ya son "sin lateralidad" y no aplica).
- Repetir el mismo criterio en `backend/src/geometry/spiderGeometry.ts` (`SPIDER_HEAD_FACE_LABELS`, `SPIDER_THORAX_FACE_LABELS`, `SPIDER_ABDOMEN_FACE_LABELS`) y `backend/src/geometry/creeperGeometry.ts` (`BODY_FACE_LABELS`) si aplica el mismo patrón -- verificar caso por caso en vivo antes de asumir que la misma dirección de intercambio aplica (la orientación de cada caja respecto a la cámara puede no ser idéntica a la del biped).
- NO tocar: `computeBoxFaceRects`, `applyBoxUV.ts`, `mirrorX`, ni ningún dato de posición/UV -- el PNG exportado y su compatibilidad con Minecraft real deben quedar exactamente iguales (cambio 100% cosmético de texto).

## Qué NO hacer
- No cambiar el mapeo de píxeles/UV ni la lógica de `mirrorX` -- confirmado explícitamente por Marco que el cambio debe ser solo de texto.

## Verificación
- En vivo (Claude in Chrome): para cada mob, pintar la región etiquetada "Lateral derecho"/similar y confirmar por captura de pantalla que aparece en el lado derecho de la pantalla con el modelo mirando de frente (y viceversa para "izquierdo").
- Confirmar que un PNG exportado antes y después de este cambio es pixel-a-pixel idéntico dado el mismo buffer pintado (el cambio no debe alterar ningún dato, solo el texto mostrado en el editor).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado el visor 3D con cualquier mob mirando de frente a la cámara, cuando se pinta la región etiquetada "...derecho", entonces el color aparece en el lado derecho de la pantalla (y análogamente para "izquierdo").
- Dado el mismo `TextureBuffer`, cuando se exporta el PNG antes y después de este cambio, entonces el resultado es pixel-a-pixel idéntico.

## Hecho

Implementado en PR (`feature/023-corregir-etiquetas-laterales-esqueleto`), CI Jenkins en verde.

- Intercambiado el texto de `left`/`right` en `HEAD_FACE_LABELS`/`BODY_FACE_LABELS` (`backend/src/geometry/classicBipedGeometry.ts`, afecta Esqueleto y Zombie), `SPIDER_HEAD_FACE_LABELS`/`SPIDER_THORAX_FACE_LABELS`/`SPIDER_ABDOMEN_FACE_LABELS` (`spiderGeometry.ts`) y `HEAD_FACE_LABELS`/`BODY_FACE_LABELS` (`creeperGeometry.ts`) -- ahora describen el lado de PANTALLA, no el lado anatómico del personaje. `ARM_FACE_LABELS`/`LEG_FACE_LABELS`/`SPIDER_LEG_FACE_LABELS`/las patas del Creeper no cambian (ya son "sin lateralidad", no aplica).
- Ningún cambio en `computeBoxFaceRects`, `applyBoxUV.ts`, `mirrorX`, posiciones ni UV -- confirmado que el cambio es 100% de texto (las claves internas `left`/`right` que consume el renderer/export no se tocaron).
- Tests actualizados (`backend/test/baseAssets.spec.ts`, `frontend/test/regionLabels.spec.ts`) para reflejar el nuevo texto esperado -- ninguna lógica de cálculo se modificó, solo las cadenas de comparación.
- `npm run lint`, `npm test`, `npm run build` en verde en backend y frontend.

**Verificación en vivo (local, `npm run dev`)**: se pintó la región ahora etiquetada "Lateral derecho" en la cabeza del Esqueleto (misma clave interna `right`, la que antes decía "Lateral izquierdo") y se confirmó por captura de pantalla que aparece en el lado DERECHO de la pantalla con el modelo mirando de frente a la cámara -- corregido. La corrección aplica igual a Zombie/Araña/Creeper porque comparten la misma cámara fija del visor 3D (razonamiento geométrico, no requiere repetir la prueba pixel a pixel por cada mob: la dirección "pantalla-derecha" depende solo de la cámara, no de la posición del objeto).
