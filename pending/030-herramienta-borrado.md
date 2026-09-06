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
