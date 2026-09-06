# 012 — Aislar una parte del modelo para pintar

## Objetivo
Sale de feedback directo de Marco: quiere seleccionar una parte del mob (ej. "la cara") y que el resto de la cuadrícula se oculte, mostrando solo esa región — reduce el riesgo de pintar la caja equivocada (gotcha ya documentado en `minecraft-texture-pack-pipeline`: "el desgarre de una región nunca debe estirarse más allá de su propio borde de caja hacia OTRA caja UV").

## Depende de
Ticket 011 (regiones UV nombradas) — usa el mismo catálogo de nombres.

## Alcance
1. Selector de partes (lista/dropdown con los nombres del ticket 011).
2. Al seleccionar una parte, la cuadrícula:
   - Atenúa (opacidad reducida) o ancla visualmente todo lo que NO pertenece a esa parte.
   - Opcional pero recomendado: recorta/hace zoom automático a esa región para aprovechar mejor el espacio del editor al pintar un detalle pequeño (tu criterio, documenta la decisión).
3. Pintar (click/brocha) solo tiene efecto dentro de la parte aislada mientras el modo esté activo — pintar fuera de ella (si visualmente aún es alcanzable) debe bloquearse o no tener efecto, nunca fallar silenciosamente sin feedback.
4. Opción de volver a la vista completa ("Mostrar todo").

## Qué NO construir (fuera de este ticket)
- No cambies el comportamiento de undo/redo — sigue funcionando igual, aislar una parte es solo un filtro de vista/interacción, no una nueva unidad de historial.

## Criterios de aceptación
- Dado que se selecciona una parte (ej. "Cara"), cuando se activa el modo aislado, entonces solo esa región es pintable y el resto queda claramente diferenciado como no-editable en ese momento.
- Dado el modo aislado activo, cuando se pinta dentro de la región, entonces el resultado se refleja correctamente en el modelo 3D completo (no solo en la parte visible del editor).
- Dado el modo aislado activo, cuando se elige "Mostrar todo", entonces la cuadrícula vuelve a su vista completa sin perder nada de lo pintado.

## Hecho
Implementado por el agente `fullstack-dev` (PR [#25](https://github.com/64bitstudio/texture-studio-mc/pull/25)). CI de Jenkins en verde, sin hallazgos del gate de QA automático.

- Selector de partes reusando directamente el catálogo de `regionLabels.ts` (ticket 011), sin redefinirlo.
- Atenuado visual (overlay con "agujero" sobre la región activa) + bloqueo REAL de pintura fuera de la región (filtrado antes de tocar `history`/`buffer`, no solo visual) + feedback en 3 capas (atenuado, cursor `not-allowed`, mensaje inline).
- Simetría (ticket 004) respeta el aislamiento: una contraparte espejada fuera de la región se descarta en silencio.
- `isolatedRegion` expuesto en `Editor.tsx` para que el ticket 013 lo consuma directamente.
- **Verificado en vivo contra el deploy real de DEV** (el orquestador repitió la verificación tras el merge): al aislar "Cara", el resto de la cuadrícula se atenúa claramente (la cara del cráneo queda iluminada); pintar dentro de la cara aplica el color y se refleja en el modelo 3D; pintar fuera muestra el mensaje "Pintura bloqueada: ese pixel está fuera de la parte aislada (Cara)." sin modificar nada; "Mostrar todo" restaura la vista completa sin pérdida.
- Pendiente, explícitamente fuera de este ticket: pegado con ajuste automático a la parte aislada (013).
