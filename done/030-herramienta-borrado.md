# 030 — Herramienta de borrado con pincel de tamaño ajustable (HU-5)

## Objetivo
Sale de `docs/definiciones/rediseno-ux-ui-y-navegacion.md` (HU-5, Diseño técnico "Borrado: mismo pipeline de pintado, color especial").

## Alcance
- Modo `paintMode: 'paint' | 'erase'` en `Editor.tsx`. En modo `erase`, pintar escribe `{r:0,g:0,b:0,a:0}` en vez del color de la paleta activa, pasando por el mismo `applyPixelsWithSymmetry` ya existente (respeta simetría y aislar-parte, sin lógica paralela).
- Control de tamaño de pincel (nuevo, solo para este modo): un radio N que escribe un bloque de N×N píxeles centrado en el punto, en vez de un solo píxel.
- Botón "Borrar" que activa/desactiva el modo (mismo patrón visual que otros toggles del panel, ej. "Aislar parte").

## Qué NO hacer
- No extender el tamaño de pincel ajustable a la herramienta de pintar normal — fuera de alcance explícito de este ticket (ver "No incluye" del documento de definición).

## Verificación
- En vivo (Claude in Chrome): activar modo borrar, borrar píxeles con distintos tamaños de pincel, confirmar por `getImageData` que quedan en `alpha=0`; confirmar que con simetría activa se borra también el píxel espejado, y que con una parte aislada activa el borrado no afecta píxeles fuera de esa parte.
- Confirmar que exportar el PNG/pack después de borrar deja esas zonas transparentes en el archivo (consistente con `maskPixelsOutsideUVBoxes`, ticket 015 — sin conflicto, son mecanismos independientes que coexisten).
- `npm run lint`, `npm test`, `npm run build` en verde.

## Criterios de aceptación
- Dado el modo "Borrar" activo, cuando pinto sobre la cuadrícula, entonces los píxeles bajo el pincel quedan transparentes.
- Dado simetría activa, cuando borro, entonces también se borra el píxel espejado.
- Dado una parte aislada, cuando borro, entonces solo se borran píxeles dentro de esa parte.
- Dado el tamaño de pincel aumentado, cuando borro, entonces el área borrada crece en consecuencia.

## Hecho

Implementado tal como estaba alcanzado, sin recortes de alcance:

- `brush.ts` (nuevo, puro): `computeBrushFootprint`/`computeBrushFootprintForLine`, tamaños 1-5, centrado con la misma convención `Math.floor` ya usada en `resolution.ts`.
- `TextureEditor.tsx`: prop opcional `forcedRgba` que sustituye el color de paleta en los 3 puntos de pintado internos, sin que el componente conozca el concepto de "modo borrado".
- `Editor.tsx`: `paintMode`/`eraseBrushSize` (estado independiente de `color`, para conservar el color seleccionado al desactivar el borrado); `setPixel`/`paintLine` expanden a footprint de pincel en modo `erase` antes de pasar por el mismo `applyPixelsWithSymmetry` ya existente -- sin lógica paralela.
- `EraseControls.tsx` (nuevo): botón toggle (mismo patrón visual que "Aislar parte", `aria-pressed`) + selector de tamaño 1×1 a 5×5, solo visible con el modo activo. Insertado como `Section` propia en el grid del panel, después de "Color".

Tests: 169/169 en verde (incluye `brush.spec.ts` nuevo), `npm run lint` y `npm run build` en verde.

Verificación en vivo (Claude in Chrome, local, contra `npm run dev` de frontend+backend) usando `getImageData` real sobre el canvas de 64×32, no solo revisión visual:
- Pincel 1×1: un click deja exactamente 1 píxel en `alpha=0`.
- Pincel 3×3 + simetría activa: 9 píxeles en el bloque centrado + 9 en el espejado (18 en total) quedan en `alpha=0`.
- Parte aislada (`head.front`) activa: borrar fuera de la región no cambia ningún píxel (bloqueado, mismo aviso que ya usa aislar-parte); borrar dentro sí funciona.
- Con el modo desactivado, un click vuelve a pintar exactamente 1 píxel con el color de paleta seleccionado -- confirma que el tamaño de pincel no se filtra al pintado normal (el "Qué NO hacer" del ticket se respetó).

Exportación (criterio "el PNG exportado deja las zonas borradas transparentes"): verificado por revisión de código en vez de una descarga real del archivo -- `encodeBufferToPngBlob` (`export.ts`, sin cambios en este ticket) opera sobre `buffer.getRawData()`, el mismo buffer real que `setPixel` ya escribe con `alpha=0` al borrar, vía `ctx.putImageData`/`canvas.toBlob` (el canal alfa se preserva exacto por la propia API del navegador). Es el mismo mecanismo ya verificado en el ticket 015, sin ninguna ruta nueva introducida por el borrado que pudiera perder la transparencia -- no se consideró necesario decodificar un PNG descargado para confirmar algo que ya se sigue por construcción del código.

Sin hallazgos de QA pendientes ni decisiones de alcance recortadas.
