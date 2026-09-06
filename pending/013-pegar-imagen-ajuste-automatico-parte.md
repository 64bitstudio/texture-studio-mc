# 013 — Pegar imagen con ajuste automático a la parte seleccionada

## Objetivo
Sale de feedback directo de Marco: al pegar una imagen que va a representar, por ejemplo, la cara, un brazo o la espalda, quiere que se ajuste automáticamente (escalado) a los pixeles de esa parte, en vez de tener que arrastrar/redimensionar el overlay a mano cada vez (flujo manual del ticket 005, que se mantiene disponible cuando no hay una parte seleccionada).

## Depende de
Tickets 011 (regiones nombradas) y 012 (aislar parte) — reusa la parte actualmente seleccionada/aislada como el objetivo del ajuste automático.

## Alcance
1. Si hay una parte aislada (ticket 012) activa al pegar/subir una imagen (HU-9, ticket 005), el overlay se ajusta automáticamente a las dimensiones exactas de esa región (escalado nearest-neighbor, mismo criterio ya usado en el ticket 005) en vez de aparecer con su tamaño original centrado.
2. El usuario conserva la posibilidad de ajustar manualmente el resultado antes de confirmar (mover/redimensionar sigue disponible, el auto-ajuste es el punto de partida, no un paso obligatorio final).
3. Si NO hay parte seleccionada, el comportamiento es exactamente el del ticket 005 (sin cambios) — este ticket es aditivo, no reemplaza el flujo existente.

## Qué NO construir (fuera de este ticket)
- No cambies el recorte a los límites de la caja UV ya implementado en el ticket 005 — el auto-ajuste inicial simplemente empieza ya encajado, pero las mismas reglas de "nunca desbordar a otra caja UV" siguen aplicando si el usuario ajusta manualmente después.

## Criterios de aceptación
- Dado que la parte "Cara" está aislada (ticket 012) y se pega/sube una imagen de cualquier tamaño, cuando aparece el overlay, entonces ya está ajustado (escalado) exactamente a los pixeles de la región de la cara, sin necesidad de ajuste manual previo a confirmar.
- Dado ese mismo escenario, cuando el usuario decide mover/redimensionar el overlay de todos modos, entonces puede hacerlo libremente antes de confirmar (el auto-ajuste no bloquea el ajuste manual).
